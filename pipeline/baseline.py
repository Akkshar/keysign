"""
KeySign baseline builder (build-order step 3).

A baseline is one person's "normal": per-feature centre and spread, estimated
robustly from their calm samples. Every head then asks the same question in
different words: how far is this new sample from that person's baseline, and
which features moved?

    from pipeline.baseline import build_baseline, Baseline
    b = build_baseline(features_df, user="Akkshar Ranjan")     # calm rows only
    b.save("data/baselines/akkshar.json")

    z = b.zscores(feature_dict)      # per-feature robust z-scores
    d = b.distance(feature_dict)     # one number: 0 = typical, >3 = clearly off
    b.explain(feature_dict)          # [("hold_mean", +2.4), ("speed_kps", -1.9), ...]

Robust statistics (median, MAD) so one weird sample doesn't poison the
baseline. Scale is floored so a feature that never varied in training can't
explode. Distances are RMS of clipped z-scores, so a single feature can't
dominate either.

CLI:
    uv run python -m pipeline.baseline build data/features.csv --user "A" -o data/baselines/A.json
    uv run python -m pipeline.baseline score data/baselines/A.json data/features.csv
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.features import FEATURE_NAMES

# Features that describe the *person*, not the length of the sample, and that
# are stable enough per sample to estimate a spread from. Digraph timings are
# excluded: a 60-key sample contains each digraph once or twice, so their MAD
# is noise and they dominated the distance (measured: pooled stress AUC on the
# teammates set went from 0.47 to 0.54 by dropping them). modifier_ratio is
# excluded too: the enrolment prompts are typed without modifiers, so every
# baseline had a zero spread for it (floored at 1e-6) and one Shift under the
# system-wide hook pinned that z-score at the clip (2026-09-07: the drivers of
# the agent's false alerts read "modifier_ratio +43478"). Measured on the
# labelled windows: dropping it moves calm/stress medians by < 0.05 sigma and
# takes the agent's own ordinary typing from 39-45% of ticks over 3 sigma to
# 17-40%. Both stay in FEATURE_NAMES for the identity classifier.
BASELINE_FEATURES: list[str] = [f for f in FEATURE_NAMES
                                if f not in ("n_keys", "duration_s", "pause_count", "longest_pause_ms", "modifier_ratio")
                                and not f.startswith("dg_")]

MAD_TO_SIGMA = 1.4826      # MAD of a normal distribution -> its standard deviation
Z_CLIP = 5.0               # cap per-feature |z| before combining
MIN_SAMPLES = 3


@dataclass
class Baseline:
    user: str
    features: list[str]
    center: np.ndarray
    scale: np.ndarray
    n_samples: int
    condition: str = "calm"
    method: str = "median_mad"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds"))
    # Per-user State cut-offs written by `pipeline.state calibrate`:
    # {"focus_below": float, "load_above": float, "calibrated_at": str, "note": str} or None.
    state: dict | None = None

    # ---- scoring ----
    def _vec(self, x) -> np.ndarray:
        if isinstance(x, dict):
            return np.asarray([float(x[f]) for f in self.features])
        if isinstance(x, pd.Series):
            return x[self.features].to_numpy(dtype=float)
        x = np.asarray(x, dtype=float)
        if x.shape[-1] != len(self.features):
            raise ValueError(f"expected {len(self.features)} features, got {x.shape[-1]}")
        return x

    def zscores(self, x) -> np.ndarray:
        """Robust z per feature. Works on a dict, Series, 1-D or 2-D array."""
        return (self._vec(x) - self.center) / self.scale

    def distance(self, x, clip: float = Z_CLIP) -> float | np.ndarray:
        """RMS of clipped z-scores. ~1 for a typical calm sample, 3+ is clearly off."""
        z = np.clip(self.zscores(x), -clip, clip)
        return np.sqrt(np.mean(z ** 2, axis=-1))

    def explain(self, x, top: int = 3) -> list[tuple[str, float]]:
        """The features that moved most, signed z-scores, largest first."""
        z = self.zscores(x)
        order = np.argsort(-np.abs(z))[:top]
        return [(self.features[i], float(z[i])) for i in order]

    # ---- persistence ----
    def to_dict(self) -> dict:
        return {
            "user": self.user, "condition": self.condition, "method": self.method,
            "created_at": self.created_at, "n_samples": self.n_samples,
            "features": self.features,
            "center": [float(v) for v in self.center],
            "scale": [float(v) for v in self.scale],
            "state": self.state,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Baseline":
        return cls(user=d["user"], features=list(d["features"]),
                   center=np.asarray(d["center"], dtype=float), scale=np.asarray(d["scale"], dtype=float),
                   n_samples=int(d["n_samples"]), condition=d.get("condition", "calm"),
                   method=d.get("method", "median_mad"), created_at=d.get("created_at", ""),
                   state=d.get("state"))

    def save(self, path: Path | str) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=1), encoding="utf-8")
        return path

    @classmethod
    def load(cls, path: Path | str) -> "Baseline":
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))


def robust_center_scale(X: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Per-column median and MAD*1.4826. The scale is floored at the larger of
    5% of |median| and a tiny epsilon, and falls back to std when MAD is 0
    (e.g. error_rate is exactly 0 in every calm sample).
    """
    X = np.asarray(X, dtype=float)
    center = np.median(X, axis=0)
    mad = np.median(np.abs(X - center), axis=0) * MAD_TO_SIGMA
    std = X.std(axis=0)
    scale = np.where(mad > 0, mad, std)
    floor = np.maximum(0.05 * np.abs(center), 1e-6)
    scale = np.maximum(scale, floor)
    return center, scale


