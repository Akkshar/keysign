"""
Enrolling a person from the dashboard, without a terminal.

The calibration wizard (ui/src/components/onboarding/CalibrationWizard.tsx) records ten
sentences, five typed calmly and five typed under pressure, and posts them here as
capture-shaped samples. This turns them into everything the heads need:

    samples -> data/samples/enrolled_<slug>.json      (kept, so a rebuild includes them)
            -> features                               (pipeline.features)
            -> data/baselines/<slug>.json             (calm samples only, pipeline.baseline)
            -> that baseline's State cut-offs         (calm vs stress, pipeline.state)
            -> the identity model, retrained          (in the background: it takes ~20 s)

The baseline is what the Threat and State heads measure against, so it exists the moment
the wizard finishes. The identity model has to be retrained across everyone, which is
slower, so it runs in a thread and `status()` reports it; until it lands, the Identity head
calls the new person unknown, which is the honest answer.

Ten sentences is not many. Five calm samples clears pipeline.baseline's minimum of three,
and the spread it measures is wide because a first calibration is nervous typing; the
`spread` in the summary says how tight it actually was, in sigma.
"""
from __future__ import annotations

import json
import logging
import shutil
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.baseline import Baseline, build_baseline, _slug
from pipeline.features import extract_features, samples_to_frame

log = logging.getLogger("keysign.enrol")

ROOT = Path(__file__).resolve().parent.parent
SAMPLES_DIR = ROOT / "data" / "samples"
BASELINE_DIR = ROOT / "data" / "baselines"
WINDOWS_CSV = ROOT / "data" / "features_windows.csv"

MIN_CALM = 3               # pipeline.baseline's minimum for a median/MAD baseline
MIN_KEYS = 20              # a sentence shorter than this is not worth a sample
MAX_SAMPLES = 40

_status: dict = {"state": "idle", "user": None, "message": "", "at": 0.0}
_status_lock = threading.Lock()

# While someone is calibrating, the machine must not act on what they type. They are typing
# ten sentences under the last person's name, at speed, on purpose: that is exactly what the
# Threat head is built to notice, and an intruder alert in the middle of a reviewer's
# calibration would lock the laptop in front of them.
CALIBRATION_WINDOW_S = 3 * 60      # the page refreshes this every minute while it is open, so a
                                   # window someone walked away from starts watching again quickly
_calibrating_until = 0.0


def set_calibrating(on: bool, seconds: float = CALIBRATION_WINDOW_S) -> float:
    """Hold alerts off while the wizard is open. Expires on its own if the page goes away."""
    global _calibrating_until
    _calibrating_until = (time.time() + seconds) if on else 0.0
    log.info("calibration mode %s", "on" if on else "off")
    return _calibrating_until


def is_calibrating() -> bool:
    return time.time() < _calibrating_until


def status() -> dict:
    with _status_lock:
        return dict(_status)


def _set_status(**kw) -> None:
    with _status_lock:
        _status.update({**kw, "at": time.time()})


def samples_path(user: str) -> Path:
    return SAMPLES_DIR / f"enrolled_{_slug(user)}.json"


def to_capture_samples(user: str, raw: list[dict]) -> list[dict]:
    """The wizard's steps -> the same shape the capture page exports."""
    out = []
    for i, s in enumerate(raw):
        events = [e for e in (s.get("events") or [])
                  if e.get("type") in ("down", "up") and isinstance(e.get("t"), (int, float))]
        events.sort(key=lambda e: e["t"])
        if not events:
            continue
        t0 = events[0]["t"]
        events = [{"type": e["type"], "key": str(e.get("key", ""))[:12],
                   "code": str(e.get("code", ""))[:24], "t": round(float(e["t"]) - t0, 3)} for e in events]
        n_down = sum(1 for e in events if e["type"] == "down")
        if n_down < MIN_KEYS:
            continue
        out.append({
            "id": f"cal_{_slug(user)}_{int(time.time())}_{i}",
            "user": user,
            "condition": "stress" if str(s.get("condition")) == "stress" else "calm",
            "prompt": str(s.get("prompt", ""))[:400],
            "text": "",                                  # the typed text is never kept
            "events": events,
            "started_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "duration_ms": events[-1]["t"],
            "n_events": len(events),
            "n_keydowns": n_down,
            "meta": {"page_version": "calibration-wizard"},
        })
    return out[:MAX_SAMPLES]


