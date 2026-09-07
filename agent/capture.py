"""
System-wide keystroke capture for the desktop agent.

pynput hooks the keyboard for every application and the events go to the
local backend over the same WebSocket the browser uses (/ws/capture), with
the same shapes, so the pipeline and the heads do not know the difference.

Privacy rules, in code not policy:
- the session says `redact: true`, so the backend's session recording keeps
  only the class of each key (letter / digit / space / edit / modifier /
  other), never which letter. Features are computed in memory from the real
  keys and then dropped;
- capture pauses on its own while the foreground window looks like a place
  for secrets (password managers, sign-in pages), and whenever the user
  pauses it from the tray;
- shortcut chords (a key while Ctrl/Alt/Win is held) and those modifier keys are
  not typing and are dropped before they reach the stream;
- everything stays on 127.0.0.1.
"""
from __future__ import annotations

import ctypes
import json
import logging
import random
import string
import threading
import time
from typing import Callable

log = logging.getLogger("keysign.agent.capture")

# Foreground window titles that pause capture (case-insensitive substrings).
SECRET_TITLES = ("password", "1password", "bitwarden", "keepass", "lastpass", "dashlane", "sign in", "log in", "login",
                 "passcode", "authenticator", "credential", "windows security")

_MOD = {"shift": "Shift", "shift_r": "Shift", "ctrl": "Control", "ctrl_l": "Control", "ctrl_r": "Control",
        "alt": "Alt", "alt_l": "Alt", "alt_r": "Alt", "alt_gr": "AltGraph", "cmd": "Meta", "cmd_r": "Meta", "caps_lock": "CapsLock"}
# Command modifiers. A key pressed while one of these is held (Ctrl+C, Alt+Tab, Win+D) is a
# command, not typing: it has no rhythm to score and the enrolment page never saw any, so
# such chords, and the modifier keys themselves, are dropped from the stream. Shift and
# CapsLock stay: capitals are part of how a person types.
_COMMAND_MODS = {"ctrl", "ctrl_l", "ctrl_r", "alt", "alt_l", "alt_r", "alt_gr", "cmd", "cmd_r"}
_SPECIAL = {"space": (" ", "Space"), "backspace": ("Backspace", "Backspace"), "delete": ("Delete", "Delete"),
            "enter": ("Enter", "Enter"), "tab": ("Tab", "Tab"), "esc": ("Escape", "Escape")}


def key_event(key, kind: str, t_ms: float) -> dict | None:
    """pynput key -> capture-page event {"type","key","code","t"}; None for keys we don't score."""
    name = getattr(key, "name", None)
    if name:
        if name in _MOD:
            return {"type": kind, "key": _MOD[name], "code": _MOD[name] + ("Left" if not name.endswith("_r") else "Right"), "t": t_ms}
        if name in _SPECIAL:
            k, c = _SPECIAL[name]
            return {"type": kind, "key": k, "code": c, "t": t_ms}
        return None                                            # arrows, function keys, media keys
    ch = getattr(key, "char", None)
    if ch is None or len(ch) != 1:
        return None
    if ch in string.ascii_letters:
        return {"type": kind, "key": ch, "code": "Key" + ch.upper(), "t": t_ms}
    if ch in string.digits:
        return {"type": kind, "key": ch, "code": "Digit" + ch, "t": t_ms}
    if ch.isprintable():
        return {"type": kind, "key": ch, "code": "Other", "t": t_ms}
    return None


def foreground_title() -> str:
    try:
        u = ctypes.windll.user32
        h = u.GetForegroundWindow()
        n = u.GetWindowTextLengthW(h)
        buf = ctypes.create_unicode_buffer(n + 1)
        u.GetWindowTextW(h, buf, n + 1)
        return buf.value
    except Exception:
        return ""


def looks_secret(title: str) -> bool:
    t = title.lower()
    return any(s in t for s in SECRET_TITLES)


