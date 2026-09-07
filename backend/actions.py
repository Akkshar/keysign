"""
What happens on the machine when an intruder alert fires, beyond the phone push.

    settings()            -> data/settings.json (lock_on_intruder, declared_user, ...)
    on_alert(alert)       -> schedules: webcam fallback if no photo arrives, then the lock

Webcam fallback: the dashboard posts a frame when it is open; in background
mode nothing is, so after PHOTO_GRACE_S the backend grabs one itself with
OpenCV and runs the same face check / screen snapshot / push path as the
POST endpoint. Lock: Windows' own lock screen (LockWorkStation), after the
photo so the camera frame is taken first, and only if the face check does
not say "this is the owner" (should_lock). Duress never locks: the person
at the keyboard is the victim and the alert must stay silent.
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
def grab_webcam_burst(n: int = 5, gap_s: float = 0.35, index: int = 0, warmup_frames: int = 8) -> list[bytes]:
    """
    Several JPEGs from the default camera, gap_s apart, after a warm-up so exposure has
    settled. [] if there is no camera / it is in use. One frame is not enough: the
    typist looks down at the keys most of the time.
    """
    try:
        import cv2
        cap = cv2.VideoCapture(index)
        if not cap.isOpened():
            return []
        out: list[bytes] = []
        for _ in range(warmup_frames):
            cap.read()
        for i in range(n):
            ok, frame = cap.read()
            if ok and frame is not None:
                ok2, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                if ok2:
                    out.append(bytes(buf))
            if i < n - 1:
                time.sleep(gap_s)
        cap.release()
        return out
    except Exception as e:
        log.warning("webcam grab failed: %s", e)
        return []


def grab_webcam(index: int = 0, warmup_frames: int = 8) -> bytes | None:
    """One JPEG (the burst's first), kept for callers that want a single frame."""
    frames = grab_webcam_burst(n=1, index=index, warmup_frames=warmup_frames)
    return frames[0] if frames else None


def photo_arrived(ts: float) -> None:
    """The POST /api/alerts/photo path calls this so the fallback does not double up."""
    with _lock:
        _photo_seen.add(round(float(ts), 3))


def _seen(ts: float) -> bool:
    with _lock:
        return round(float(ts), 3) in _photo_seen


QUIT_HOOK = None          # the desktop agent registers its shutdown here (POST /api/agent/quit, --quit)


def face_verdict(alert: dict) -> dict | None:
    """The stored face-check result for this alert, if a frame was processed."""
    try:
        from backend import notify
        p = notify.PHOTO_DIR / (notify.photo_name(alert["ts"], alert.get("session"))[:-4] + ".json")
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
    except Exception:
        return None


def should_lock(alert: dict, verdict: dict | None) -> tuple[bool, str]:
    """
    Lock only on positive evidence of another person. The webcam is the second
    factor: a frame that matches the enrolled owner vetoes the lock even when the
    typing said intruder; a frame that does not match confirms it. No frame or no
    enrolment: go with the typing.
    """
    if verdict and verdict.get("match") is True:
        return False, "face matched the owner"
    if verdict and verdict.get("match") is False:
        return True, "face does not match the owner"
    named_other = bool(alert.get("identity")) and alert.get("identity") != alert.get("user")
    if named_other:
        return True, f"typing identified as {alert.get('identity')}"
    return True, "typing did not match the owner"


def on_alert(alert: dict, process_photo) -> None:
    """
    Called by the app when an alert is raised. `process_photo(alert, jpeg)` is the
    shared face-check + screen + push routine. Runs in a background thread.
    """
    if alert.get("kind") != "intruder":
        return
    cfg = settings()

    def run():
        from backend import notify
        try:
            verdict = None
            if cfg.get("photo_on_intruder", True):
                time.sleep(PHOTO_GRACE_S)
                if not _seen(alert["ts"]):
                    frames = grab_webcam_burst()
                    if frames:
                        from backend import faces
                        photo_arrived(alert["ts"])
                        verdict, best = faces.verify_frames(alert.get("user") or "", frames)
                        res = process_photo(alert, best or frames[-1], source="backend-webcam", verdict=verdict)
                        verdict = (res or {}).get("face") if isinstance(res, dict) else verdict
                if verdict is None:
                    verdict = face_verdict(alert)
            # The intruder alert itself is pushed only now, after the camera has had its say.
            lock, why = should_lock(alert, verdict)
            if lock:
                notify.push_alert(alert, why)
                log.warning("intruder alert on %s's session: %s; pushed", alert.get("user"), why)
            else:
                log.warning("intruder alert on %s's session: %s; alert kept local", alert.get("user"), why)
            notify.mark_delivery(alert, pushed=lock, reason=why)
            if cfg.get("lock_on_intruder") and lock:
                time.sleep(LOCK_DELAY_S)
                log.warning("locking the workstation")
                lock_workstation()
        except Exception as e:
            log.exception("alert actions failed: %s", e)

    threading.Thread(target=run, daemon=True, name="keysign-alert-actions").start()
