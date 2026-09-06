"""
KeySign feature extractor (build-order step 2).

Turns one sample's raw keydown/keyup events into a fixed-length, explainable
feature vector. Every head (identity, state, threat, drift) consumes these.

Input: the event list from a capture export (see docs/data-format.md):
    [{"type": "down"|"up", "key": "a", "code": "KeyA", "t": 1234.5}, ...]
    `t` is milliseconds; only differences matter.

Usage as a library:
    from pipeline.features import extract_features, samples_to_frame
    feats = extract_features(sample["events"])          # dict
    df = samples_to_frame(json.load(open("export.json")))  # one row per sample

Usage from the shell:
    python -m pipeline.features data/samples/keysign_<date>.json
    python -m pipeline.features export.json -o data/features.csv
    python -m pipeline.features a.json b.json "keystrokes (1).json" -o data/features.csv   # merged

Feature names are stable and listed in FEATURE_NAMES. Add new features at the
END of that list so older CSVs stay column-compatible.
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Iterable, Iterator

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------

PAUSE_MS = 500.0        # a down->down gap longer than this is a "pause"
MAX_HOLD_MS = 1500.0    # holds longer than this are stuck keys / window switches; dropped
MAX_FLIGHT_MS = 5000.0  # gaps longer than this are "walked away"; dropped from timing stats
                        # (still counted in pause features)
ERROR_KEYS = {"Backspace", "Delete"}
MODIFIER_KEYS = {"Shift", "Control", "Alt", "Meta", "CapsLock", "AltGraph"}

# Most frequent English digraphs. Per-digraph down->down time is a strong
# identity signal (people have habitual finger patterns for "th", "er", ...).
COMMON_DIGRAPHS = ["th", "he", "in", "er", "an", "re", "on", "at", "en", "nd"]

FEATURE_NAMES: list[str] = [
    # volume
    "n_keys", "duration_s",
    # dwell / hold: keyup - keydown for the same key
    "hold_mean", "hold_std", "hold_median",
    # flight (down->down): keydown to the next keydown. Matches analyze.py.
    "flight_mean", "flight_std", "flight_median",
    # release->press (up->down): keyup to the next keydown. Negative when keys overlap
    # (fast typists press the next key before releasing the previous one).
    "rp_mean", "rp_std", "rp_negative_ratio",
    # speed and errors
    "speed_kps", "error_rate",
    # rhythm: normalised variance of inter-key intervals, and pauses
    "rhythm_cv", "pause_count", "pause_ratio", "longest_pause_ms",
    # modifier usage (shift-heavy typing, caps, shortcuts)
    "modifier_ratio",
    # per-digraph down->down time, ms (see COMMON_DIGRAPHS)
    *[f"dg_{d}" for d in COMMON_DIGRAPHS],
]


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------

def _key_id(e: dict) -> str:
    """Pair down/up on `code`; fall back to `key` for keyboards that send an empty code."""
    return e.get("code") or e.get("key") or ""


def _stat(xs: np.ndarray, fn, default: float = 0.0) -> float:
    return float(fn(xs)) if xs.size else default


def extract_features(events: Iterable[dict], fill_missing_digraphs: bool = True) -> dict[str, float]:
    """
    Raw events -> feature dict keyed by FEATURE_NAMES.

    fill_missing_digraphs: when a digraph never occurs in the sample, fill its
    slot with the sample's flight_mean (keeps vectors dense for sklearn).
    Set False to get NaN instead and impute yourself.
    """
    open_downs: dict[str, int] = {}        # key_id -> index into down_ts
    holds: list[float] = []
    down_ts: list[float] = []               # keydown times, in order
    down_keys: list[str] = []               # KeyboardEvent.key for each keydown
    up_ts: list[float | None] = []          # keyup time for each keydown (None if never released)
    n_err = 0
    n_mod = 0

    for e in events:
        t = float(e["t"])
        kid = _key_id(e)
        key = e.get("key", "")
        if e.get("type") == "down":
            open_downs[kid] = len(down_ts)
            down_ts.append(t)
            down_keys.append(key)
            up_ts.append(None)
            if key in ERROR_KEYS:
                n_err += 1
            if key in MODIFIER_KEYS:
                n_mod += 1
        elif e.get("type") == "up":
            idx = open_downs.pop(kid, None)
            if idx is not None:
                hold = t - down_ts[idx]
                if 0 <= hold <= MAX_HOLD_MS:
                    holds.append(hold)
                    up_ts[idx] = t

    n_keys = len(down_ts)
    # release->press: from the release of key i to the press of key i+1.
    # Negative when the typist presses the next key before letting go of this one.
    rp = [down_ts[i + 1] - up_ts[i] for i in range(n_keys - 1) if up_ts[i] is not None]
    down_arr = np.asarray(down_ts, dtype=float)
    flights_all = np.diff(down_arr) if n_keys >= 2 else np.empty(0)
    flights = flights_all[flights_all <= MAX_FLIGHT_MS]            # timing stats
    hold_arr = np.asarray(holds, dtype=float)
    rp_arr = np.asarray(rp, dtype=float)
    rp_arr = rp_arr[np.abs(rp_arr) <= MAX_FLIGHT_MS]

    duration_s = float(down_arr[-1] - down_arr[0]) / 1000.0 if n_keys >= 2 else 0.0
    flight_mean = _stat(flights, np.mean)
    flight_std = _stat(flights, np.std)

    pauses = flights_all[flights_all > PAUSE_MS] if flights_all.size else np.empty(0)

    f: dict[str, float] = {
        "n_keys": float(n_keys),
        "duration_s": duration_s,
        "hold_mean": _stat(hold_arr, np.mean),
        "hold_std": _stat(hold_arr, np.std),
        "hold_median": _stat(hold_arr, np.median),
        "flight_mean": flight_mean,
        "flight_std": flight_std,
        "flight_median": _stat(flights, np.median),
        "rp_mean": _stat(rp_arr, np.mean),
        "rp_std": _stat(rp_arr, np.std),
        "rp_negative_ratio": float(np.mean(rp_arr < 0)) if rp_arr.size else 0.0,
        "speed_kps": n_keys / duration_s if duration_s > 0 else 0.0,
        "error_rate": n_err / n_keys if n_keys else 0.0,
        "rhythm_cv": flight_std / flight_mean if flight_mean > 0 else 0.0,
        "pause_count": float(pauses.size),
        "pause_ratio": float(pauses.size) / flights_all.size if flights_all.size else 0.0,
        "longest_pause_ms": _stat(flights_all, np.max),
        "modifier_ratio": n_mod / n_keys if n_keys else 0.0,
    }

    # digraphs: down->down time for consecutive printable keys forming a common pair
    dg_times: dict[str, list[float]] = {d: [] for d in COMMON_DIGRAPHS}
    for i in range(n_keys - 1):
        a, b = down_keys[i], down_keys[i + 1]
        if len(a) == 1 and len(b) == 1:
            pair = (a + b).lower()
            if pair in dg_times:
                gap = down_ts[i + 1] - down_ts[i]
                if gap <= MAX_FLIGHT_MS:
                    dg_times[pair].append(gap)
    fill = flight_mean if fill_missing_digraphs else float("nan")
    for d in COMMON_DIGRAPHS:
        xs = dg_times[d]
        f[f"dg_{d}"] = float(np.mean(xs)) if xs else fill

    return {name: f[name] for name in FEATURE_NAMES}


def to_vector(feats: dict[str, float]) -> np.ndarray:
    """Feature dict -> 1-D array in FEATURE_NAMES order."""
    return np.asarray([feats[n] for n in FEATURE_NAMES], dtype=float)


# ---------------------------------------------------------------------------
# Batch + streaming helpers
# ---------------------------------------------------------------------------

def samples_to_frame(samples: Iterable[dict]) -> pd.DataFrame:
    """
    Capture export (list of samples) -> DataFrame, one row per sample.
    Columns: sample_id, user, condition, started_at, then FEATURE_NAMES.
    """
    rows = []
    for i, s in enumerate(samples):
        meta = {
            "sample_id": s.get("id", f"sample_{i}"),
            "user": s.get("user", ""),
            "condition": s.get("condition", ""),
            "started_at": s.get("started_at", ""),
        }
        rows.append({**meta, **extract_features(s.get("events", []))})
    cols = ["sample_id", "user", "condition", "started_at", *FEATURE_NAMES]
    return pd.DataFrame(rows, columns=cols)


def sliding_windows(events: list[dict], window_ms: float = 10_000, step_ms: float = 2_000) -> Iterator[list[dict]]:
    """
    Yield event slices for live use (step 4: the backend streams one feature
    vector per window). Windows are anchored on event time, not wall clock.
    """
    if not events:
        return
    ts = np.asarray([e["t"] for e in events], dtype=float)
    start = ts[0]
    end = ts[-1]
    while start <= end:
        mask = (ts >= start) & (ts < start + window_ms)
        chunk = [events[i] for i in np.flatnonzero(mask)]
        if chunk:
            yield chunk
        start += step_ms


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="KeySign: extract features from a capture export.")
    p.add_argument("input", nargs="+", help="one or more JSON exports from capture/index.html (merged)")
    p.add_argument("-o", "--out", help="write features CSV here")
    args = p.parse_args(argv)

    samples = []
    for path in args.input:
        with open(path, encoding="utf-8") as fh:
            part = json.load(fh)
        if isinstance(part, list):
            samples += part
    if not samples:
        print("No samples in file.", file=sys.stderr)
        return 1

    df = samples_to_frame(samples)

    pd.set_option("display.width", 160)
    pd.set_option("display.float_format", lambda x: f"{x:8.1f}")
    print(f"{len(df)} samples, {df['user'].nunique()} users, conditions: {sorted(df['condition'].unique())}")
    print()
    show = ["n_keys", "hold_mean", "hold_std", "flight_mean", "flight_std", "rp_mean", "speed_kps", "error_rate", "rhythm_cv", "pause_count"]
    print("Per user / condition means:")
    print(df.groupby(["user", "condition"])[show].mean().to_string())

    if args.out:
        df.to_csv(args.out, index=False)
        print(f"\nwrote {args.out}  ({len(df)} rows x {len(df.columns)} cols)")
    return 0


if __name__ == "__main__":
    sys.exit(_main())
