"""
Run:  uv run python -m pytest backend/tests -q

Uses FastAPI's TestClient. Its WebSocket sessions each run on their own event
loop, so a message broadcast from one test socket to another can deadlock;
the capture socket therefore echoes every tick back to its sender and the
tests read ticks there. Broadcasting itself is unit-tested with fakes.
"""
import asyncio
import pathlib
import time
import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend import actions
from backend import app as backend
from pipeline.baseline import BASELINE_FEATURES, Baseline, robust_center_scale
from pipeline.features import FEATURE_NAMES


JPEG_HEADER = bytes([0xFF, 0xD8, 0xFF, 0xE0])       # the first bytes of a JPEG


def typed(n, t0=0.0, flight=120.0, hold=60.0):
    ev, t = [], t0
    for i in range(n):
        ch = "abcdefghij"[i % 10]
        ev.append({"type": "down", "key": ch, "code": f"Key{ch.upper()}", "t": t})
        ev.append({"type": "up", "key": ch, "code": f"Key{ch.upper()}", "t": t + hold})
        t += flight
    return sorted(ev, key=lambda e: e["t"])


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(backend, "BASELINE_DIR", tmp_path)   # isolate baselines
    monkeypatch.setattr(backend, "RECORD_DIR", tmp_path / "sessions")   # and session recordings
    monkeypatch.setattr(backend, "TICK_MS", 0)               # no rate limit in tests
    from backend import heads
    monkeypatch.setattr(heads, "_alert_log_path", tmp_path / "alerts.jsonl")   # don't write real alerts
    monkeypatch.delenv("KEYSIGN_NTFY_TOPIC", raising=False)
    # never pick up models trained on the real team data
    monkeypatch.setattr(heads, "MODEL_PATH", tmp_path / "no-identity.joblib")
    monkeypatch.setattr(heads, "STATE_MODEL_PATH", tmp_path / "no-state.joblib")
    heads._model_cache.clear(); heads._state_cache.clear()
    # A tick can raise a real alert, and an alert now reaches for the webcam and the screen.
    # Neither belongs in a test run: keep them out and keep the images in tmp_path.
    from backend import actions, faces, notify
    monkeypatch.setattr(actions, "grab_webcam_burst", lambda **k: [])
    monkeypatch.setattr(faces, "grab_screen", lambda *a, **k: None)
    monkeypatch.setattr(notify, "PHOTO_DIR", tmp_path / "alert_photos")
    monkeypatch.setattr(actions, "PHOTO_GRACE_S", 0.05)
    monkeypatch.setattr(actions, "PHOTO_SETTLE_S", 0.05)
    backend._baseline_cache.clear()
    backend.sessions.clear()
    backend.dashboards.clear()
    return TestClient(backend.app)


def make_baseline(tmp_path, user="Test User"):
    rng = np.random.default_rng(0)
    rows = []
    for _ in range(20):
        f = backend.extract_features(typed(40, flight=120 + rng.normal(0, 5), hold=60 + rng.normal(0, 3)))
        rows.append([f[k] for k in BASELINE_FEATURES])
    c, s = robust_center_scale(np.array(rows))
    b = Baseline(user=user, features=BASELINE_FEATURES, center=c, scale=s, n_samples=20)
    b.save(tmp_path / f"{backend._slug(user)}.json")
    return b


def test_health_and_users(client):
    assert client.get("/health").json()["ok"] is True
    r = client.get("/api/users").json()
    assert r["features"] == FEATURE_NAMES and r["baselines"] == []


