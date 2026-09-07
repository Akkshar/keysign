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

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from pipeline.baseline import BASELINE_FEATURES, Baseline, _slug
from pipeline.features import FEATURE_NAMES, extract_features

log = logging.getLogger("keysign")

ROOT = Path(__file__).resolve().parent.parent
BASELINE_DIR = ROOT / "data" / "baselines"
RECORD_DIR = ROOT / "data" / "sessions"         # every live session, raw events + ticks (gitignored)
RECORD = os.environ.get("KEYSIGN_RECORD", "1") != "0"
UI_DIST = ROOT / "ui" / "dist"                  # built dashboard; served at / when present (the app window loads it)
AGENT_STATUS = None                             # set by the desktop agent: callable -> dict

# Recording redaction for system-wide capture: keep the class of a key, never the key.
def key_class(e: dict) -> str:
    code, key = str(e.get("code", "")), str(e.get("key", ""))
    if code.startswith("Key") or (len(key) == 1 and key.isalpha()):
        return "letter"
    if code.startswith("Digit") or (len(key) == 1 and key.isdigit()):
        return "digit"
    if code == "Space" or key == " ":
        return "space"
    if key in ("Backspace", "Delete"):
        return "edit"
    if key in ("Shift", "Control", "Alt", "Meta", "CapsLock", "AltGraph"):
        return "modifier"
    if key in ("Enter", "Tab", "Escape"):
        return "control"
    return "other"


def redact_events(events: list[dict]) -> list[dict]:
    return [{"type": e.get("type"), "class": key_class(e), "t": e.get("t")} for e in events]

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
    def __init__(self, session_id: str, user: str, redact: bool = False, source: str = "browser"):
        self.id = session_id
        self.user = user
        self.redact = redact                 # recordings keep key classes only (system-wide capture)
        self.source = source
        self.events: deque[dict] = deque()
        self.last_tick = 0.0
        self.last_tick_msg: dict | None = None
        self.ticks = 0
        self.ctx: dict[str, Any] = {}        # heads can keep per-session state here
        self.record_path: Path | None = None
        if RECORD:
            RECORD_DIR.mkdir(parents=True, exist_ok=True)
            self.record_path = RECORD_DIR / f"{time.strftime('%Y-%m-%d_%H%M%S')}_{session_id}.jsonl"
            self.record({"type": "hello", "user": user, "session": session_id, "ts": time.time(),
                         "source": source, "redacted": redact})

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


def _maybe_alert_actions(session: Session, tick: dict) -> None:
    """A new alert on this tick -> backend/actions.py (webcam fallback, lock). Never raises."""
    try:
        th = (tick.get("heads") or {}).get("threat") or {}
        total = int(th.get("alerts_total") or 0)
        seen = session.ctx.get("_alerts_actioned", 0)
        if total > seen and th.get("last_alert"):
            session.ctx["_alerts_actioned"] = total
            from backend import actions
            la = th["last_alert"]
            idn = (tick.get("heads") or {}).get("identity") or {}
            alert = {"ts": la.get("ts"), "kind": la.get("kind") or th.get("kind"), "user": session.user, "session": session.id,
                     "distance": th.get("distance"), "sustained_ticks": th.get("sustained_ticks"), "load": th.get("load"),
                     "identity": idn.get("user"), "identity_confidence": idn.get("confidence")}
            actions.on_alert(alert, process_alert_photo)
    except Exception:
        log.exception("alert actions")


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


