"""
What happens on the machine when an intruder alert fires, beyond the phone push.

    settings()            -> data/settings.json (lock_on_intruder, declared_user, ...)
    on_alert(alert)       -> schedules: webcam fallback if no photo arrives, then the lock

Webcam fallback: the dashboard posts a frame when it is open; in background
mode nothing is, so after PHOTO_GRACE_S the backend grabs one itself with
OpenCV and runs the same face check / screen snapshot / push path as the
POST endpoint. Lock: Windows' own lock screen (LockWorkStation), after the
photo so the camera frame is taken first. Duress never locks: the person at
the keyboard is the victim and the alert must stay silent.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from pathlib import Path

log = logging.getLogger("keysign.actions")

ROOT = Path(__file__).resolve().parent.parent
SETTINGS_PATH = ROOT / "data" / "settings.json"
DEFAULTS = {"lock_on_intruder": os.environ.get("KEYSIGN_LOCK_ON_INTRUDER", "1") != "0",
            "declared_user": "", "photo_on_intruder": True}
PHOTO_GRACE_S = 1.5          # wait this long for the dashboard's frame before grabbing one ourselves
LOCK_DELAY_S = 2.5           # lock after the frame and the screen snapshot are taken

_photo_seen: set[float] = set()          # alert ts that already got a photo (from the dashboard or us)
_lock = threading.Lock()


# ---- settings ----
def settings() -> dict:
    try:
        d = json.loads(SETTINGS_PATH.read_text(encoding="utf-8")) if SETTINGS_PATH.exists() else {}
    except json.JSONDecodeError:
        d = {}
    return {**DEFAULTS, **d}


def update_settings(changes: dict) -> dict:
    d = settings()
    for k, v in changes.items():
        if k in DEFAULTS:
            d[k] = v
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps({k: d[k] for k in DEFAULTS}, indent=1), encoding="utf-8")
    return d


# ---- the lock ----
def lock_workstation() -> bool:
    """Windows lock screen. Returns False on other platforms or failure; never raises."""
    try:
        import ctypes
        return bool(ctypes.windll.user32.LockWorkStation())
    except Exception as e:
        log.warning("lock failed: %s", e)
        return False


# ---- webcam fallback ----
def grab_webcam(index: int = 0, warmup_frames: int = 5) -> bytes | None:
    """One JPEG from the default camera, or None (no camera, in use, headless)."""
    try:
        import cv2
        cap = cv2.VideoCapture(index)
        if not cap.isOpened():
            return None
        frame = None
        for _ in range(warmup_frames):                 # let exposure settle
            ok, frame = cap.read()
            if not ok:
                frame = None
                break
        cap.release()
        if frame is None:
            return None
        ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        return bytes(buf) if ok else None
    except Exception as e:
        log.warning("webcam grab failed: %s", e)
        return None


def photo_arrived(ts: float) -> None:
    """The POST /api/alerts/photo path calls this so the fallback does not double up."""
    with _lock:
        _photo_seen.add(round(float(ts), 3))


def _seen(ts: float) -> bool:
    with _lock:
        return round(float(ts), 3) in _photo_seen


def on_alert(alert: dict, process_photo) -> None:
    """
    Called by the app when an alert is raised. `process_photo(alert, jpeg)` is the
    shared face-check + screen + push routine. Runs in a background thread.
    """
    if alert.get("kind") != "intruder":
        return
    cfg = settings()

    def run():
        try:
            if cfg.get("photo_on_intruder", True):
                time.sleep(PHOTO_GRACE_S)
                if not _seen(alert["ts"]):
                    jpeg = grab_webcam()
                    if jpeg:
                        photo_arrived(alert["ts"])
                        process_photo(alert, jpeg, source="backend-webcam")
            if cfg.get("lock_on_intruder"):
                time.sleep(LOCK_DELAY_S)
                log.warning("intruder alert on %s's session: locking the workstation", alert.get("user"))
                lock_workstation()
        except Exception as e:
            log.exception("alert actions failed: %s", e)

    threading.Thread(target=run, daemon=True, name="keysign-alert-actions").start()