def build_baseline(df: pd.DataFrame, user: str, condition: str | None = "calm",
                   features: list[str] = BASELINE_FEATURES, min_samples: int = MIN_SAMPLES) -> Baseline:
    """
    df: a features table from samples_to_frame / features.csv.
    Uses rows where df.user == user (and df.condition == condition unless None).
    """
    rows = df[df["user"] == user]
    if condition is not None and "condition" in df.columns:
        rows = rows[rows["condition"] == condition]
    if len(rows) < min_samples:
        raise ValueError(f"{user!r}: need >= {min_samples} {condition or 'any'} samples, have {len(rows)}")
    center, scale = robust_center_scale(rows[features].to_numpy(dtype=float))
    return Baseline(user=user, features=list(features), center=center, scale=scale,
                    n_samples=len(rows), condition=condition or "any")


def score_frame(baseline: Baseline, df: pd.DataFrame, prefix: str = "z_") -> pd.DataFrame:
    """Append `distance` and per-feature z columns to a copy of df."""
    out = df.copy()
    Z = baseline.zscores(df[baseline.features].to_numpy(dtype=float))
    for i, f in enumerate(baseline.features):
        out[prefix + f] = Z[:, i]
    out["distance"] = baseline.distance(df[baseline.features].to_numpy(dtype=float))
    return out


def build_all(df: pd.DataFrame, out_dir: Path | str, condition: str | None = "calm",
              min_samples: int = MIN_SAMPLES) -> dict[str, Baseline]:
    """One baseline JSON per user with enough samples. Returns what was built."""
    built = {}
    for user in sorted(df["user"].unique()):
        try:
            b = build_baseline(df, user, condition=condition, min_samples=min_samples)
        except ValueError:
            continue
        b.save(Path(out_dir) / f"{_slug(user)}.json")
        built[user] = b
    return built


def _slug(s: str) -> str:
    return "".join(c.lower() if c.isalnum() else "_" for c in s).strip("_")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="KeySign: build / apply personal baselines.")
    sub = p.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("build", help="build baseline(s) from a features CSV")
    b.add_argument("features_csv")
    b.add_argument("--user", help="one user (default: every user with enough samples)")
    b.add_argument("--condition", default="calm", help="rows to use; 'any' for all")
    b.add_argument("-o", "--out", default="data/baselines", help="output JSON file (with --user) or folder")

    s = sub.add_parser("score", help="score a features CSV against a baseline JSON")
    s.add_argument("baseline_json")
    s.add_argument("features_csv")
    s.add_argument("--user", help="only score this user's rows")
    s.add_argument("-o", "--out", help="write scored CSV here")

    a = p.parse_args(argv)
    if a.cmd == "build":
        df = pd.read_csv(a.features_csv)
        cond = None if a.condition == "any" else a.condition
        if a.user:
            bl = build_baseline(df, a.user, condition=cond)
            out = Path(a.out)
            if out.suffix != ".json":
                out = out / f"{_slug(a.user)}.json"
            bl.save(out)
            print(f"{a.user}: baseline from {bl.n_samples} {bl.condition} samples -> {out}")
        else:
            built = build_all(df, a.out, condition=cond)
            for u, bl in built.items():
                print(f"{u:24s} {bl.n_samples:3d} {bl.condition} samples -> {a.out}/{_slug(u)}.json")
            if not built:
                print("no user had enough samples", file=sys.stderr)
                return 1
    else:
        bl = Baseline.load(a.baseline_json)
        df = pd.read_csv(a.features_csv)
        if a.user:
            df = df[df["user"] == a.user]
        scored = score_frame(bl, df)
        cols = [c for c in ("sample_id", "user", "condition") if c in scored.columns] + ["distance"]
        pd.set_option("display.width", 160)
        print(f"baseline: {bl.user} ({bl.n_samples} {bl.condition} samples)")
        print(scored[cols].assign(distance=scored["distance"].round(2)).to_string(index=False))
        if "condition" in scored.columns:
            print("\nmedian distance by condition:")
            print(scored.groupby("condition")["distance"].median().round(2).to_string())
        if a.out:
            scored.to_csv(a.out, index=False)
            print(f"\nwrote {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(_main())
