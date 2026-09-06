"""
External dataset loaders. Each turns a third-party keystroke dataset into
KeySign samples, the same shape a capture export has, so everything flows
through `pipeline.features.extract_features` unchanged.

Sample shape (superset of docs/data-format.md):
    {
      "user": str, "condition": "calm"|"stress", "prompt": str, "text": str,
      "events": [{"type","key","code","t"}...],
      "source": "cmu_password"|"tie5_raw"|"stress_logger",
      "session": str|int, "started_at": str, "labels": {...}   # dataset-specific
    }

Datasets (see data/external/README.md for provenance):
    cmu_password    51 subjects x 8 sessions x 50 reps of ".tie5Roanl" (timings)
    tie5_raw        6 subjects typing ".tie5Roanl" (raw pynput log)
    stress_logger   2 users, ~1 week each, self-reported fatigue/stress labels

CLI:
    uv run python -m pipeline.datasets                 # convert all staged sets
    uv run python -m pipeline.datasets --only cmu_password tie5_raw
    uv run python -m pipeline.datasets --stage ~/Downloads   # extract from archive*.zip first
Outputs go to data/external/<name>_samples.json and <name>_features.csv.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import zipfile
from datetime import timedelta
from pathlib import Path

import pandas as pd

from pipeline.features import samples_to_frame

ROOT = Path(__file__).resolve().parent.parent
EXTERNAL = ROOT / "data" / "external"

# Names as they appear in KeyboardEvent.key / .code, for keys these datasets name.
_NAMED_KEYS: dict[str, tuple[str, str]] = {
    "enter": ("Enter", "Enter"), "return": ("Enter", "Enter"),
    "space": (" ", "Space"), "tab": ("Tab", "Tab"),
    "backspace": ("Backspace", "Backspace"), "delete": ("Delete", "Delete"),
    "shift": ("Shift", "ShiftLeft"), "shift_r": ("Shift", "ShiftRight"), "shift_l": ("Shift", "ShiftLeft"),
    "ctrl": ("Control", "ControlLeft"), "ctrl_l": ("Control", "ControlLeft"), "ctrl_r": ("Control", "ControlRight"),
    "alt": ("Alt", "AltLeft"), "alt_l": ("Alt", "AltLeft"), "alt_r": ("Alt", "AltRight"), "alt_gr": ("AltGraph", "AltRight"),
    "caps_lock": ("CapsLock", "CapsLock"), "cmd": ("Meta", "MetaLeft"), "cmd_r": ("Meta", "MetaRight"),
    "esc": ("Escape", "Escape"), "num_lock": ("NumLock", "NumLock"),
    "arrow_key": ("ArrowKey", ""), "function_key": ("FunctionKey", ""),
    "up": ("ArrowUp", "ArrowUp"), "down": ("ArrowDown", "ArrowDown"),
    "left": ("ArrowLeft", "ArrowLeft"), "right": ("ArrowRight", "ArrowRight"),
    "period": (".", "Period"), "five": ("5", "Digit5"),
}


def _char_code(ch: str) -> str:
    if ch.isalpha() and ch.isascii():
        return f"Key{ch.upper()}"
    if ch.isdigit():
        return f"Digit{ch}"
    return {".": "Period", ",": "Comma", "/": "Slash", "-": "Minus", "=": "Equal", ";": "Semicolon",
            "'": "Quote", "[": "BracketLeft", "]": "BracketRight", "\\": "Backslash", "`": "Backquote"}.get(ch, "")


def key_and_code(name: str) -> tuple[str, str]:
    """Dataset key label (pynput 'Key.enter', 'shift_r', 'a', '$') -> (key, code)."""
    raw = str(name)
    if raw.startswith("Key."):
        raw = raw[4:]
    low = raw.lower()
    if low in _NAMED_KEYS:
        return _NAMED_KEYS[low]
    if len(raw) == 1:
        return raw, _char_code(raw)
    if set(raw) == {"$"}:            # anonymised character(s) in stress_logger
        return "$", ""
    return raw, ""


def _events(presses: list[tuple[str, float, float]]) -> list[dict]:
    """[(key_label, press_ms, release_ms)] -> sorted down/up events."""
    ev = []
    for label, p, r in presses:
        key, code = key_and_code(label)
        ev.append({"type": "down", "key": key, "code": code, "t": round(p, 3)})
        ev.append({"type": "up", "key": key, "code": code, "t": round(r, 3)})
    # stable sort: on equal t, keep down before up as appended
    ev.sort(key=lambda e: e["t"])
    return ev


# ---------------------------------------------------------------------------
# 1. CMU benchmark: reconstruct timestamps from H / DD columns
# ---------------------------------------------------------------------------

CMU_KEYS = ["period", "t", "i", "e", "five", "Shift.r", "o", "a", "n", "l", "Return"]
CMU_LABELS = [".", "t", "i", "e", "5", "R", "o", "a", "n", "l", "enter"]  # 'Shift.r' is one keystroke: capital R


def cmu_frame_to_samples(df: pd.DataFrame) -> list[dict]:
    """
    One row per (subject, session, rep) with H.<k> and DD.<k1>.<k2> in seconds.
    press[0] = 0; press[j] = press[j-1] + DD; release[j] = press[j] + H.
    """
    h_cols = [f"H.{k}" for k in CMU_KEYS]
    dd_cols = [f"DD.{a}.{b}" for a, b in zip(CMU_KEYS[:-1], CMU_KEYS[1:])]
    H = df[h_cols].to_numpy(dtype=float) * 1000.0
    DD = df[dd_cols].to_numpy(dtype=float) * 1000.0
    out = []
    for i, row in enumerate(df.itertuples(index=False)):
        presses, p = [], 0.0
        for j, label in enumerate(CMU_LABELS):
            if j > 0:
                p += DD[i, j - 1]
            presses.append((label, p, p + H[i, j]))
        out.append({
            "user": f"cmu_{row.subject}",
            "condition": "calm",
            "prompt": ".tie5Roanl",
            "text": ".tie5Roanl",
            "events": _events(presses),
            "source": "cmu_password",
            "session": int(row.sessionIndex),
            "rep": int(row.rep),
            "started_at": "",
        })
    return out


def load_cmu(path: Path | str = EXTERNAL / "cmu_password" / "DSL-StrongPasswordData.csv") -> list[dict]:
    return cmu_frame_to_samples(pd.read_csv(path))


# ---------------------------------------------------------------------------
# 2. Raw .tie5Roanl logs: split on Enter, one sample per repetition
# ---------------------------------------------------------------------------

def tie5_frame_to_samples(df: pd.DataFrame, min_keys: int = 5) -> list[dict]:
    """
    Columns: User_ID, Session_ID, [rep], Key_Pressed, Press_Time, Release_Time (epoch s).
    A repetition ends with Key.enter. Rows whose press time goes backwards
    (logger glitches) are dropped.
    """
    out = []
    for (user, session), g in df.groupby(["User_ID", "Session_ID"], sort=False):
        g = g.reset_index(drop=True)
        press = g["Press_Time"].astype(float).to_numpy()
        release = g["Release_Time"].astype(float).to_numpy()
        keys = g["Key_Pressed"].astype(str).to_numpy()
        rep_rows: list[tuple[str, float, float]] = []
        rep_idx = 0
        last_p = -1.0
        t0 = press[0] * 1000.0

        def flush():
            nonlocal rep_rows, rep_idx
            n = len(rep_rows)
            if n >= min_keys:
                typed = "".join(k for k, _, _ in rep_rows if len(k) == 1)
                out.append({
                    "user": str(user),
                    "condition": "calm",
                    "prompt": ".tie5Roanl",
                    "text": typed,
                    "events": _events(rep_rows),
                    "source": "tie5_raw",
                    "session": int(session),
                    "rep": rep_idx,
                    "started_at": pd.Timestamp(rep_rows[0][1] / 1000.0 + t0 / 1000.0, unit="s").isoformat(),
                })
                rep_idx += 1
            rep_rows = []

        for k, p, r in zip(keys, press, release):
            if p < last_p or r < p:
                continue                      # out-of-order or negative hold: logger glitch
            last_p = p
            rep_rows.append((k, p * 1000.0 - t0, r * 1000.0 - t0))
            if k == "Key.enter":
                flush()
        flush()
    return out


_TIE5_COLS = ["User_ID", "Session_ID", "Key_Pressed", "Key_Pressed_Previous", "Press_Time",
              "Release_Time", "Hold_Time", "DD", "UD", "Characters_Count"]


def read_tie5_csv(path: Path | str) -> pd.DataFrame:
    """
    The raw files come in two layouts, with and without a `rep` column at
    index 2, and one file switches layout mid-way. Normalise every row to the
    10-column layout without `rep`.
    """
    import csv
    rows = []
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        header = next(reader)
        has_rep = "rep" in header
        for r in reader:
            if not r:
                continue
            if len(r) == len(_TIE5_COLS) + 1:
                del r[2]                                 # drop rep
            elif len(r) != len(_TIE5_COLS):
                continue                                 # truncated line
            rows.append(r)
    df = pd.DataFrame(rows, columns=_TIE5_COLS)
    for c in ("Session_ID", "Press_Time", "Release_Time"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df.dropna(subset=["Press_Time", "Release_Time"])


def load_tie5_raw(folder: Path | str = EXTERNAL / "tie5_raw") -> list[dict]:
    frames = [read_tie5_csv(f) for f in sorted(Path(folder).glob("*_keystroke_raw.csv"))]
    if not frames:
        return []
    return tie5_frame_to_samples(pd.concat(frames, ignore_index=True))


# ---------------------------------------------------------------------------
# 3. Stress logger: one sample per self-report, from the preceding window
# ---------------------------------------------------------------------------

def logger_frames_to_samples(keys: pd.DataFrame, cond: pd.DataFrame, user: str,
                             window_min: float = 30.0, min_keys: int = 30) -> list[dict]:
    """
    keys: Key, Press_Time, Relase_Time (sic) as ISO strings.
    cond: Time, Fatigue_Val, PAM_Val, Stress_Val, Energy_Val, Pleasant_Val, Daylight.
    For each report at T, the sample is every keystroke in [T - window, T].
    """
    k = keys[keys["Key"] != "Key"].copy()                     # repeated header rows
    k["press"] = pd.to_datetime(k["Press_Time"], errors="coerce")
    k["release"] = pd.to_datetime(k["Relase_Time"], errors="coerce")
    k = k.dropna(subset=["press", "release"]).sort_values("press").reset_index(drop=True)
    if k.empty:
        return []
    t0 = k["press"].iloc[0]
    k["p_ms"] = (k["press"] - t0).dt.total_seconds() * 1000.0
    k["r_ms"] = (k["release"] - t0).dt.total_seconds() * 1000.0

    c = cond.copy()
    c["time"] = pd.to_datetime(c["Time"], errors="coerce")
    c = c.dropna(subset=["time"])

    out = []
    for row in c.itertuples(index=False):
        start = row.time - timedelta(minutes=window_min)
        w = k[(k["press"] >= start) & (k["press"] <= row.time)]
        if len(w) < min_keys:
            continue
        presses = list(zip(w["Key"].astype(str), w["p_ms"], w["r_ms"]))
        stress = str(row.Stress_Val)
        out.append({
            "user": user,
            "condition": "stress" if "Stressed" in stress else "calm",
            "prompt": "",
            "text": "",
            "events": _events(presses),
            "source": "stress_logger",
            "session": row.time.strftime("%Y-%m-%d"),
            "started_at": w["press"].iloc[0].isoformat(),
            "labels": {
                "fatigue": str(row.Fatigue_Val), "pam": _num(row.PAM_Val), "stress": stress,
                "energy": str(row.Energy_Val), "pleasant": str(row.Pleasant_Val),
                "daylight": str(row.Daylight), "report_time": row.time.isoformat(),
                "window_min": window_min,
            },
        })
    return out


def _num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def load_stress_logger(folder: Path | str = EXTERNAL / "stress_logger", **kw) -> list[dict]:
    out = []
    for d in sorted(Path(folder).glob("user_*")):
        keys = pd.read_csv(d / "keystrokes.tsv", sep="\t", usecols=["Key", "Press_Time", "Relase_Time"], dtype=str)
        cond = pd.read_csv(d / "usercondition.tsv", sep="\t", dtype=str)
        cond = cond.loc[:, ~cond.columns.str.startswith("Unnamed")]
        out += logger_frames_to_samples(keys, cond, user=f"logger_{d.name}", **kw)
    return out


# ---------------------------------------------------------------------------
# Staging from the downloaded zips (only the keystroke members; mouse logs stay)
# ---------------------------------------------------------------------------

def stage_from_zips(zip_dir: Path | str, dest: Path | str = EXTERNAL) -> list[str]:
    dest = Path(dest)
    staged = []
    for z in sorted(Path(zip_dir).glob("archive*.zip")):
        with zipfile.ZipFile(z) as zf:
            names = zf.namelist()
            if "DSL-StrongPasswordData.csv" in names:
                target = dest / "cmu_password"
                target.mkdir(parents=True, exist_ok=True)
                zf.extract("DSL-StrongPasswordData.csv", target)
                staged.append(f"{z.name} -> cmu_password")
            elif any(n.endswith("_keystroke_raw.csv") for n in names):
                target = dest / "tie5_raw"
                target.mkdir(parents=True, exist_ok=True)
                for n in names:
                    if n.endswith("_keystroke_raw.csv"):
                        zf.extract(n, target)
                staged.append(f"{z.name} -> tie5_raw")
            elif any(n.endswith("/keystrokes.tsv") for n in names):
                for n in names:
                    base = os.path.basename(n)
                    if base in ("keystrokes.tsv", "usercondition.tsv", "inactivity.tsv", "activewindows.tsv"):
                        user = os.path.basename(os.path.dirname(n)).replace(" ", "_")
                        target = dest / "stress_logger" / user
                        target.mkdir(parents=True, exist_ok=True)
                        (target / base).write_bytes(zf.read(n))
                staged.append(f"{z.name} -> stress_logger")
    return staged


LOADERS = {
    "cmu_password": load_cmu,
    "tie5_raw": load_tie5_raw,
    "stress_logger": load_stress_logger,
}


def _main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Convert external keystroke datasets into KeySign samples + features.")
    p.add_argument("--only", nargs="*", choices=list(LOADERS), help="subset of datasets")
    p.add_argument("--stage", metavar="ZIP_DIR", help="first extract keystroke files from archive*.zip in this folder")
    p.add_argument("--out", default=str(EXTERNAL), help="output folder (default data/external)")
    args = p.parse_args(argv)

    if args.stage:
        for line in stage_from_zips(args.stage, args.out):
            print("staged:", line)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for name in (args.only or LOADERS):
        try:
            samples = LOADERS[name]()
        except FileNotFoundError as e:
            print(f"{name}: not staged ({e.filename}), skipping", file=sys.stderr)
            continue
        if not samples:
            print(f"{name}: no samples", file=sys.stderr)
            continue
        df = samples_to_frame(samples)
        df.insert(1, "source", name)
        df.insert(4, "session", [s.get("session", "") for s in samples])
        (out / f"{name}_samples.json").write_text(json.dumps(samples), encoding="utf-8")
        df.to_csv(out / f"{name}_features.csv", index=False)
        print(f"{name}: {len(samples)} samples, {df['user'].nunique()} users, "
              f"conditions={df['condition'].value_counts().to_dict()}, "
              f"median keys/sample={df['n_keys'].median():.0f}  -> {name}_features.csv")
    return 0


if __name__ == "__main__":
    sys.exit(_main())