def store_samples(user: str, samples: list[dict]) -> Path:
    """Keep them next to the team's other exports, so `pipeline.rebuild` picks them up."""
    p = samples_path(user)
    p.parent.mkdir(parents=True, exist_ok=True)
    existing = []
    if p.exists():
        try:
            existing = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = []
    p.write_text(json.dumps(existing + samples), encoding="utf-8")
    return p


def summarise(user: str, df: pd.DataFrame, baseline: Baseline) -> dict:
    """The numbers the wizard shows at the end. Measured, not decorative."""
    calm = df[df["condition"] == "calm"]
    stress = df[df["condition"] == "stress"]
    d = baseline.distance(calm[baseline.features].to_numpy(dtype=float))
    out = {
        "user": user,
        "calm_samples": int(len(calm)),
        "stress_samples": int(len(stress)),
        "hold_mean_ms": round(float(calm["hold_mean"].mean()), 1),
        "flight_mean_ms": round(float(calm["flight_mean"].mean()), 1),
        "speed_kps": round(float(calm["speed_kps"].mean()), 2),
        # how tightly the calm samples sit around their own baseline: ~1 sigma is typical
        "spread": round(float(np.median(np.atleast_1d(d))), 2),
    }
    if len(stress):
        hold_s = float(stress["hold_mean"].mean())
        out["stress_hold_mean_ms"] = round(hold_s, 1)
        out["stress_hold_change_pct"] = round(100 * (hold_s - out["hold_mean_ms"]) / max(out["hold_mean_ms"], 1e-6))
        out["stress_speed_kps"] = round(float(stress["speed_kps"].mean()), 2)
    return out


