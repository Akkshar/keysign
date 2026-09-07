"""Desktop-agent pieces: redacted recordings, settings, alert actions, the served dashboard, key mapping."""
import json
import time

from fastapi.testclient import TestClient

from backend import actions
from backend import app as backend
from backend.tests.test_app import client, make_baseline, typed  # noqa: F401  (client is a fixture)


def test_redacted_session_records_key_classes_only(client, tmp_path):
    from backend import sessions as rec
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "u", "session": "agent1", "source": "agent", "redact": True}); cap.receive_json()
        ev = typed(12) + [{"type": "down", "key": "Backspace", "code": "Backspace", "t": 5000.0},
                          {"type": "up", "key": "Backspace", "code": "Backspace", "t": 5060.0}]
        cap.send_json({"type": "events", "events": ev}); tick = cap.receive_json()
        assert tick["n_keys"] == 13 and tick["features"]["error_rate"] > 0          # scored from the real keys
    recs = rec.read(next((tmp_path / "sessions").glob("*_agent1.jsonl")))
    assert recs[0]["source"] == "agent" and recs[0]["redacted"] is True
    stored = [r for r in recs if r["type"] == "events"][0]["events"]
    assert all(set(e) == {"type", "class", "t"} for e in stored)                    # no key, no code
    assert {e["class"] for e in stored} == {"letter", "edit"}
    assert "key" not in json.dumps(stored) and "KeyA" not in json.dumps(recs)


def test_browser_session_recording_keeps_keys(client, tmp_path):
    from backend import sessions as rec
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "u", "session": "br1"}); cap.receive_json()
        cap.send_json({"type": "events", "events": typed(10)}); cap.receive_json()
    recs = rec.read(next((tmp_path / "sessions").glob("*_br1.jsonl")))
    assert recs[0]["redacted"] is False and [r for r in recs if r["type"] == "events"][0]["events"][0]["code"] == "KeyA"


def test_key_class():
    kc = backend.key_class
    assert kc({"key": "a", "code": "KeyA"}) == "letter" and kc({"key": "7", "code": "Digit7"}) == "digit"
    assert kc({"key": " ", "code": "Space"}) == "space" and kc({"key": "Backspace", "code": "Backspace"}) == "edit"
    assert kc({"key": "Shift", "code": "ShiftLeft"}) == "modifier" and kc({"key": "Enter", "code": "Enter"}) == "control"
    assert kc({"key": "?", "code": "Other"}) == "other"


def test_settings_roundtrip(client, tmp_path, monkeypatch):
    monkeypatch.setattr(actions, "SETTINGS_PATH", tmp_path / "settings.json")
    d = client.get("/api/settings").json()
    assert set(d) == {"lock_on_intruder", "photo_on_intruder", "declared_user"}
    r = client.put("/api/settings", json={"lock_on_intruder": False, "declared_user": "Test User", "junk": 1}).json()
    assert r["lock_on_intruder"] is False and r["declared_user"] == "Test User" and "junk" not in r
    assert json.loads((tmp_path / "settings.json").read_text())["declared_user"] == "Test User"
    assert client.put("/api/settings", json=[1]).status_code == 400


def test_agent_status_endpoint(client, monkeypatch):
    monkeypatch.setattr(backend, "AGENT_STATUS", None)
    assert client.get("/api/agent").json() == {"running": False}
    monkeypatch.setattr(backend, "AGENT_STATUS", lambda: {"paused": False, "keys_sent": 42})
    assert client.get("/api/agent").json() == {"running": True, "paused": False, "keys_sent": 42}