def test_capture_without_baseline_gives_features_only(client):
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "Nobody", "session": "s1"})
        ack = cap.receive_json()
        assert ack["type"] == "ack" and ack["session"] == "s1" and ack["baseline"] is False
        cap.send_json({"type": "events", "events": typed(3)})
        tick = cap.receive_json()
        assert tick["type"] == "tick" and tick["features"] is None     # too few keys
        assert "need" in tick["status"]
        cap.send_json({"type": "events", "events": typed(30, t0=1000)})
        tick = cap.receive_json()
        assert tick["status"] == "ok" and tick["n_keys"] == 33
        assert tick["features"]["hold_mean"] == pytest.approx(60)
        assert tick["distance"] is None and tick["baseline"] is None
        assert tick["heads"]["threat"]["level"] == "none"
        assert client.get("/health").json()["sessions"] == 1
    assert client.get("/health").json()["sessions"] == 0                # cleaned up on disconnect


def test_capture_with_baseline_scores_and_runs_heads(client, tmp_path):
    make_baseline(tmp_path)
    assert client.get("/api/users").json()["baselines"][0]["user"] == "Test User"
    assert client.get("/api/baseline/Test User").json()["n_samples"] == 20
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "Test User", "session": "s2"})
        assert cap.receive_json()["baseline"] is True
        cap.send_json({"type": "events", "events": typed(40)})
        tick = cap.receive_json()
        assert tick["baseline"]["n_samples"] == 20
        assert tick["distance"] < 2.0                                    # typical typing
        assert tick["heads"]["threat"]["level"] == "ok"
        assert 0 <= tick["heads"]["state"]["load"] <= 1
        assert len(tick["top"]) == 3 and tick["top"][0][0] in tick["z"]
        # the same person, suddenly twice as fast and far off the baseline: stress-shaped typing
        cap.send_json({"type": "reset"})
        cap.send_json({"type": "events", "events": typed(40, t0=50_000, flight=60, hold=30)})
        tick = cap.receive_json()
        assert tick["n_keys"] == 40                                      # reset cleared the buffer
        assert tick["distance"] > 3.0 and tick["heads"]["state"]["label"] == "high load"
        assert tick["heads"]["threat"]["level"] == "warn"               # one tick is not enough
        from backend import heads
        for i in range(1, heads.THREAT_PERSIST):                         # sustained under load -> alert
            cap.send_json({"type": "events", "events": typed(25, t0=52_500 + i * 2_000, flight=60, hold=30)})
            tick = cap.receive_json()
            assert tick["n_keys"] >= heads.THREAT_MIN_KEYS
        assert tick["heads"]["threat"]["level"] == "alert" and tick["heads"]["threat"]["kind"] == "duress"
        assert tick["heads"]["threat"]["stressed_ticks"] == heads.THREAT_PERSIST


def test_session_is_recorded_and_exportable(client, tmp_path):
    import json as _json
    from backend import sessions as rec
    make_baseline(tmp_path)
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "Test User", "session": "rec1"}); cap.receive_json()
        cap.send_json({"type": "events", "events": typed(40)}); cap.receive_json()
        cap.send_json({"type": "reset"})
        cap.send_json({"type": "events", "events": typed(40, t0=30_000)}); cap.receive_json()
    files = list((tmp_path / "sessions").glob("*_rec1.jsonl"))
    assert len(files) == 1
    recs = rec.read(files[0])
    kinds = [r["type"] for r in recs]
    assert kinds[0] == "hello" and "reset" in kinds and kinds.count("tick") == 2 and kinds.count("events") == 2
    tick = next(r for r in recs if r["type"] == "tick")
    assert tick["n_keys"] == 40 and "hold_mean" in tick["features"] and "threat" in tick["heads"]
    assert len(rec.events_of(recs)) == 160
    samples = rec.to_samples(recs, "Stranger", chunk_s=20.0, min_keys=30)
    assert len(samples) == 2 and samples[0]["user"] == "Stranger" and samples[0]["n_keydowns"] == 40
    assert samples[0]["events"][0]["t"] == 0                    # re-based per sample