def calibrate_state(user: str, df: pd.DataFrame, baseline: Baseline, path: Path) -> dict | None:
    """
    This person's own deep-focus / high-load cut-offs, from their calm and stress samples.
    The same rule as `pipeline.state calibrate`, on ten samples instead of hundreds of
    windows: rough, but far better than the team-wide default for someone new.
    """
    from pipeline.state import THRESHOLD_FLOOR, Z_CLIP, rule_load

    calm = df[df["condition"] == "calm"]
    stress = df[df["condition"] == "stress"]
    if len(calm) < MIN_CALM:
        return None

    def loads(rows: pd.DataFrame) -> np.ndarray:
        if not len(rows):
            return np.array([])
        Z = np.clip(baseline.zscores(rows[baseline.features].to_numpy(dtype=float)), -Z_CLIP, Z_CLIP)
        return np.asarray([rule_load(dict(zip(baseline.features, r))) for r in np.atleast_2d(Z)])

    lc, ls = loads(calm), loads(stress)
    focus_below = float(max(THRESHOLD_FLOOR, np.quantile(lc, 0.30)))
    load_above = float(np.quantile(lc, 0.85))
    if len(ls):
        load_above = max(load_above, float((np.median(lc) + np.median(ls)) / 2))
    load_above = float(max(load_above, focus_below + 2 * THRESHOLD_FLOOR))
    baseline.state = {"focus_below": round(focus_below, 3), "load_above": round(load_above, 3),
                      "calibrated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                      "note": f"calibration wizard: {len(lc)} calm / {len(ls)} stress samples"}
    baseline.save(path)
    return baseline.state


MODEL_PATH = ROOT / "data" / "models" / "identity.joblib"
ACCURACY_DROP_ALLOWED = 0.03      # a new class may cost a point or two; more than this is a worse model


def model_accuracy(path: Path = MODEL_PATH) -> float | None:
    try:
        from pipeline.identity import IdentityModel
        return IdentityModel.load(path).cv_accuracy
    except Exception:
        return None


def retrain_identity(user: str) -> None:
    """
    Rebuild the window features over every sample file and retrain the identity model, so the
    new person is recognised rather than reported unknown. Minutes of typing is thin next to
    the team's hundreds of samples, so their confidence will be lower than the team's at first.

    The model in use is kept aside first and put back if the retrained one is more than
    ACCURACY_DROP_ALLOWED worse on held-out samples. Enrolling somebody must never quietly
    make the machine worse at recognising everyone else. Runs in a thread; never raises.
    """
    def run():
        _set_status(state="training", user=user, message="teaching the identity model this typist")
        before = model_accuracy()
        backup = MODEL_PATH.with_name(MODEL_PATH.name + ".before-enrol")
        try:
            if MODEL_PATH.exists():
                shutil.copy2(MODEL_PATH, backup)
        except Exception:
            backup = None
        try:
            inputs = [str(p) for p in [
                ROOT / "keystrokes (1).json",
                SAMPLES_DIR / "all_new_page.json",
                SAMPLES_DIR / "strangers.json",
                SAMPLES_DIR / "live_turns.json",
            ] if p.exists()]
            inputs += [str(p) for p in sorted(SAMPLES_DIR.glob("enrolled_*.json"))]
            if not inputs:
                _set_status(state="error", message="no samples on this machine to train from")
                return
            r = subprocess.run([sys.executable, "-m", "pipeline.features", *inputs, "--windows",
                                "-o", str(WINDOWS_CSV)], cwd=str(ROOT), capture_output=True, text=True, timeout=600)
            if r.returncode != 0:
                _set_status(state="error", message=f"feature windows failed: {r.stderr[-200:]}")
                return
            r = subprocess.run([sys.executable, "-m", "pipeline.identity", "train", str(WINDOWS_CSV)],
                               cwd=str(ROOT), capture_output=True, text=True, timeout=900)
            if r.returncode != 0:
                _set_status(state="error", message=f"identity training failed: {r.stderr[-200:]}")
                return
            after = model_accuracy()
            if before is not None and after is not None and after < before - ACCURACY_DROP_ALLOWED:
                if backup and backup.exists():
                    shutil.copy2(backup, MODEL_PATH)
                    msg = (f"kept the previous identity model: retraining with {user} scored "
                           f"{after:.0%} against {before:.0%}")
                else:
                    msg = f"identity accuracy fell to {after:.0%} from {before:.0%} and there was no model to put back"
                log.warning("%s", msg)
                _set_status(state="ready", user=user, message=msg)
                return
            _set_status(state="ready", user=user,
                        message=(f"identity model retrained, {after:.0%} on held-out samples" if after is not None
                                 else "identity model retrained"))
            log.info("identity model retrained for %s (%s -> %s)", user, before, after)
        except Exception as e:                                  # never take the backend down for this
            log.exception("identity retraining failed")
            _set_status(state="error", message=str(e)[:200])

    threading.Thread(target=run, daemon=True, name="keysign-enrol-train").start()


def enrol(user: str, raw_samples: list[dict], train: bool = True) -> dict:
    """
    Turn a wizard run into a working profile. Raises ValueError with a plain sentence when
    there is not enough to build one.
    """
    user = (user or "").strip()
    if not user or len(user) > 64:
        raise ValueError("A name is needed for the profile (up to 64 characters).")
    samples = to_capture_samples(user, raw_samples)
    calm = [s for s in samples if s["condition"] == "calm"]
    if len(calm) < MIN_CALM:
        raise ValueError(f"{len(calm)} calm sentences came through with at least {MIN_KEYS} keys; "
                         f"{MIN_CALM} are needed. Type the calm sentences in full and try again.")
    _set_status(state="building", user=user, message="building the baseline")
    store_samples(user, samples)
    df = samples_to_frame(samples)
    baseline = build_baseline(df, user, condition="calm", min_samples=MIN_CALM)
    path = BASELINE_DIR / f"{_slug(user)}.json"
    baseline.save(path)
    state = calibrate_state(user, df, baseline, path)
    summary = summarise(user, df, baseline)
    summary["state"] = state
    summary["baseline"] = str(path.relative_to(ROOT))
    if train:
        retrain_identity(user)
    else:
        _set_status(state="ready", user=user, message="baseline built")
    set_calibrating(False)                                  # the machine watches again
    return summary