@app.get("/api/info")
def index():
    from backend import explain, notify
    return {"service": "KeySign backend", "ok": True,
            "endpoints": ["/health", "/api/users", "/api/baseline/{user}", "/api/state", "/api/alerts",
                          "POST /api/alerts/photo?ts=", "/api/alerts/photo/{name}",
                          "GET/POST/DELETE /api/faces/{user}", "GET/PUT/DELETE /api/accounts/{email}",
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


MAX_PHOTO_BYTES = 2_000_000


def process_alert_photo(alert: dict, data: bytes, session: str | None = None, source: str = "dashboard",
                        verdict: dict | None = None) -> dict:
    """
    Store the frame, check the face against the owner, grab the screen, and push the
    images if backend/actions.decide says the final call is an intruder. The text of the
    alert itself is pushed by backend/actions.on_alert once the camera has had its say.
    """
    from backend import actions, faces, notify
    actions.photo_arrived(alert["ts"])
    sess = alert.get("session") or session
    p = notify.save_photo(alert["ts"], sess, data)
    # Is this the owner? The owner of the session is the declared user.
    owner = alert.get("user") or ""
    if verdict is None:
        try:
            verdict = faces.verify(owner, data)
        except Exception as e:                       # OpenCV missing or broken: never block the alert
            log.warning("face check failed: %s", e)
            verdict = {"face": None, "match": None, "distance": None, "threshold": faces.THRESHOLD, "enrolled": 0, "reason": str(e)}
    verdict = dict(verdict)
    verdict["owner"] = owner
    screen_name = None
    shot = faces.grab_screen()
    if shot:
        screen_name = notify.save_photo(alert["ts"], sess, shot, suffix="_screen").name
    verdict["source"] = source
    notify.save_verdict(alert["ts"], sess, verdict)
    when = time.strftime("%H:%M:%S", time.localtime(alert["ts"]))
    d = actions.decide(alert, verdict)
    if d["images"]:
        push = notify.send_photo(alert, p, "KeySign: who is at the keyboard", f"{when} · {d['why']} · on {owner}'s session")
        if screen_name:
            notify.send_photo(alert, notify.PHOTO_DIR / screen_name, "KeySign: what was on the screen", f"{when} · screen at the moment of the alert")
    else:
        push = {"sent": False, "channel": notify.channel(), "reason": d["why"]}
    return {"ok": True, "photo": p.name, "screen": screen_name, "face": verdict, "final_kind": d["kind"], **push}


@app.post("/api/alerts/photo")
async def alert_photo(request: Request, ts: float, session: str | None = None):
    """
    One webcam frame (JPEG body) for the alert raised at `ts`, of either kind. Stored
    in data/alert_photos/, face-checked against the owner, and pushed as an attachment
    only when the final call is an intruder (a duress frame never leaves the machine).
    """
    from backend import notify
    data = await request.body()
    if not data or len(data) > MAX_PHOTO_BYTES or not data.startswith(b"\xff\xd8"):
        return JSONResponse({"ok": False, "error": "expected a JPEG under 2 MB"}, status_code=400)
    alerts = [a for a in notify.recent(50) if abs(float(a.get("ts", 0)) - ts) < 2.0]
    if not alerts:
        return JSONResponse({"ok": False, "error": "no alert at that time"}, status_code=404)
    alert = alerts[-1]
    return process_alert_photo(alert, data, session)


@app.get("/api/settings")
def settings_get():
    from backend import actions
    return actions.settings()


@app.put("/api/settings")
async def settings_put(request: Request):
    """Body: any of lock_on_intruder (bool), photo_on_intruder (bool), toast_on_alert (bool), declared_user (str)."""
    from backend import actions
    body = await request.json()
    if not isinstance(body, dict):
        return JSONResponse({"error": "object expected"}, status_code=400)
    return actions.update_settings(body)


@app.post("/api/agent/quit")
def agent_quit():
    """Stop the desktop agent (tray, hook, window, backend). Only the agent registers a hook."""
    from backend import actions
    if actions.QUIT_HOOK is None:
        return JSONResponse({"ok": False, "error": "no desktop agent in this process"}, status_code=404)
    import threading
    threading.Timer(0.3, actions.QUIT_HOOK).start()
    return {"ok": True, "quitting": True}


@app.get("/api/agent")
def agent_status():
    """Is the desktop agent (system-wide capture) running, and what is it doing."""
    if AGENT_STATUS is None:
        return {"running": False}
    try:
        return {"running": True, **AGENT_STATUS()}
    except Exception as e:
        return {"running": True, "error": str(e)}


# ---------------------------------------------------------------------------
# Accounts: which enrolled typing profile a signed-in email belongs to.
# Sign-in itself happens in the browser (Firebase); the backend only keeps this
# local map so signing in selects the right baseline. Trust model: a browser on
# this machine says who signed in; nothing here is verified against Firebase.
# ---------------------------------------------------------------------------
ACCOUNTS_PATH = ROOT / "data" / "accounts.json"


def _accounts() -> dict:
    try:
        return json.loads(ACCOUNTS_PATH.read_text(encoding="utf-8")) if ACCOUNTS_PATH.exists() else {}
    except json.JSONDecodeError:
        return {}


def _save_accounts(d: dict) -> None:
    ACCOUNTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    ACCOUNTS_PATH.write_text(json.dumps(d, indent=1), encoding="utf-8")


def _account_view(email: str, entry: dict | None) -> dict:
    user = (entry or {}).get("user")
    return {"email": email, "user": user, "has_baseline": bool(user and load_baseline(user) is not None),
            "linked_at": (entry or {}).get("linked_at")}


@app.get("/api/accounts/{email}")
def account_get(email: str):
    email = email.strip().lower()
    return _account_view(email, _accounts().get(email))


@app.put("/api/accounts/{email}")
async def account_link(email: str, request: Request):
    """Body: {"user": "<baseline name>"}. Links the email to that typing profile (existing or to be enrolled)."""
    email = email.strip().lower()
    body = await request.json()
    user = str((body or {}).get("user") or "").strip()
    if not email or "@" not in email:
        return JSONResponse({"error": "not an email"}, status_code=400)
    if not user or len(user) > 64:
        return JSONResponse({"error": "user name required (max 64 chars)"}, status_code=400)
    d = _accounts()
    d[email] = {"user": user, "linked_at": time.strftime("%Y-%m-%dT%H:%M:%S")}
    _save_accounts(d)
    return _account_view(email, d[email])


@app.delete("/api/accounts/{email}")
def account_unlink(email: str):
    email = email.strip().lower()
    d = _accounts()
    removed = d.pop(email, None) is not None
    if removed:
        _save_accounts(d)
    return {"email": email, "removed": removed}


@app.get("/api/faces/{user}")
def faces_status(user: str):
    from backend import faces
    return {"user": user, "n_samples": faces.n_samples(user), "threshold": round(faces.threshold_for(user), 2), "method": faces.method()}


@app.post("/api/faces/{user}")
async def faces_enrol(user: str, request: Request):
    """One webcam frame (JPEG body) of the owner. The largest face is cropped and stored under data/faces/<user>/."""
    from backend import faces
    data = await request.body()
    if not data or len(data) > MAX_PHOTO_BYTES or not data.startswith(b"\xff\xd8"):
        return JSONResponse({"ok": False, "error": "expected a JPEG under 2 MB"}, status_code=400)
    try:
        return faces.enrol(user, data)
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@app.post("/api/faces/{user}/grab")
def faces_enrol_from_camera(user: str, frames: int = 8):
    """
    Enrol from the machine's own camera, the same path the intruder check uses: `frames`
    JPEGs about 0.4 s apart (look at the screen, then down at the keys, then back).
    """
    from backend import actions, faces
    shots = actions.grab_webcam_burst(n=max(1, min(frames, 20)), gap_s=0.4)
    if not shots:
        return JSONResponse({"ok": False, "error": "no camera, or it is in use"}, status_code=503)
    stored, without_face = 0, 0
    for jpeg in shots:
        try:
            r = faces.enrol(user, jpeg)
        except Exception as e:
            return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
        stored += 1 if r.get("ok") else 0
        without_face += 0 if r.get("ok") else 1
    return {"ok": stored > 0, "stored": stored, "without_face": without_face, "n_samples": faces.n_samples(user),
            "threshold": round(faces.threshold_for(user), 2), "method": faces.method()}


@app.delete("/api/faces/{user}")
def faces_clear(user: str):
    from backend import faces
    return {"user": user, "removed": faces.clear(user), "n_samples": 0}


@app.get("/api/alerts/photo/{name}")
def alert_photo_file(name: str):
    from backend import notify
    p = notify.PHOTO_DIR / Path(name).name
    if not p.exists():
        return JSONResponse({"error": "no such photo"}, status_code=404)
    return FileResponse(p, media_type="image/jpeg")


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
                session = Session(sid, str(msg.get("user") or "unknown"),
                                  redact=bool(msg.get("redact")), source=str(msg.get("source") or "browser"))
                sessions[sid] = session
                await ws.send_text(json.dumps({"type": "ack", "session": sid, "user": session.user,
                                               "baseline": load_baseline(session.user) is not None}))
            elif t == "events" and session is not None:
                session.add(msg.get("events") or [])
                evs = msg.get("events") or []
                session.record({"type": "events", "ts": time.time(), "events": redact_events(evs) if session.redact else evs})
                tick = session.tick()
                if tick:
                    _maybe_alert_actions(session, tick)
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



# The built dashboard, when present: the desktop app window loads http://127.0.0.1:8000/ and
# nobody sees a browser. Mounted last so every /api and /ws route above wins.
if UI_DIST.exists():
    app.mount("/", StaticFiles(directory=str(UI_DIST), html=True), name="dashboard")
else:
    @app.get("/")
    def index_fallback():
        return index()