def test_harvest_labels_turns_by_nearest_baseline(client, tmp_path):
    from backend import sessions as rec
    make_baseline(tmp_path)                                       # "Test User", typed(40) style
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "Test User", "session": "hv1"}); cap.receive_json()
        for i in range(4):                                        # one settled turn of the baseline typist
            cap.send_json({"type": "events", "events": typed(12, t0=i * 1_500)}); cap.receive_json()
    files = list((tmp_path / "sessions").glob("*_hv1.jsonl"))
    samples = rec.harvest(files, max_distance=2.5)          # synthetic typing has zero jitter, which reads as odd
    assert len(samples) == 1 and samples[0]["user"] == "Test User" and samples[0]["n_keydowns"] == 48
    assert samples[0]["meta"]["page_version"] == "live-turn" and samples[0]["meta"]["distance"] < 2.5


def test_recording_can_be_disabled(client, tmp_path, monkeypatch):
    monkeypatch.setattr(backend, "RECORD", False)
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "u", "session": "norec"}); cap.receive_json()
        cap.send_json({"type": "events", "events": typed(20)}); cap.receive_json()
    assert not (tmp_path / "sessions").exists() or not list((tmp_path / "sessions").glob("*_norec.jsonl"))


def test_dashboard_hello_lists_sessions_and_heads(client):
    with client.websocket_connect("/ws/dashboard") as dash:
        hello = dash.receive_json()
        assert hello["type"] == "hello" and hello["sessions"] == []
        assert {"threat", "state"} <= set(hello["heads"])


def test_broadcast_drops_dead_dashboards():
    class Good:
        def __init__(self): self.got = []
        async def send_text(self, s): self.got.append(s)
    class Dead:
        async def send_text(self, s): raise RuntimeError("closed")
    good, dead = Good(), Dead()
    backend.dashboards.clear(); backend.dashboards.update({good, dead})
    asyncio.run(backend.broadcast({"type": "tick", "x": 1}))
    assert good.got and '"x": 1' in good.got[0]
    assert backend.dashboards == {good}
    backend.dashboards.clear()


def test_idle_pause_resets_head_histories(monkeypatch):
    monkeypatch.setattr(backend, "RECORD", False)
    monkeypatch.setattr(backend, "TICK_MS", 0)
    s = backend.Session("x", "u")
    s.add(typed(30)); s.tick()
    s.ctx["identity"] = {"history": ["someone"]}; s.ctx["threat"] = {"hist": [9.0]}
    s.last_tick -= backend.IDLE_RESET_S + 1                 # a long pause, then typing resumes
    s.add(typed(30, t0=60_000)); s.tick()
    assert "identity" not in s.ctx or s.ctx["identity"].get("history") != ["someone"]
    assert s.ctx.get("idle_reset") is True and s.ctx.get("threat", {}).get("hist") != [9.0]


def test_window_trims_old_events(monkeypatch):
    monkeypatch.setattr(backend, "RECORD", False)      # a bare Session must not write into data/sessions
    s = backend.Session("x", "u")
    s.add(typed(20, t0=0))
    s.add(typed(20, t0=60_000))          # a minute later
    w = s.window(10)
    assert all(e["t"] >= 60_000 for e in w) and len(w) == 40


def test_broken_head_does_not_kill_stream(client):
    def bad(features, baseline, ctx):
        raise RuntimeError("boom")
    backend.register_head("bad", bad)
    try:
        with client.websocket_connect("/ws/capture") as cap:
            cap.send_json({"type": "hello", "user": "u", "session": "s3"}); cap.receive_json()
            cap.send_json({"type": "events", "events": typed(30)})
            tick = cap.receive_json()
            assert tick["status"] == "ok" and "error" in tick["heads"]["bad"]
    finally:
        backend.HEADS.pop("bad", None)


# ---- identity head ----

def test_identity_head_without_model_reports_reason(client, monkeypatch, tmp_path):
    from backend import heads
    monkeypatch.setattr(heads, "MODEL_PATH", tmp_path / "missing.joblib")
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "u", "session": "s4"}); cap.receive_json()
        cap.send_json({"type": "events", "events": typed(30)})
        tick = cap.receive_json()
        assert tick["heads"]["identity"]["user"] is None and "no identity model" in tick["heads"]["identity"]["reason"]


