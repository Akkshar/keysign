"""
KeySign live backend (build-order step 4).

    uv run uvicorn backend.app:app --reload --port 8000

Data flow:
    capture page  --ws /ws/capture-->  ring buffer per session
                                        |  every tick (>= TICK_MS apart, on new events)
                                        v
                       window = last WINDOW_S seconds of events
                       features = extract_features(window)
                       baseline = data/baselines/<user>.json (if any)
                       heads    = each registered head(features, baseline, ctx) -> dict
                                        |
    dashboard     <--ws /ws/dashboard-- broadcast one JSON "tick" per session
    data/sessions/<date>_<session>.jsonl  <-- raw events + ticks, every session
                                              (backend/sessions.py; KEYSIGN_RECORD=0 to disable)

Heads plug in with `register_head(name, fn)`; see backend/heads.py. Nothing
here leaves the machine: both sockets are localhost.

Messages the capture page sends on /ws/capture:
    {"type": "hello", "user": "Akkshar Ranjan", "session": "abc123"}
    {"type": "events", "events": [{"type": "down", "key": "a", "code": "KeyA", "t": 1234.5}, ...]}
    {"type": "reset"}                       # clear the buffer (e.g. new person sits down)

What the dashboard receives on /ws/dashboard:
    {"type": "tick", "session": ..., "user": ..., "ts": epoch_s,
     "window_s": 10, "n_events": 84, "features": {...28 features...},
     "baseline": {"user": ..., "n_samples": 20} | null,
     "distance": 1.23 | null, "z": {...} | null, "top": [["hold_mean", 2.1], ...] | null,
     "heads": {"identity": {...}, "state": {...}, ...}}
    {"type": "session_end", "session": ...}
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from collections import deque
from pathlib import Path
from typing import Any, Callable

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from pipeline.baseline import BASELINE_FEATURES, Baseline, _slug
from pipeline.features import FEATURE_NAMES, extract_features

log = logging.getLogger("keysign")

ROOT = Path(__file__).resolve().parent.parent
BASELINE_DIR = ROOT / "data" / "baselines"
RECORD_DIR = ROOT / "data" / "sessions"         # every live session, raw events + ticks (gitignored)
RECORD = os.environ.get("KEYSIGN_RECORD", "1") != "0"

WINDOW_S = 10.0          # features are computed on the last N seconds of events
BUFFER_S = 120.0         # how much history a session keeps
TICK_MS = 500            # minimum gap between ticks per session
MIN_KEYS = 8             # don't score windows with fewer keydowns than this
IDLE_RESET_S = 6.0       # a pause this long between ticks means someone else may have sat down: the
                         # heads' vote/streak histories start over (measured: after an 80 s pause the
                         # next person inherited the previous label for 4 ticks)

# ---------------------------------------------------------------------------
# Heads: each is fn(features: dict, baseline: Baseline | None, ctx: dict) -> dict
# ---------------------------------------------------------------------------
Head = Callable[[dict, "Baseline | None", dict], dict]
HEADS: dict[str, Head] = {}


def register_head(name: str, fn: Head) -> None:
    HEADS[name] = fn


def run_heads(features: dict, baseline: Baseline | None, ctx: dict) -> dict:
    out: dict = {}
    ctx["heads_so_far"] = out                        # later heads can read earlier heads' output
    for name, fn in HEADS.items():
        try:
            out[name] = fn(features, baseline, ctx)
        except Exception as e:                       # a broken head must not kill the stream
            log.exception("head %s failed", name)
            out[name] = {"error": str(e)}
    return out


# ---------------------------------------------------------------------------
# Baselines (cached, reloaded when the file changes)
# ---------------------------------------------------------------------------
_baseline_cache: dict[str, tuple[float, Baseline]] = {}


def load_baseline(user: str) -> Baseline | None:
    path = BASELINE_DIR / f"{_slug(user)}.json"
    if not path.exists():
        return None
    mtime = path.stat().st_mtime
    hit = _baseline_cache.get(user)
    if hit and hit[0] == mtime:
        return hit[1]
    b = Baseline.load(path)
    _baseline_cache[user] = (mtime, b)
    return b


def list_baselines() -> list[dict]:
    out = []
    for p in sorted(BASELINE_DIR.glob("*.json")) if BASELINE_DIR.exists() else []:
        try:
            b = Baseline.load(p)
            out.append({"user": b.user, "n_samples": b.n_samples, "condition": b.condition, "created_at": b.created_at})
        except Exception:
            continue
    return out


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------
class Session:
    def __init__(self, session_id: str, user: str):
        self.id = session_id
        self.user = user
        self.events: deque[dict] = deque()
        self.last_tick = 0.0
        self.last_tick_msg: dict | None = None
        self.ticks = 0
        self.ctx: dict[str, Any] = {}        # heads can keep per-session state here
        self.record_path: Path | None = None
        if RECORD:
            RECORD_DIR.mkdir(parents=True, exist_ok=True)
            self.record_path = RECORD_DIR / f"{time.strftime('%Y-%m-%d_%H%M%S')}_{session_id}.jsonl"
            self.record({"type": "hello", "user": user, "session": session_id, "ts": time.time()})

    def record(self, obj: dict) -> None:
        """Append one line to this session's recording (see backend/sessions.py). Never raises."""
        if self.record_path is None:
            return
        try:
            with open(self.record_path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(obj) + "\n")
        except OSError:
            log.exception("could not record session %s", self.id)

    def add(self, events: list[dict]) -> None:
        for e in events:
            if e.get("type") in ("down", "up") and isinstance(e.get("t"), (int, float)):
                self.events.append(e)
        # trim history by event time
        if self.events:
            cutoff = self.events[-1]["t"] - BUFFER_S * 1000
            while self.events and self.events[0]["t"] < cutoff:
                self.events.popleft()

    def window(self, seconds: float = WINDOW_S) -> list[dict]:
        if not self.events:
            return []
        cutoff = self.events[-1]["t"] - seconds * 1000
        return [e for e in self.events if e["t"] >= cutoff]

    def tick(self) -> dict | None:
        now = time.time()
        if (now - self.last_tick) * 1000 < TICK_MS:
            return None
        if self.ticks and now - self.last_tick > IDLE_RESET_S:
            for k in ("identity", "threat"):
                self.ctx.pop(k, None)
            self.ctx["idle_reset"] = True
        self.last_tick = now
        w = self.window()
        n_keys = sum(1 for e in w if e["type"] == "down")
        if n_keys < MIN_KEYS:
            return {"type": "tick", "session": self.id, "user": self.user, "ts": now,
                    "window_s": WINDOW_S, "n_events": len(w), "n_keys": n_keys,
                    "features": None, "baseline": None, "distance": None, "z": None, "top": None,
                    "heads": {}, "status": f"need {MIN_KEYS} keys in the last {WINDOW_S:.0f}s"}
        feats = extract_features(w)
        base = load_baseline(self.user)
        distance = z = top = None
        if base is not None:
            distance = float(base.distance(feats))
            z = {f: float(v) for f, v in zip(base.features, base.zscores(feats))}
            top = [[f, round(v, 2)] for f, v in base.explain(feats, top=3)]
        self.ticks += 1
        self.ctx.update({"session": self.id, "user": self.user, "tick": self.ticks, "window": w})
        msg = {"type": "tick", "session": self.id, "user": self.user, "ts": now,
               "window_s": WINDOW_S, "n_events": len(w), "n_keys": n_keys,
               "features": {k: float(v) for k, v in feats.items()},
               "baseline": {"user": base.user, "n_samples": base.n_samples} if base else None,
               "distance": distance, "z": z, "top": top,
               "heads": run_heads(feats, base, self.ctx), "status": "ok"}
        self.last_tick_msg = msg
        return msg


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="KeySign backend", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

