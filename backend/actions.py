"""
What happens on the machine when the Threat head raises an alert, beyond the log.

    settings()            -> data/settings.json (lock_on_intruder, declared_user, ...)
    decide(alert, verdict)-> the final call: kind, push?, lock?, images?, why
    on_alert(alert)       -> camera burst (unless the dashboard sent a frame), decide, push, toast, lock

The camera is the second factor for EVERY alert kind. The typing says "this
is not the owner" (intruder) or "the owner, but far off and under load"
(duress); the webcam then looks at who is actually in the chair
(backend/faces.py) and the two are combined:

    typing    camera         final      push   lock   images to the phone
    intruder  someone else   intruder   yes    yes    frame + screen
    intruder  the owner *    duress     yes    no     no      the owner under pressure, not an impostor
    intruder  the owner      (none)     no     no     no      owner typing oddly: kept local
    intruder  no say         intruder   yes    yes    frame if any + screen
    duress    someone else   intruder   yes    NO     frame + screen     typing and camera disagree: alert, don't lock
    duress    the owner      duress     yes    no     no      camera confirms the victim is the owner
    duress    no say         duress     yes    no     no

  * with alert["duress_ready"]: the duress clock was full too (6 ticks over 3 sigma AND at or
    above this person's high-load cut-off). Real duress reaches the Threat head as "intruder":
    typing under pressure drifts far enough that the identity classifier loses confidence, and
    low confidence is positive evidence of another person. Measured 2026-09-07 by replaying the
    owner's own calm samples sped up 1.7-2.5x through the real models: identity named a teammate
    at 0.67-0.73 confidence on every window, so the head called it an intruder while the load
    gate was full. Without this row the camera would then keep it local and a real duress alert
    would never leave the machine.

"No say": no camera, no face in the burst, owner not enrolled, or a face the
engine cannot place (turned away). Duress never pushes the frame: the person
at the keyboard is the victim. The lock needs the typing's word too: a typist
looking straight down at the keys scores like a stranger to the face model
(measured 0.17 on the owner), so the camera alone never locks the owner out.
The lock is Windows' own (LockWorkStation), after the frame and the screen
snapshot. Tray notification (the desktop agent's TOAST_HOOK) for every final
alert, so the owner sees it in the corner of the screen and never as a window
in front of their typing.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Callable

log = logging.getLogger("keysign.actions")

ROOT = Path(__file__).resolve().parent.parent
SETTINGS_PATH = ROOT / "data" / "settings.json"
DEFAULTS = {"lock_on_intruder": os.environ.get("KEYSIGN_LOCK_ON_INTRUDER", "1") != "0",
            "declared_user": "",
            "photo_on_intruder": True,        # camera burst on every alert kind (name kept for the dashboard's setting)
            "toast_on_alert": True}           # tray notification in the corner for every final alert
PHOTO_GRACE_S = float(os.environ.get("KEYSIGN_PHOTO_GRACE_S", "1.5"))
                             # how long to wait for a frame from the dashboard before opening the camera
                             # ourselves. The wait ends the moment that frame's face check lands, so an
                             # open dashboard decides the alert in well under a second and the machine's
                             # own camera never opens. The env var is for tests and slow cameras.
PHOTO_SETTLE_S = 1.5         # extra wait when a dashboard frame is in flight but its face check has not landed
LOCK_DELAY_S = 2.5           # lock after the frame and the screen snapshot are taken

_photo_seen: set[float] = set()          # alert ts that already got a photo (from the dashboard or us)
_lock = threading.Lock()
_camera_lock = threading.Lock()          # only one thread may hold the webcam
_last_burst: tuple[float, list[bytes]] = (0.0, [])
BURST_REUSE_S = 6.0                      # a burst this fresh is handed to the next alert instead of
                                         # reopening the camera

QUIT_HOOK = None                                        # the desktop agent registers its shutdown here
TOAST_HOOK: Callable[[str, str], None] | None = None    # the desktop agent registers icon.notify here


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


# ---- webcam ----
def grab_webcam_burst(n: int = 5, gap_s: float = 0.35, index: int = 0, warmup_frames: int = 8) -> list[bytes]:
    """
    Several JPEGs from the default camera, gap_s apart, after a warm-up so exposure has
    settled. [] if there is no camera / it is in use. One frame is not enough: the typist
    looks down at the keys most of the time.

    Serialised, and a burst younger than BURST_REUSE_S is handed to the next caller instead
    of opening the camera again. Two alerts can land within a fraction of a second of each
    other (the agent scores every application while a dashboard scores its own window), and
    when both reached for the camera at once neither got a frame: measured 2026-09-07, a real
    intruder alert went to the phone with no photo and no screen because of exactly that.
    """
    global _last_burst
    with _camera_lock:
        now = time.time()
        when, frames = _last_burst
        if frames and now - when < BURST_REUSE_S:
            log.info("reusing the webcam burst from %.1fs ago", now - when)
            return frames
        try:
            import cv2
            cap = cv2.VideoCapture(index)
            if not cap.isOpened():
                log.warning("no camera, or it is in use by another application")
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
            if out:
                _last_burst = (time.time(), out)
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


def face_verdict(alert: dict) -> dict | None:
    """The stored face-check result for this alert, if a frame was processed."""
    try:
        from backend import notify
        p = notify.PHOTO_DIR / (notify.photo_name(alert["ts"], alert.get("session"))[:-4] + ".json")
        v = json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
        return v if isinstance(v, dict) and "face" in v else None       # a delivery note alone is not a verdict
    except Exception:
        return None


def await_dashboard_frame(alert: dict, grace: float | None = None) -> dict | None:
    """
    Wait for a webcam frame posted by an open dashboard, up to `grace` seconds, and return its
    face verdict. Returns as soon as the verdict is on disk, so the usual case (a dashboard is
    open) decides in a few hundred milliseconds instead of always waiting out the grace. A
    frame whose POST is still being face-checked when the grace runs out gets a moment longer,
    so the machine never opens its own camera on top of one that is already in flight.
    """
    deadline = time.time() + (PHOTO_GRACE_S if grace is None else grace)
    while time.time() < deadline:
        v = face_verdict(alert)
        if v is not None:
            return v
        time.sleep(0.05)
    if _seen(alert["ts"]):
        settle = time.time() + PHOTO_SETTLE_S
        while time.time() < settle:
            v = face_verdict(alert)
            if v is not None:
                return v
            time.sleep(0.05)
    return None


# ---- the decision ----
def decide(alert: dict, verdict: dict | None) -> dict:
    """
    Combine what the typing said (alert["kind"]) with what the camera saw. See the
    table in the module docstring. Returns {"kind", "push", "lock", "images", "why"}.
    """
    typed = alert.get("kind") or "duress"
    m = (verdict or {}).get("match")
    sim = (verdict or {}).get("similarity")
    seen = f" ({sim:.2f})" if isinstance(sim, (int, float)) else ""
    if m is False:
        if typed == "duress":
            return {"kind": "intruder", "push": True, "lock": False, "images": True,
                    "why": "camera: not the owner at the keyboard" + seen + "; the typing had said duress, so no lock"}
        return {"kind": "intruder", "push": True, "lock": True, "images": True, "why": "camera: not the owner at the keyboard" + seen}
    if m is True:
        if typed == "duress":
            return {"kind": "duress", "push": True, "lock": False, "images": False,
                    "why": "camera: the owner is at the keyboard" + seen + "; the typing is off under load"}
        if alert.get("duress_ready"):
            return {"kind": "duress", "push": True, "lock": False, "images": False,
                    "why": "camera: the owner is at the keyboard" + seen + "; the typing said intruder but the "
                           "duress clock was full too, so this is the owner under pressure"}
        return {"kind": None, "push": False, "lock": False, "images": False,
                "why": "face matched the owner" + seen + ": the owner typing oddly, kept local"}
    # the camera had no say
    if verdict is None:
        why = "no camera frame"
    elif verdict.get("face") is False:
        why = "no face in frame"
    elif not verdict.get("enrolled"):
        why = "owner face not enrolled"
    else:
        why = verdict.get("reason") or "camera unsure"
    if typed == "intruder":
        named_other = bool(alert.get("identity")) and alert.get("identity") != alert.get("user")
        why = (f"typing identified as {alert.get('identity')}" if named_other else "typing did not match the owner") + f"; {why}"
        return {"kind": "intruder", "push": True, "lock": True, "images": True, "why": why}
    return {"kind": "duress", "push": True, "lock": False, "images": False, "why": f"typing far off under load; {why}"}


def should_lock(alert: dict, verdict: dict | None) -> tuple[bool, str]:
    """Kept for callers that only want the lock decision."""
    d = decide(alert, verdict)
    return bool(d["lock"]), d["why"]


def toast(title: str, message: str) -> bool:
    """Tray notification through the desktop agent, if one is running and the setting is on."""
    if TOAST_HOOK is None or not settings().get("toast_on_alert", True):
        return False
    try:
        TOAST_HOOK(title, message)
        return True
    except Exception as e:
        log.warning("toast failed: %s", e)
        return False


def _toast_text(alert: dict, d: dict) -> tuple[str, str]:
    dist = float(alert.get("distance") or 0)
    when = time.strftime("%H:%M:%S", time.localtime(alert.get("ts", time.time())))
    if d["kind"] == "intruder":
        return "KeySign: someone else at the keyboard", f"{when} · {d['why']}" + (" · locking" if d["lock"] else "")
    return "KeySign: possible duress", f"{when} · {alert.get('user', '?')} typing {dist:.1f}σ from calm under high load · {d['why']}"


def on_alert(alert: dict, process_photo) -> None:
    """
    Called by the app when an alert of either kind is raised. `process_photo(alert, jpeg,
    source, verdict)` is the shared store + face-check + screen routine (backend/app.py).
    Runs in a background thread: camera burst (unless the dashboard already posted a
    frame), decision, push, tray notification, lock.
    """
    if alert.get("kind") not in ("intruder", "duress"):
        return
    cfg = settings()

    def run():
        from backend import notify
        try:
            verdict = None
            if cfg.get("photo_on_intruder", True):
                verdict = await_dashboard_frame(alert)
                if verdict is None and not _seen(alert["ts"]):
                    frames = grab_webcam_burst()
                    if frames:
                        from backend import faces
                        photo_arrived(alert["ts"])
                        verdict, best = faces.verify_frames(alert.get("user") or "", frames)
                        res = process_photo(alert, best or frames[-1], source="backend-webcam", verdict=verdict)
                        verdict = (res or {}).get("face") if isinstance(res, dict) else verdict
                    else:
                        # No camera, or it was busy. The screen still goes out: an intruder alert
                        # with nothing attached tells whoever gets it far too little.
                        process_photo(alert, None, source="backend-no-frame", verdict=None)
                if verdict is None:
                    verdict = face_verdict(alert)
            d = decide(alert, verdict)
            final = {**alert, "kind": d["kind"] or alert.get("kind"), "typed_kind": alert.get("kind")}
            res = {}
            if d["push"]:
                res = notify.push_alert(final, d["why"]) or {}
                log.warning("%s alert on %s's session: %s; pushed (%s)", final["kind"], alert.get("user"),
                            d["why"], res.get("channel"))
            else:
                log.warning("alert on %s's session: %s; kept local", alert.get("user"), d["why"])
            notify.mark_delivery(alert, pushed=bool(d["push"]), reason=d["why"], kind=d["kind"],
                                 channel=res.get("channel") or notify.channel(), sent=bool(res.get("sent")))
            if d["push"]:
                toast(*_toast_text(final, d))
            if cfg.get("lock_on_intruder") and d["lock"]:
                time.sleep(LOCK_DELAY_S)
                log.warning("locking the workstation")
                lock_workstation()
        except Exception as e:
            log.exception("alert actions failed: %s", e)

    threading.Thread(target=run, daemon=True, name="keysign-alert-actions").start()