def test_identity_head_recognises_and_rejects(client, monkeypatch, tmp_path):
    import pandas as pd
    from backend import heads
    from pipeline.identity import IdentityModel
    # two synthetic typists: fast/short holds vs slow/long holds
    rows = []
    rng = np.random.default_rng(1)
    for user, (fl, ho) in {"fast": (110, 55), "slow": (260, 140)}.items():
        for _ in range(15):
            f = backend.extract_features(typed(40, flight=fl + rng.normal(0, 8), hold=ho + rng.normal(0, 5)))
            rows.append({"user": user, "condition": "calm", **f})
    df = pd.DataFrame(rows)
    IdentityModel().fit(df, evaluate=False).save(tmp_path / "identity.joblib")
    monkeypatch.setattr(heads, "MODEL_PATH", tmp_path / "identity.joblib")
    heads._model_cache.clear()
    # baseline for "fast" so the open-set distance rule has something to compare with
    from pipeline.baseline import build_baseline
    build_baseline(df, "fast").save(tmp_path / "fast.json")
    build_baseline(df, "slow").save(tmp_path / "slow.json")
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "fast", "session": "s5"}); cap.receive_json()
        cap.send_json({"type": "events", "events": typed(40, flight=110, hold=55)})
        idn = cap.receive_json()["heads"]["identity"]
        assert idn["user"] == "fast" and idn["unknown"] is False and idn["matches_declared"] is True
        # someone unlike either known typist sits down: classifier still picks one, distance rule says unknown
        # (80 keys at 350 ms so the 10 s window holds >= UNKNOWN_MIN_KEYS; the rule is gated on window size)
        cap.send_json({"type": "reset"})
        cap.send_json({"type": "events", "events": typed(80, t0=90_000, flight=350, hold=30)})
        tick = cap.receive_json()
        idn = tick["heads"]["identity"]
        assert tick["n_keys"] >= heads.UNKNOWN_MIN_KEYS
        assert idn["unknown"] is True and idn["distance"] > heads.UNKNOWN_DIST
        # a thin window (first seconds of a session) is never enough to call someone unknown
        cap.send_json({"type": "reset"})
        cap.send_json({"type": "events", "events": typed(10, t0=200_000, flight=350, hold=30)})
        idn = cap.receive_json()["heads"]["identity"]
        assert idn["warming_up"] is True and idn["user"] is None and idn["unknown"] is False
        # someone between the two known typists: the classifier is unsure on most windows -> unknown
        cap.send_json({"type": "reset"})
        monkeypatch.setattr(heads, "UNKNOWN_CONF", 0.9)       # the two-typist toy model is never very unsure
        out = []
        for i in range(3):
            cap.send_json({"type": "events", "events": typed(40, t0=300_000 + i * 8_000, flight=185, hold=97)})
            out.append(cap.receive_json()["heads"]["identity"])
        assert out[-1]["confidence"] < heads.UNKNOWN_CONF and out[-1]["low_confidence"] is True and out[-1]["unknown"] is True


# ---- state head + API ----

def test_known_non_user_class_is_reported_unknown(client, monkeypatch, tmp_path):
    """A class named 'Stranger ...' (someone recorded on the dashboard, not enrolled) -> unknown,
    with the nearest real teammate in `closest`."""
    import pandas as pd
    from backend import heads
    from pipeline.identity import IdentityModel
    rows = []
    rng = np.random.default_rng(2)
    for user, (fl, ho) in {"fast": (110, 55), "Stranger 1": (150, 90), "slow": (260, 140)}.items():
        for _ in range(15):
            rows.append({"user": user, **backend.extract_features(typed(40, flight=fl + rng.normal(0, 6), hold=ho + rng.normal(0, 4)))})
    IdentityModel().fit(pd.DataFrame(rows), evaluate=False).save(tmp_path / "identity.joblib")
    monkeypatch.setattr(heads, "MODEL_PATH", tmp_path / "identity.joblib"); heads._model_cache.clear()
    assert heads.is_non_user("Stranger 1") and heads.is_non_user("stranger") and not heads.is_non_user("Utkarsh")
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "fast", "session": "s6"}); cap.receive_json()
        cap.send_json({"type": "events", "events": typed(40, flight=150, hold=90)})
        idn = cap.receive_json()["heads"]["identity"]
        assert idn["user"] == "Stranger 1" and idn["unknown"] is True and idn["matches_declared"] is False
        assert idn["closest"] in ("fast", "slow")