sessions: dict[str, Session] = {}
dashboards: set[WebSocket] = set()
_lock = asyncio.Lock()


async def broadcast(msg: dict) -> None:
    data = json.dumps(msg)
    dead = []
    for ws in list(dashboards):
        try:
            await ws.send_text(data)
        except Exception:
            dead.append(ws)
    for ws in dead:
        dashboards.discard(ws)


@app.get("/")
def index():
    from backend import explain, notify
    return {"service": "KeySign backend", "ok": True,
            "endpoints": ["/health", "/api/users", "/api/baseline/{user}", "/api/state", "/api/alerts",
                          "WS /ws/capture", "WS /ws/dashboard"],
            "heads": list(HEADS),
            "alerts": notify.channel(), "explainer": "gemini" if explain.enabled() else "template",
            "dashboard": "http://localhost:5173", "capture": "http://localhost:8080"}


@app.get("/health")
def health():
    return {"ok": True, "sessions": len(sessions), "dashboards": len(dashboards),
            "heads": list(HEADS), "window_s": WINDOW_S}


@app.get("/api/users")
def users():
    return {"baselines": list_baselines(), "features": FEATURE_NAMES, "baseline_features": BASELINE_FEATURES}


@app.get("/api/baseline/{user}")
def baseline(user: str):
    b = load_baseline(user)
    return b.to_dict() if b else {"error": "no baseline", "user": user}


