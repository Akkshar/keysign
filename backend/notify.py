"""
Silent alert channel for the Threat head.

Every alert is appended to data/alerts.jsonl on this machine. If
KEYSIGN_NTFY_TOPIC is set, it is also pushed to a phone through ntfy
(https://ntfy.sh, free, no account: install the app, subscribe to the topic).
The push runs in a background thread so it can never stall the stream, and
carries only the alert kind, user label, distance and time, never keystrokes.
Every alert, of either kind, gets a webcam burst (the dashboard posts a frame
to /api/alerts/photo if it is open; otherwise backend/actions.py grabs one).
The backend checks the face against the owner's enrolled face
(backend/faces.py), grabs the screen, and only then decides what the alert
is (backend/actions.decide) and pushes it. Everything is stored in
data/alert_photos/; the webcam frame and the screen go to the phone only
when the final call is an intruder. A duress frame never leaves the machine:
the person at the keyboard is the victim.

    KEYSIGN_NTFY_TOPIC=keysign-duress-7f3k9      # required to push
    KEYSIGN_NTFY_SERVER=https://ntfy.sh          # optional, default
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
import urllib.request
from pathlib import Path

log = logging.getLogger("keysign.notify")

ROOT = Path(__file__).resolve().parent.parent
ALERT_LOG = ROOT / "data" / "alerts.jsonl"
PHOTO_DIR = ROOT / "data" / "alert_photos"      # webcam frames for intruder alerts (gitignored)
TIMEOUT_S = 5.0
PHOTO_TIMEOUT_S = 15.0


def enabled() -> bool:
    return bool(os.environ.get("KEYSIGN_NTFY_TOPIC"))


def channel() -> str:
    return "ntfy" if enabled() else "log-only"


channel_name = channel


def record(alert: dict, path: Path | str | None = None) -> None:
    path = Path(path or ALERT_LOG)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(alert) + "\n")


def photo_name(ts: float, session: str | None) -> str:
    safe = "".join(c for c in str(session or "s") if c.isalnum())[:16] or "s"
    return f"{int(ts)}_{safe}.jpg"


def save_photo(ts: float, session: str | None, data: bytes, photo_dir: Path | str | None = None,
               suffix: str = "") -> Path:
    d = Path(photo_dir or PHOTO_DIR)
    d.mkdir(parents=True, exist_ok=True)
    name = photo_name(ts, session)
    p = d / (name[:-4] + suffix + ".jpg" if suffix else name)
    p.write_bytes(data)
    return p


def save_verdict(ts: float, session: str | None, verdict: dict, photo_dir: Path | str | None = None) -> Path:
    """The face check result, next to the photo, so the alert log can show it later."""
    d = Path(photo_dir or PHOTO_DIR)
    d.mkdir(parents=True, exist_ok=True)
    p = d / (photo_name(ts, session)[:-4] + ".json")
    p.write_text(json.dumps(verdict), encoding="utf-8")
    return p


def recent(n: int = 20, path: Path | str | None = None, photo_dir: Path | str | None = None) -> list[dict]:
    path = Path(path or ALERT_LOG)
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").strip().splitlines()
    d = Path(photo_dir or PHOTO_DIR)
    out = []
    for line in lines[-n:]:
        try:
            a = json.loads(line)
        except json.JSONDecodeError:
            continue
        name = photo_name(a.get("ts", 0), a.get("session"))
        a["photo"] = name if (d / name).exists() else None
        screen = name[:-4] + "_screen.jpg"
        a["screen"] = screen if (d / screen).exists() else None
        verdict = d / (name[:-4] + ".json")
        try:
            a["face"] = json.loads(verdict.read_text(encoding="utf-8")) if verdict.exists() else None
        except (OSError, json.JSONDecodeError):
            a["face"] = None
        # The row was written the moment the alert fired, which on a thin window is often
        # before the classifier is sure. If it settled afterwards, show that read instead and
        # keep the first guess beside it (backend/actions.settle_identity).
        st = (a.get("face") or {}).get("identity_settled") or {}
        if st.get("confident") and st.get("user"):
            a["identity_at_alert"] = a.get("identity")
            a["identity"] = st["user"]
            a["identity_confidence"] = st.get("confidence")
            a["identity_settled"] = st
        out.append(a)
    return out


def send_photo(alert: dict, photo_path: Path | str, title: str, message: str) -> dict:
    """Push an image for an intruder alert as an attachment (background thread)."""
    if not enabled():
        return {"sent": False, "channel": "log-only"}
    threading.Thread(target=_push_photo_safely, args=(alert, Path(photo_path), title, message), daemon=True).start()
    return {"sent": True, "channel": "ntfy"}


def _push_photo_safely(alert: dict, photo_path: Path, title: str, message: str) -> None:
    try:
        _post_photo(alert, photo_path, title, message)
    except Exception as e:
        log.warning("ntfy photo push failed: %s", e)


def _post_photo(alert: dict, photo_path: Path, title: str, message: str) -> None:
    topic = os.environ["KEYSIGN_NTFY_TOPIC"]
    server = os.environ.get("KEYSIGN_NTFY_SERVER", "https://ntfy.sh").rstrip("/")
    req = urllib.request.Request(f"{server}/{topic}", data=photo_path.read_bytes(), method="PUT",
                                 headers={"Title": title, "Message": message, "Filename": photo_path.name,
                                          "Priority": "urgent", "Tags": "camera"})
    with urllib.request.urlopen(req, timeout=PHOTO_TIMEOUT_S) as r:
        r.read()


def send(alert: dict, path: Path | str | None = None, push: bool = True) -> dict:
    """
    Log always; push in the background if configured and `push`. Intruder alerts pass
    push=False: backend/actions.py pushes them after the webcam has had its say, so an
    owner who merely typed oddly never buzzes the phone. Returns what was done.
    """
    record(alert, path)
    if not enabled():
        return {"sent": False, "channel": "log-only"}
    if not push:
        return {"sent": None, "channel": "ntfy", "reason": "pending the camera check"}
    threading.Thread(target=_push_safely, args=(alert,), daemon=True).start()
    return {"sent": True, "channel": "ntfy"}


def push_alert(alert: dict, why: str = "") -> dict:
    """Push a previously recorded alert (the deferred intruder path)."""
    if not enabled():
        return {"sent": False, "channel": "log-only"}
    a = dict(alert)
    if why:
        a["why"] = why
    threading.Thread(target=_push_safely, args=(a,), daemon=True).start()
    return {"sent": True, "channel": "ntfy"}


def mark_delivery(alert: dict, pushed: bool, reason: str, photo_dir: Path | str | None = None,
                  kind: str | None = None, channel: str | None = None, sent: bool | None = None,
                  settled: dict | None = None) -> None:
    """
    Write the final decision next to the alert's photo verdict so the log can show it:
    `pushed` is what the decision said to do, `sent` whether a phone channel actually took it
    (False with no KEYSIGN_NTFY_TOPIC: the alert is real, it just stayed in the local log).
    """
    d = Path(photo_dir or PHOTO_DIR)
    d.mkdir(parents=True, exist_ok=True)
    p = d / (photo_name(alert.get("ts", 0), alert.get("session"))[:-4] + ".json")
    try:
        cur = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    except (OSError, json.JSONDecodeError):
        cur = {}
    cur.update({"pushed": bool(pushed), "reason": reason, "final_kind": kind, "decided_at": time.time(),
                "channel": channel or channel_name(), "sent": bool(sent)})
    if settled:
        cur["identity_settled"] = settled
    p.write_text(json.dumps(cur), encoding="utf-8")


def _push_safely(alert: dict) -> None:
    try:
        _post(alert)
    except Exception as e:                      # offline / bad topic: the local log still has it
        log.warning("ntfy push failed: %s", e)


def _post(alert: dict) -> None:
    topic = os.environ["KEYSIGN_NTFY_TOPIC"]
    server = os.environ.get("KEYSIGN_NTFY_SERVER", "https://ntfy.sh").rstrip("/")
    kind = alert.get("kind", "alert")
    title = "KeySign: possible intruder" if kind == "intruder" else "KeySign: possible duress"
    load = alert.get("load")
    who = alert.get("identity")
    named = f" · typing reads as {who}" if who and who != alert.get("user") else ""
    body = (f"{alert.get('user', '?')} · {kind}{named} · {float(alert.get('distance') or 0):.1f}σ from baseline for "
            f"{alert.get('sustained_ticks', 0)} ticks"
            + (f" · load {round(float(load) * 100)}/100" if isinstance(load, (int, float)) else "")
            + f" · {time.strftime('%H:%M:%S', time.localtime(alert.get('ts', time.time())))}"
            + (f" · {alert['why']}" if alert.get("why") else ""))
    req = urllib.request.Request(f"{server}/{topic}", data=body.encode("utf-8"), method="POST",
                                 headers={"Title": title, "Priority": "high" if kind == "duress" else "urgent",
                                          "Tags": "rotating_light" if kind == "duress" else "bust_in_silhouette"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
        r.read()