def test_state_head_rule_fallback_smooths_and_advises(client, tmp_path, monkeypatch):
    from backend import heads
    monkeypatch.setattr(heads, "STATE_MODEL_PATH", tmp_path / "missing.joblib")
    make_baseline(tmp_path)
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "Test User", "session": "s6"}); cap.receive_json()
        cap.send_json({"type": "events", "events": typed(40)})
        st = cap.receive_json()["heads"]["state"]
        assert st["source"] == "rule" and st["label"] == "deep focus" and st["advice"] == "defer"
        assert st["explainer"] == "template" and "Test User" in st["explanation"]
        first = st["load"]
        # much faster, sloppier typing: load rises but is smoothed (EMA), not a jump to the raw value
        ev = typed(60, t0=20_000, flight=60, hold=40)
        ev += [{"type": "down", "key": "Backspace", "code": "Backspace", "t": 20_000 + 60 * 60 + i * 60} for i in range(6)]
        ev += [{"type": "up", "key": "Backspace", "code": "Backspace", "t": 20_000 + 60 * 60 + i * 60 + 30} for i in range(6)]
        cap.send_json({"type": "events", "events": sorted(ev, key=lambda e: e["t"])})
        st2 = cap.receive_json()["heads"]["state"]
        assert st2["raw"] > st2["load"] > first
    r = client.get("/api/state").json()
    assert r["advice"] == "unknown"                      # session closed -> nothing active


def test_state_api_returns_latest_tick(client, tmp_path):
    make_baseline(tmp_path)
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "Test User", "session": "s7"}); cap.receive_json()
        cap.send_json({"type": "events", "events": typed(40)})
        cap.receive_json()
        r = client.get("/api/state").json()
        assert r["session"] == "s7" and r["user"] == "Test User"
        assert r["advice"] in ("defer", "ok") and 0 <= r["load"] <= 1 and r["age_s"] >= 0
        assert client.get("/api/state", params={"session": "nope"}).json()["advice"] == "unknown"


def test_state_head_uses_trained_model(client, tmp_path, monkeypatch):
    import pandas as pd
    from backend import heads
    from pipeline.state import StateModel, STATE_FEATURES
    # a model that says: faster typing = load
    Z = pd.DataFrame(np.zeros((40, len(STATE_FEATURES))), columns=STATE_FEATURES)
    Z.loc[20:, "speed_kps"] = 3.0
    y = np.array([0] * 20 + [1] * 20)
    m = StateModel().fit(Z, y)
    m.louo_auc = 0.5                                   # a weak model must NOT displace the rule
    m.save(tmp_path / "state.joblib")
    monkeypatch.setattr(heads, "STATE_MODEL_PATH", tmp_path / "state.joblib")
    heads._state_cache.clear()
    make_baseline(tmp_path)
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "Test User", "session": "s8"}); cap.receive_json()
        cap.send_json({"type": "events", "events": typed(40)})
        assert cap.receive_json()["heads"]["state"]["source"] == "rule"
    m.louo_auc = 0.9                                   # a good one is used
    m.save(tmp_path / "state.joblib")
    heads._state_cache.clear()
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "Test User", "session": "s9"}); cap.receive_json()
        cap.send_json({"type": "events", "events": typed(40)})
        st = cap.receive_json()["heads"]["state"]
        assert st["source"] == "model" and st["load"] < 0.5
        cap.send_json({"type": "reset"})
        cap.send_json({"type": "events", "events": typed(60, t0=30_000, flight=50, hold=50)})   # 2x+ faster
        st = cap.receive_json()["heads"]["state"]
        assert st["raw"] > 0.8 and st["drivers"][0][0] == "speed_kps"


