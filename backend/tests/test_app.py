"""
Run:  uv run python -m pytest backend/tests -q

Uses FastAPI's TestClient. Its WebSocket sessions each run on their own event
loop, so a message broadcast from one test socket to another can deadlock;
the capture socket therefore echoes every tick back to its sender and the
tests read ticks there. Broadcasting itself is unit-tested with fakes.
"""
import asyncio

import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend import app as backend
from pipeline.baseline import BASELINE_FEATURES, Baseline, robust_center_scale
from pipeline.features import FEATURE_NAMES


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
    monkeypatch.setattr(backend, "TICK_MS", 0)               # no rate limit in tests
    from backend import heads
    monkeypatch.setattr(heads, "_alert_log_path", tmp_path / "alerts.jsonl")   # don't write real alerts
    monkeypatch.delenv("KEYSIGN_NTFY_TOPIC", raising=False)
    # never pick up models trained on the real team data
    monkeypatch.setattr(heads, "MODEL_PATH", tmp_path / "no-identity.joblib")
    monkeypatch.setattr(heads, "STATE_MODEL_PATH", tmp_path / "no-state.joblib")
    heads._model_cache.clear(); heads._state_cache.clear()
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
        # a very different typist sits down
        cap.send_json({"type": "reset"})
        cap.send_json({"type": "events", "events": typed(40, t0=50_000, flight=200, hold=150)})
        tick = cap.receive_json()
        assert tick["n_keys"] == 40                                      # reset cleared the buffer (40 x 200 ms fits the 10 s window)
        assert tick["distance"] > 3.0
        assert tick["heads"]["threat"]["level"] == "warn"               # one tick is not enough
        from backend import heads
        for i in range(1, heads.THREAT_PERSIST):                         # sustained -> alert
            cap.send_json({"type": "events", "events": typed(10, t0=58_000 + i * 2_000, flight=200, hold=150)})
            tick = cap.receive_json()
            assert tick["n_keys"] >= heads.THREAT_MIN_KEYS
        assert tick["heads"]["threat"]["level"] == "alert" and tick["heads"]["threat"]["kind"] in ("duress", "intruder")


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


def test_window_trims_old_events():
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


# ---- state head + API ----

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