def test_alert_actions_webcam_fallback_then_lock(monkeypatch, tmp_path):
    monkeypatch.setattr(actions, "SETTINGS_PATH", tmp_path / "settings.json")
    monkeypatch.setattr(actions, "PHOTO_GRACE_S", 0.05)
    monkeypatch.setattr(actions, "LOCK_DELAY_S", 0.05)
    calls = []
    monkeypatch.setattr(actions, "grab_webcam", lambda: b"\xff\xd8jpeg")
    monkeypatch.setattr(actions, "lock_workstation", lambda: calls.append("lock") or True)
    processed = []
    actions.update_settings({"lock_on_intruder": True, "photo_on_intruder": True})
    actions.on_alert({"ts": 123.0, "kind": "intruder", "user": "owner", "session": "s"},
                     lambda alert, jpeg, source: processed.append((alert["ts"], source)))
    time.sleep(0.5)
    assert processed == [(123.0, "backend-webcam")] and calls == ["lock"]
    # the dashboard already sent a frame: no fallback grab, still the lock
    processed.clear(); calls.clear()
    actions.photo_arrived(124.0)
    actions.on_alert({"ts": 124.0, "kind": "intruder", "user": "owner"}, lambda *a, **k: processed.append(a))
    time.sleep(0.5)
    assert processed == [] and calls == ["lock"]
    # duress never locks and never photographs
    processed.clear(); calls.clear()
    actions.on_alert({"ts": 125.0, "kind": "duress", "user": "owner"}, lambda *a, **k: processed.append(a))
    time.sleep(0.3)
    assert processed == [] and calls == []
    # lock switched off
    actions.update_settings({"lock_on_intruder": False})
    actions.on_alert({"ts": 126.0, "kind": "intruder", "user": "owner"}, lambda alert, jpeg, source: None)
    time.sleep(0.4)
    assert calls == []


def test_tick_triggers_alert_actions_once(client, tmp_path, monkeypatch):
    """A new alert on a tick hands the alert to backend.actions once, not on every later tick."""
    from backend import heads

    make_baseline(tmp_path)
    handed = []
    monkeypatch.setattr(actions, "on_alert", lambda alert, fn: handed.append(alert["kind"]))
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "Test User", "session": "act1"}); cap.receive_json()
        cap.send_json({"type": "events", "events": typed(40, t0=0, flight=200, hold=150)}); cap.receive_json()
        for i in range(1, heads.THREAT_PERSIST + 3):
            cap.send_json({"type": "events", "events": typed(10, t0=8_000 + i * 2_000, flight=200, hold=150)})
            tick = cap.receive_json()
    assert tick["heads"]["threat"]["alerts_total"] == 1 and handed == ["duress"]


def test_dashboard_is_served_when_built(client):
    from backend.app import UI_DIST
    if not UI_DIST.exists():
        return                                   # no build on this machine: nothing to serve
    r = client.get("/")
    assert r.status_code == 200 and "<div id=\"root\"" in r.text
    assert client.get("/api/info").json()["service"] == "KeySign backend"


def test_agent_key_mapping():
    from agent.capture import key_event, looks_secret

    class K:                                     # stand-in for pynput keys
        def __init__(self, char=None, name=None): self.char, self.name = char, name
    assert key_event(K(char="a"), "down", 1.0) == {"type": "down", "key": "a", "code": "KeyA", "t": 1.0}
    assert key_event(K(char="Q"), "up", 2.0)["code"] == "KeyQ"
    assert key_event(K(char="5"), "down", 3.0)["code"] == "Digit5"
    assert key_event(K(name="space"), "down", 4.0) == {"type": "down", "key": " ", "code": "Space", "t": 4.0}
    assert key_event(K(name="backspace"), "down", 5.0)["key"] == "Backspace"
    assert key_event(K(name="shift"), "down", 6.0)["key"] == "Shift" and key_event(K(name="shift_r"), "down", 6.0)["code"] == "ShiftRight"
    assert key_event(K(name="f5"), "down", 7.0) is None and key_event(K(name="left"), "down", 7.0) is None
    assert looks_secret("Bitwarden - Vault") and looks_secret("Sign in - Google Accounts") and not looks_secret("main.py - Visual Studio Code")