def test_accounts_link_and_unlink(client, tmp_path, monkeypatch):
    monkeypatch.setattr(backend, "ACCOUNTS_PATH", tmp_path / "accounts.json")
    make_baseline(tmp_path)                                       # "Test User"
    assert client.get("/api/accounts/Someone@Example.com").json() == {"email": "someone@example.com", "user": None, "has_baseline": False, "linked_at": None}
    r = client.put("/api/accounts/Someone@Example.com", json={"user": "Test User"}).json()
    assert r["user"] == "Test User" and r["has_baseline"] is True and r["linked_at"]
    assert client.get("/api/accounts/someone@example.com").json()["user"] == "Test User"
    r2 = client.put("/api/accounts/new@example.com", json={"user": "Brand New"}).json()
    assert r2["user"] == "Brand New" and r2["has_baseline"] is False      # enrol later
    assert client.put("/api/accounts/nope", json={"user": "x"}).status_code == 400
    assert client.put("/api/accounts/a@b.c", json={}).status_code == 400
    assert client.delete("/api/accounts/someone@example.com").json()["removed"] is True
    assert client.get("/api/accounts/someone@example.com").json()["user"] is None
    assert (tmp_path / "accounts.json").exists()


def test_the_app_window_learns_who_signed_in_from_the_browser(client, tmp_path, monkeypatch):
    """
    Google's sign-in cannot run inside the desktop app window, so the browser signs in and
    records the account with the backend; the window reads it back. See the hand-off note in
    backend/app.py.
    """
    monkeypatch.setattr(backend, "ACCOUNTS_PATH", tmp_path / "accounts.json")
    monkeypatch.setattr(backend, "ACTIVE_PATH", tmp_path / "active_account.json")
    make_baseline(tmp_path)                                       # "Test User"
    assert client.get("/api/active-account").json() == {"email": None, "user": None, "has_baseline": False}
    # the browser signs in
    r = client.post("/api/active-account", json={"email": "Someone@Example.com", "name": "Someone"}).json()
    assert r["email"] == "someone@example.com" and r["user"] is None and r["name"] == "Someone"
    # once that email is linked to a profile, the window gets the profile with it
    client.put("/api/accounts/someone@example.com", json={"user": "Test User"})
    r = client.get("/api/active-account").json()
    assert r["user"] == "Test User" and r["has_baseline"] is True and r["at"]
    assert json.loads((tmp_path / "active_account.json").read_text())["email"] == "someone@example.com"
    # the browser that completed the sign-in is remembered, so the window opens that one first
    monkeypatch.setattr(actions, "SETTINGS_PATH", tmp_path / "settings.json")
    client.post("/api/active-account", json={"email": "someone@example.com", "browser": "chrome"})
    assert actions.settings()["signin_browser"] == "chrome"
    opened = []
    import webbrowser
    monkeypatch.setattr(webbrowser, "open", lambda url: opened.append(url) or True)
    launched = []
    import subprocess
    monkeypatch.setattr(subprocess, "Popen", lambda argv, **k: launched.append(argv) or None)
    monkeypatch.setattr(backend, "CHROME_PATHS", [pathlib.Path(__file__)])
    local2 = TestClient(backend.app, base_url="http://localhost:8000")
    r = local2.post("/api/signin/browser?browser=remembered").json()
    assert r["browser"] == "chrome" and launched and not opened
    # signing out anywhere clears it
    assert client.delete("/api/active-account").json()["email"] is None
    assert client.get("/api/active-account").json()["email"] is None
    assert client.post("/api/active-account", json={"email": "nope"}).status_code == 400
    assert client.post("/api/active-account", json={}).status_code == 400


