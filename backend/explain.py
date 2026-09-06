"""
Plain-language explanation for the State head.

If GEMINI_API_KEY is set, asks Gemini for one sentence in a background
thread (never on the tick path), at most once per cooldown per session and
only when the label changes. Otherwise, or until the reply lands, returns a
template sentence. Only the label, load and top driver names are sent, never
keystrokes or text. Set GEMINI_MODEL to change the model.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
import urllib.request

log = logging.getLogger("keysign.explain")

COOLDOWN_S = 20.0
TIMEOUT_S = 6.0
DRIVER_WORDS = {
    "speed_kps": "typing faster", "error_rate": "more corrections", "rp_negative_ratio": "keys overlapping more",
    "flight_median": "shorter gaps between keys", "flight_mean": "shorter gaps between keys", "hold_mean": "shorter key presses",
    "hold_median": "shorter key presses", "hold_std": "less even key presses", "pause_ratio": "fewer pauses",
    "rhythm_cv": "a less steady rhythm", "modifier_ratio": "more shortcut keys", "rp_mean": "quicker hand-offs between keys",
    "flight_std": "a more uneven pace",
}


def enabled() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY"))


def template(user: str, label: str, load: float, drivers: list) -> str:
    names = [DRIVER_WORDS.get(f, f.replace("_", " ")) for f, _ in drivers[:2]]
    why = " and ".join(names) if names else "a steady rhythm"
    if label == "deep focus":
        return f"{user} is in a steady, focused rhythm. Good moment to hold notifications."
    if label == "engaged":
        return f"{user} is engaged and working normally, with {why}."
    return f"{user} looks under load: {why} compared with their usual calm typing. Worth deferring interruptions."


def get(state: dict, user: str, label: str, load: float, drivers: list) -> str:
    """
    state: the head's per-session dict (ctx["state"]). Returns the best
    explanation available now; may kick off a Gemini call for the next tick.
    """
    fallback = template(user, label, load, drivers)
    if not enabled():
        return fallback
    now = time.time()
    ex = state.setdefault("explain", {"label": None, "text": None, "at": 0.0, "pending": False})
    if ex["label"] == label and ex["text"]:
        return ex["text"]
    if not ex["pending"] and now - ex["at"] >= COOLDOWN_S:
        ex["pending"] = True
        ex["at"] = now
        threading.Thread(target=_ask, args=(ex, user, label, load, drivers), daemon=True).start()
    return ex["text"] if ex["text"] else fallback


def _ask(ex: dict, user: str, label: str, load: float, drivers: list) -> None:
    try:
        text = ask_gemini(user, label, load, drivers)
        if text:
            ex["text"], ex["label"] = text, label
    except Exception as e:                      # offline / quota / bad key: keep the template
        log.warning("gemini explanation failed: %s", e)
    finally:
        ex["pending"] = False


def ask_gemini(user: str, label: str, load: float, drivers: list) -> str | None:
    key = os.environ.get("GEMINI_API_KEY")
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    why = ", ".join(f"{DRIVER_WORDS.get(f, f)} ({'+' if v > 0 else ''}{v})" for f, v in drivers[:3])
    prompt = (
        "You write one short sentence for a desktop notification manager called KeySign. "
        "It estimates a person's cognitive load from their typing rhythm compared with their own calm baseline. "
        f"Person: {user}. Current label: {label}. Load score: {load:.2f} on a 0-1 scale. "
        f"Main signals: {why}. "
        "Write ONE plain sentence (max 25 words) telling an app whether to interrupt this person now and why, in a warm, non-clinical tone. "
        "No medical or emotional diagnosis, no jargon, no preamble."
    )
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                       "generationConfig": {"temperature": 0.4, "maxOutputTokens": 60}}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
        data = json.loads(r.read().decode())
    text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    return text.split("\n")[0][:240] if text else None