class Capture:
    """Keyboard hook -> batches every 250 ms -> /ws/capture. Reconnects on its own."""

    def __init__(self, ws_url: str, user: Callable[[], str], batch_ms: int = 250):
        self.ws_url = ws_url
        self.user = user                                   # called when (re)connecting: the declared user
        self.batch_ms = batch_ms
        self.session = "agent-" + "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=8))
        self.paused = False                                # tray toggle
        self.auto_paused = False                           # secret-looking foreground window
        self.connected = False
        self.last_key_at = 0.0
        self.keys_sent = 0
        self._q: list[dict] = []
        self._lock = threading.Lock()
        self._down: set = set()
        self._held_mods: set = set()                       # command modifiers currently held
        self._chorded: set = set()                         # keys that went down inside a chord
        self.chords_dropped = 0
        self._stop = threading.Event()
        self._listener = None
        self._ws = None

    # ---- hook ----
    def _on(self, kind: str):
        def handler(key):
            if self.paused or self.auto_paused:
                return
            ident = getattr(key, "name", None) or getattr(key, "char", None)
            if ident in _COMMAND_MODS:                     # Ctrl / Alt / Win: never typing
                (self._held_mods.add if kind == "down" else self._held_mods.discard)(ident)
                return
            if kind == "down":
                if ident in self._down:                    # OS auto-repeat
                    return
                self._down.add(ident)
                if self._held_mods:                        # a shortcut chord: drop the key and its release
                    self._chorded.add(ident)
                    self.chords_dropped += 1
                    return
            else:
                self._down.discard(ident)
                if ident in self._chorded:
                    self._chorded.discard(ident)
                    return
            ev = key_event(key, kind, time.perf_counter() * 1000.0)
            if ev is None:
                return
            self.last_key_at = time.time()
            with self._lock:
                self._q.append(ev)
        return handler

    def start(self) -> "Capture":
        from pynput import keyboard
        self._listener = keyboard.Listener(on_press=self._on("down"), on_release=self._on("up"))
        self._listener.daemon = True
        self._listener.start()
        threading.Thread(target=self._pump, daemon=True, name="keysign-capture-ws").start()
        threading.Thread(target=self._watch_foreground, daemon=True, name="keysign-foreground").start()
        return self

    def stop(self) -> None:
        self._stop.set()
        if self._listener:
            self._listener.stop()
        try:
            if self._ws:
                self._ws.close()
        except Exception:
            pass

    def reset(self) -> None:
        with self._lock:
            self._q.clear()
        try:
            if self._ws:
                self._ws.send(json.dumps({"type": "reset"}))
        except Exception:
            pass

    def set_user(self, user: str) -> None:
        try:
            if self._ws:
                self._ws.send(json.dumps({"type": "user", "user": user or "unknown"}))
        except Exception:
            pass

    # ---- background threads ----
    def _watch_foreground(self) -> None:
        while not self._stop.is_set():
            secret = looks_secret(foreground_title())
            if secret != self.auto_paused:
                self.auto_paused = secret
                log.info("capture %s (foreground window)", "paused" if secret else "resumed")
            time.sleep(0.5)

    def _pump(self) -> None:
        from websockets.sync.client import connect
        while not self._stop.is_set():
            try:
                with connect(self.ws_url, open_timeout=5) as ws:
                    self._ws = ws
                    ws.send(json.dumps({"type": "hello", "user": self.user() or "unknown", "session": self.session,
                                        "source": "agent", "redact": True}))
                    ws.recv(timeout=5)                      # ack
                    self.connected = True
                    log.info("capture connected as session %s", self.session)
                    while not self._stop.is_set():
                        time.sleep(self.batch_ms / 1000.0)
                        with self._lock:
                            batch, self._q = self._q, []
                        if batch:
                            ws.send(json.dumps({"type": "events", "events": batch}))
                            self.keys_sent += sum(1 for e in batch if e["type"] == "down")
                            try:
                                ws.recv(timeout=0.05)       # drain the echoed tick, we don't need it
                            except Exception:
                                pass
            except Exception as e:
                if not self._stop.is_set():
                    log.debug("capture socket: %s (retrying)", e)
            finally:
                self.connected = False
                self._ws = None
            self._stop.wait(2.0)

    def status(self) -> dict:
        return {"session": self.session, "connected": self.connected, "paused": self.paused, "auto_paused": self.auto_paused,
                "keys_sent": self.keys_sent, "chords_dropped": self.chords_dropped, "last_key_at": self.last_key_at,
                "foreground": foreground_title()[:80]}