def test_an_alert_with_no_camera_frame_still_sends_the_screen(client, tmp_path, monkeypatch):
    """
    The camera can give nothing: no camera, or another alert holding it. The screen snapshot
    still has to go out, which is the whole point of an intruder alert. Measured 2026-09-07:
    a real intruder alert reached the phone as text only because of this.
    """
    from backend import actions, faces, notify
    monkeypatch.setattr(notify, "PHOTO_DIR", tmp_path / "photos")
    monkeypatch.setattr(faces, "grab_screen", lambda *a, **k: JPEG_HEADER + b"the screen")
    monkeypatch.setenv("KEYSIGN_NTFY_TOPIC", "keysign-test")
    pushed = []
    monkeypatch.setattr(notify, "_post_photo", lambda a, path, title, msg: pushed.append((title, path.name)))
    alert = {"ts": 4000.0, "session": "s", "kind": "intruder", "user": "owner", "identity": "Someone Else"}
    r = backend.process_alert_photo(alert, None, source="backend-no-frame")
    assert r["photo"] is None and r["screen"] == "4000_s_screen.jpg"
    assert r["final_kind"] == "intruder" and r["face"]["reason"].startswith("no camera frame")
    import time as _t
    for _ in range(50):
        if pushed:
            break
        _t.sleep(0.02)
    assert pushed == [("KeySign: what was on the screen", "4000_s_screen.jpg")]
    # a duress alert still keeps its images at home
    pushed.clear()
    dur = {"ts": 4100.0, "session": "s", "kind": "duress", "user": "owner", "identity": "owner"}
    r = backend.process_alert_photo(dur, None, source="backend-no-frame")
    assert r["final_kind"] == "duress"
    _t.sleep(0.1)
    assert pushed == []


def test_only_one_thread_opens_the_camera_and_a_fresh_burst_is_shared(monkeypatch):
    """
    Two alerts can land a fraction of a second apart (the agent scores every application
    while a dashboard scores its own window). When both opened the camera at once neither
    got a frame, and a real intruder alert went to the phone with no photo and no screen.
    The second one is now handed the first one's burst.
    """
    import sys
    import threading
    from backend import actions
    opens = []
    inside = threading.Event()
    release = threading.Event()

    class FakeCap:
        def __init__(self, index):
            opens.append(index)
            inside.set()                      # the second caller may start now
            release.wait(2)                   # ...and it must wait for the lock, not the camera
        def isOpened(self): return len(opens) == 1     # a second real open fails, as it did here
        def read(self): return True, "frame"
        def release(self): pass

    monkeypatch.setitem(sys.modules, "cv2", type("cv2", (), {
        "VideoCapture": FakeCap, "IMWRITE_JPEG_QUALITY": 1,
        "imencode": staticmethod(lambda ext, f, p: (True, bytearray(b"jpeg")))}))
    monkeypatch.setattr(actions, "_last_burst", (0.0, []))
    real = actions.real_grab_webcam_burst          # the suite replaces the real one (conftest)
    got: dict[str, list] = {}

    def grab(name):
        got[name] = real(n=1, gap_s=0, warmup_frames=0)

    first = threading.Thread(target=grab, args=("first",)); first.start()
    assert inside.wait(2), "the first caller never reached the camera"
    second = threading.Thread(target=grab, args=("second",)); second.start()
    release.set()
    first.join(5); second.join(5)
    assert opens == [0], f"the camera was opened {len(opens)} times"
    assert got["first"] and got["second"] == got["first"], "the second alert was left with no frame"