@app.get("/api/alerts")
def alerts_api(n: int = 20):
    """Silent alerts raised by the Threat head, newest last. Local log; pushed to a phone if KEYSIGN_NTFY_TOPIC is set."""
    from backend import notify
    return {"channel": notify.channel(), "alerts": notify.recent(n)}


@app.get("/api/state")
def state_api(session: str | None = None):
    """
    The State head as an API for other apps: "should I interrupt this person now?"
    Returns the latest tick's state output for a session (default: the most
    recently active one). `advice` is "defer" or "ok".
    """
    live = [s for s in sessions.values() if s.last_tick_msg]
    if session:
        live = [s for s in live if s.id == session]
    if not live:
        return {"advice": "unknown", "reason": "no active typing session", "sessions": [s.id for s in sessions.values()]}
    s = max(live, key=lambda x: x.last_tick)
    st = (s.last_tick_msg.get("heads") or {}).get("state") or {}
    return {"session": s.id, "user": s.user, "ts": s.last_tick_msg.get("ts"), "age_s": round(time.time() - s.last_tick, 1),
            "advice": st.get("advice", "unknown"), "load": st.get("load"), "label": st.get("label"),
            "explanation": st.get("explanation"), "identity": (s.last_tick_msg.get("heads") or {}).get("identity")}


@app.websocket("/ws/capture")
async def ws_capture(ws: WebSocket):
    await ws.accept()
    session: Session | None = None
    try:
        while True:
            msg = json.loads(await ws.receive_text())
            t = msg.get("type")
            if t == "hello":
                sid = str(msg.get("session") or uuid.uuid4().hex[:8])
                session = Session(sid, str(msg.get("user") or "unknown"))
                sessions[sid] = session
                await ws.send_text(json.dumps({"type": "ack", "session": sid, "user": session.user,
                                               "baseline": load_baseline(session.user) is not None}))
            elif t == "events" and session is not None:
                session.add(msg.get("events") or [])
                session.record({"type": "events", "ts": time.time(), "events": msg.get("events") or []})
                tick = session.tick()
                if tick:
                    if tick.get("features"):
                        h = tick["heads"]
                        session.record({"type": "tick", "ts": tick["ts"], "user": tick["user"], "n_keys": tick["n_keys"],
                                        "distance": tick["distance"], "features": tick["features"],
                                        "heads": {"identity": h.get("identity"),
                                                  "threat": {k: (h.get("threat") or {}).get(k) for k in ("level", "kind", "distance")},
                                                  "state": {k: (h.get("state") or {}).get(k) for k in ("load", "label")}}})
                    await ws.send_text(json.dumps(tick))     # echo to the typist's page too
                    await broadcast(tick)
            elif t == "reset" and session is not None:
                session.events.clear()
                session.ctx.clear()
                session.record({"type": "reset", "ts": time.time()})
                await broadcast({"type": "reset", "session": session.id, "user": session.user})
            elif t == "user" and session is not None:        # same chair, new declared user
                session.user = str(msg.get("user") or session.user)
                session.record({"type": "user", "ts": time.time(), "user": session.user})
    except WebSocketDisconnect:
        pass
    finally:
        if session is not None:
            sessions.pop(session.id, None)
            await broadcast({"type": "session_end", "session": session.id})


@app.websocket("/ws/dashboard")
async def ws_dashboard(ws: WebSocket):
    await ws.accept()
    dashboards.add(ws)
    await ws.send_text(json.dumps({"type": "hello", "sessions": [{"session": s.id, "user": s.user} for s in sessions.values()],
                                   "baselines": list_baselines(), "heads": list(HEADS)}))
    try:
        while True:
            await ws.receive_text()          # dashboards don't send anything; keeps the socket open
    except WebSocketDisconnect:
        pass
    finally:
        dashboards.discard(ws)


# Register the heads that exist. Each teammate adds theirs in backend/heads.py.
try:
    from backend import heads as _heads  # noqa: F401  (registers on import)
except ImportError:
    pass
