"""
Silent alert channel for the Threat head.

Every alert is appended to data/alerts.jsonl on this machine. If
KEYSIGN_NTFY_TOPIC is set, it is also pushed to a phone through ntfy
(https://ntfy.sh, free, no account: install the app, subscribe to the topic).
The push runs in a background thread so it can never stall the stream, and
carries only the alert kind, user label, distance and time, never keystrokes.

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
TIMEOUT_S = 5.0


def enabled() -> bool:
    return bool(os.environ.get("KEYSIGN_NTFY_TOPIC"))


def channel() -> str:
    return "ntfy" if enabled() else "log-only"


def record(alert: dict, path: Path | str | None = None) -> None:
    path = Path(path or ALERT_LOG)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(alert) + "\n")


def recent(n: int = 20, path: Path | str | None = None) -> list[dict]:
    path = Path(path or ALERT_LOG)
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").strip().splitlines()
    out = []
    for line in lines[-n:]:
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def send(alert: dict, path: Path | str | None = None) -> dict:
    """Log always; push in the background if configured. Returns what was done."""
    record(alert, path)
    if not enabled():
        return {"sent": False, "channel": "log-only"}
    threading.Thread(target=_push_safely, args=(alert,), daemon=True).start()
    return {"sent": True, "channel": "ntfy"}


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
    body = (f"{alert.get('user', '?')} · {kind} · {alert.get('distance', 0):.1f}σ from baseline for "
            f"{alert.get('sustained_ticks', 0)} ticks · {time.strftime('%H:%M:%S', time.localtime(alert.get('ts', time.time())))}")
    req = urllib.request.Request(f"{server}/{topic}", data=body.encode("utf-8"), method="POST",
                                 headers={"Title": title, "Priority": "high" if kind == "duress" else "urgent",
                                          "Tags": "rotating_light" if kind == "duress" else "bust_in_silhouette"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
        r.read()