def test_enrolling_someone_cannot_make_identity_worse(tmp_path, monkeypatch):
    """
    Retraining across everyone with a ten-sentence class can cost accuracy. The model in use is
    kept aside and put back when the new one is worse, so enrolling a reviewer during a demo
    cannot quietly stop the machine recognising the team.
    """
    from backend import enrol as E
    model = tmp_path / "identity.joblib"
    model.write_bytes(b"the model that works")
    monkeypatch.setattr(E, "MODEL_PATH", model)
    scores = iter([0.94, 0.80])                       # before, after
    monkeypatch.setattr(E, "model_accuracy", lambda *a, **k: next(scores))
    def fake_run(argv, **kw):
        model.write_bytes(b"a worse model")           # training overwrites it
        return type("R", (), {"returncode": 0, "stdout": "identity: ...", "stderr": ""})()
    monkeypatch.setattr(E.subprocess, "run", fake_run)
    monkeypatch.setattr(E, "SAMPLES_DIR", tmp_path)
    (tmp_path / "enrolled_x.json").write_text("[]", encoding="utf-8")
    E.retrain_identity("Reviewer")
    for _ in range(60):
        if E.status().get("state") == "ready":
            break
        time.sleep(0.05)
    assert model.read_bytes() == b"the model that works", "the worse model was left in place"
    assert "kept the previous identity model" in E.status()["message"], E.status()

    # a retrain that holds up is kept
    model.write_bytes(b"the model that works")
    scores2 = iter([0.94, 0.93])
    monkeypatch.setattr(E, "model_accuracy", lambda *a, **k: next(scores2))
    E.retrain_identity("Reviewer")
    for _ in range(60):
        if "93%" in E.status().get("message", ""):
            break
        time.sleep(0.05)
    assert model.read_bytes() == b"a worse model"     # i.e. the newly trained one
    assert "retrained" in E.status()["message"]


def test_signin_browser_opens_only_this_backend(client, tmp_path, monkeypatch):
    """The window asks the backend to open the browser; only its own loopback address is opened."""
    opened = []
    import webbrowser
    monkeypatch.setattr(webbrowser, "open", lambda url: opened.append(url) or True)
    local = TestClient(backend.app, base_url="http://localhost:8000")
    r = local.post("/api/signin/browser").json()
    assert r["ok"] is True and r["url"] == "http://localhost:8000/?signin=1"
    assert opened == ["http://localhost:8000/?signin=1"]
    # the default browser is not always the one the person uses Google in (here it is Arc), so
    # Chrome can be asked for by name when it is installed
    launched = []
    import subprocess
    monkeypatch.setattr(subprocess, "Popen", lambda argv, **k: launched.append(argv) or None)
    monkeypatch.setattr(backend, "CHROME_PATHS", [pathlib.Path(__file__)])          # stand in for chrome.exe
    r = local.post("/api/signin/browser?browser=chrome").json()
    assert r["ok"] is True and r["chrome_available"] is True and r["browser"] == "chrome"
    assert launched and launched[0][1] == "http://localhost:8000/?signin=1"
    # with no Chrome installed it says so, and falls back to the default browser
    monkeypatch.setattr(backend, "CHROME_PATHS", [])
    opened.clear()
    r = local.post("/api/signin/browser?browser=chrome").json()
    assert r["chrome_available"] is False and opened == ["http://localhost:8000/?signin=1"]
    # "remembered" with nothing remembered still prefers Chrome when it is installed: the
    # hand-off has to reach a browser holding a Google session, and this machine's default
    # (Arc) does not
    monkeypatch.setattr(actions, "SETTINGS_PATH", tmp_path / "fresh-settings.json")
    monkeypatch.setattr(backend, "CHROME_PATHS", [pathlib.Path(__file__)])
    launched.clear(); opened.clear()
    r = local.post("/api/signin/browser?browser=remembered").json()
    assert r["browser"] == "chrome" and launched and not opened
    # anything that is not this machine is refused, so the endpoint cannot open arbitrary pages
    opened.clear()
    assert client.post("/api/signin/browser").status_code == 400        # base_url http://testserver
    assert opened == []
