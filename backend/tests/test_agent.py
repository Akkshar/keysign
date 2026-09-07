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
    assert set(d) == {"lock_on_intruder", "photo_on_intruder", "declared_user", "toast_on_alert"}
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
    monkeypatch.setattr(actions, "PHOTO_SETTLE_S", 0.05)
    monkeypatch.setattr(actions, "LOCK_DELAY_S", 0.05)
    calls = []
    monkeypatch.setattr(actions, "grab_webcam_burst", lambda **k: [b"\xff\xd8jpeg"])
    monkeypatch.setattr(actions, "lock_workstation", lambda: calls.append("lock") or True)
    from backend import faces, notify
    monkeypatch.setattr(faces, "verify_frames", lambda user, frames: ({"face": False, "match": None, "distance": None}, frames[-1]))
    monkeypatch.setattr(notify, "PHOTO_DIR", tmp_path / "photos")
    pushed_text = []
    monkeypatch.setattr(notify, "push_alert", lambda a, why="": pushed_text.append(why) or {"sent": True})
    processed = []
    actions.update_settings({"lock_on_intruder": True, "photo_on_intruder": True})
    actions.on_alert({"ts": 123.0, "kind": "intruder", "user": "owner", "session": "s", "identity": "Someone Else"},
                     lambda alert, jpeg, source, verdict=None: processed.append((alert["ts"], source)))
    time.sleep(0.6)
    assert processed == [(123.0, "backend-webcam")] and calls == ["lock"]
    assert pushed_text == ["typing identified as Someone Else; no face in frame"]
    # the dashboard already sent a frame: no fallback grab, still the lock
    processed.clear(); calls.clear()
    actions.photo_arrived(124.0)
    actions.on_alert({"ts": 124.0, "kind": "intruder", "user": "owner", "identity": "Someone Else"}, lambda *a, **k: processed.append(a))
    time.sleep(0.6)
    assert processed == [] and calls == ["lock"]
    # duress: the camera looks too (is the victim really the owner?) but with no verdict it never locks,
    # and the text alert is pushed as duress
    processed.clear(); calls.clear(); pushed_text.clear()
    actions.on_alert({"ts": 125.0, "kind": "duress", "user": "owner"},
                     lambda alert, jpeg, source, verdict=None: processed.append((alert["ts"], source)))
    time.sleep(0.6)
    assert processed == [(125.0, "backend-webcam")] and calls == [] and pushed_text == ["typing far off under load; no face in frame"]
    # lock switched off
    actions.update_settings({"lock_on_intruder": False})
    actions.on_alert({"ts": 126.0, "kind": "intruder", "user": "owner", "identity": "Someone Else"}, lambda alert, jpeg, source, verdict=None: None)
    time.sleep(0.5)
    assert calls == []


def test_tick_triggers_alert_actions_once(client, tmp_path, monkeypatch):
    """A new alert on a tick hands the alert to backend.actions once, not on every later tick."""
    from backend import heads

    make_baseline(tmp_path)
    handed = []
    monkeypatch.setattr(actions, "on_alert", lambda alert, fn: handed.append(alert["kind"]))
    with client.websocket_connect("/ws/capture") as cap:
        cap.send_json({"type": "hello", "user": "Test User", "session": "act1"}); cap.receive_json()
        cap.send_json({"type": "events", "events": typed(40, t0=0, flight=60, hold=30)}); cap.receive_json()
        for i in range(1, heads.THREAT_PERSIST + 3):
            cap.send_json({"type": "events", "events": typed(25, t0=2_500 + i * 2_000, flight=60, hold=30)})
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


def test_face_check_vetoes_or_confirms_the_lock():
    a = {"ts": 1.0, "kind": "intruder", "user": "owner", "identity": "Someone Else"}
    lock, why = actions.should_lock(a, {"match": True})
    assert lock is False and why.startswith("face matched the owner")
    assert actions.should_lock(a, {"match": False})[0] is True
    lock, why = actions.should_lock(a, None)
    assert lock is True and why == "typing identified as Someone Else; no camera frame"
    assert actions.should_lock({"ts": 1.0, "kind": "intruder", "user": "owner", "identity": "owner"}, {"match": None, "face": False})[0] is True


def test_decision_table_combines_typing_and_camera():
    """The camera is the second factor for both kinds (table in backend/actions.py)."""
    intr = {"ts": 1.0, "kind": "intruder", "user": "owner", "identity": "Someone Else"}
    dur = {"ts": 2.0, "kind": "duress", "user": "owner", "identity": "owner"}
    other, owner, unsure = {"match": False, "similarity": 0.12, "face": True, "enrolled": 5}, \
        {"match": True, "similarity": 0.61, "face": True, "enrolled": 5}, {"match": None, "face": True, "enrolled": 5, "reason": "face turned away"}
    d = actions.decide(intr, other);  assert (d["kind"], d["push"], d["lock"], d["images"]) == ("intruder", True, True, True)
    d = actions.decide(intr, owner);  assert (d["kind"], d["push"], d["lock"], d["images"]) == (None, False, False, False)
    d = actions.decide(intr, unsure); assert (d["kind"], d["push"], d["lock"], d["images"]) == ("intruder", True, True, True)
    d = actions.decide(dur, other);   assert (d["kind"], d["push"], d["lock"], d["images"]) == ("intruder", True, False, True)
    assert "duress" in d["why"]                                          # says the typing disagreed, hence no lock
    d = actions.decide(dur, owner);   assert (d["kind"], d["push"], d["lock"], d["images"]) == ("duress", True, False, False)
    assert "0.61" in d["why"]
    d = actions.decide(dur, unsure);  assert (d["kind"], d["push"], d["lock"], d["images"]) == ("duress", True, False, False)
    d = actions.decide(dur, None);    assert d["kind"] == "duress" and d["lock"] is False and "no camera frame" in d["why"]
    # real duress reaches the head as "intruder" (typing under pressure loses the classifier's
    # confidence). The camera says the owner AND the duress clock was full: push it as duress
    # rather than keeping it local, which is what would silence a genuine duress alert.
    under_pressure = {**intr, "duress_ready": True}
    d = actions.decide(under_pressure, owner)
    assert (d["kind"], d["push"], d["lock"], d["images"]) == ("duress", True, False, False)
    assert "under pressure" in d["why"]
    d = actions.decide({**intr, "duress_ready": False}, owner);  assert d["kind"] is None and d["push"] is False


def test_duress_with_a_stranger_in_frame_becomes_an_intruder_without_the_lock(monkeypatch, tmp_path):
    monkeypatch.setattr(actions, "SETTINGS_PATH", tmp_path / "settings.json")
    monkeypatch.setattr(actions, "PHOTO_GRACE_S", 0.05)
    monkeypatch.setattr(actions, "PHOTO_SETTLE_S", 0.05)
    monkeypatch.setattr(actions, "LOCK_DELAY_S", 0.05)
    calls, pushed, toasts = [], [], []
    monkeypatch.setattr(actions, "grab_webcam_burst", lambda **k: [b"\xff\xd8jpeg"])
    monkeypatch.setattr(actions, "lock_workstation", lambda: calls.append("lock") or True)
    monkeypatch.setattr(actions, "TOAST_HOOK", lambda title, msg: toasts.append(title))
    from backend import faces, notify
    monkeypatch.setattr(notify, "PHOTO_DIR", tmp_path / "photos")
    monkeypatch.setattr(notify, "push_alert", lambda a, why="": pushed.append((a["kind"], a.get("typed_kind"))) or {"sent": True})
    monkeypatch.setattr(faces, "verify_frames", lambda user, frames: ({"face": True, "match": False, "similarity": 0.1, "enrolled": 5}, frames[0]))
    actions.update_settings({"lock_on_intruder": True, "photo_on_intruder": True, "toast_on_alert": True})
    actions.on_alert({"ts": 700.0, "kind": "duress", "user": "owner", "session": "s", "identity": "owner"},
                     lambda alert, jpeg, source, verdict=None: {"ok": True, "face": dict(verdict)})
    time.sleep(0.6)
    assert pushed == [("intruder", "duress")] and calls == [] and toasts == ["KeySign: someone else at the keyboard"]
    marked = json.loads((tmp_path / "photos" / "700_s.json").read_text())
    assert marked["final_kind"] == "intruder" and marked["pushed"] is True
    # the owner in frame under duress: pushed as duress, toast, no lock
    pushed.clear(); calls.clear(); toasts.clear()
    monkeypatch.setattr(faces, "verify_frames", lambda user, frames: ({"face": True, "match": True, "similarity": 0.55, "enrolled": 5}, frames[0]))
    actions.on_alert({"ts": 701.0, "kind": "duress", "user": "owner", "session": "s", "identity": "owner", "distance": 3.4},
                     lambda alert, jpeg, source, verdict=None: {"ok": True, "face": dict(verdict)})
    time.sleep(0.6)
    assert pushed == [("duress", "duress")] and calls == [] and toasts == ["KeySign: possible duress"]
    # toasts can be switched off; the push still goes
    pushed.clear(); toasts.clear()
    actions.update_settings({"toast_on_alert": False})
    actions.on_alert({"ts": 702.0, "kind": "duress", "user": "owner", "session": "s", "identity": "owner"},
                     lambda alert, jpeg, source, verdict=None: {"ok": True, "face": dict(verdict)})
    time.sleep(0.6)
    assert pushed == [("duress", "duress")] and toasts == []


def test_agent_capture_drops_shortcut_chords():
    """Ctrl+C is a command, not typing: the chord and the modifier itself never reach the stream."""
    from agent.capture import Capture

    class K:
        def __init__(self, char=None, name=None): self.char, self.name = char, name
    c = Capture("ws://127.0.0.1:1/ws/capture", user=lambda: "u")
    down, up = c._on("down"), c._on("up")
    down(K(char="a")); up(K(char="a"))                         # plain typing
    down(K(name="ctrl_l")); down(K(char="c")); up(K(char="c")); up(K(name="ctrl_l"))   # Ctrl+C
    down(K(name="shift")); down(K(char="B")); up(K(char="B")); up(K(name="shift"))     # a capital: typing
    down(K(name="alt_l")); down(K(name="tab")); up(K(name="tab")); up(K(name="alt_l"))  # Alt+Tab
    keys = [(e["type"], e["key"]) for e in c._q]
    assert keys == [("down", "a"), ("up", "a"), ("down", "Shift"), ("down", "B"), ("up", "B"), ("up", "Shift")]
    assert c.chords_dropped == 2 and c.status()["chords_dropped"] == 2


def test_alert_actions_do_not_lock_when_the_face_is_the_owner(monkeypatch, tmp_path):
    monkeypatch.setattr(actions, "SETTINGS_PATH", tmp_path / "settings.json")
    monkeypatch.setattr(actions, "PHOTO_GRACE_S", 0.05)
    monkeypatch.setattr(actions, "PHOTO_SETTLE_S", 0.05)
    monkeypatch.setattr(actions, "LOCK_DELAY_S", 0.05)
    calls = []
    monkeypatch.setattr(actions, "grab_webcam_burst", lambda **k: [b"\xff\xd8jpeg"])
    monkeypatch.setattr(actions, "lock_workstation", lambda: calls.append("lock") or True)
    from backend import faces, notify
    monkeypatch.setattr(notify, "PHOTO_DIR", tmp_path / "photos")
    pushed_text = []
    monkeypatch.setattr(notify, "push_alert", lambda a, why="": pushed_text.append(why) or {"sent": True})
    monkeypatch.setattr(faces, "verify_frames", lambda user, frames: ({"face": True, "match": True, "distance": 30.0}, frames[0]))
    actions.update_settings({"lock_on_intruder": True, "photo_on_intruder": True})
    actions.on_alert({"ts": 500.0, "kind": "intruder", "user": "owner", "identity": "Someone Else"},
                     lambda alert, jpeg, source, verdict=None: {"ok": True, "face": dict(verdict)})
    time.sleep(0.6)
    assert calls == [] and pushed_text == []                       # owner in frame: nothing pushed, no lock
    marked = json.loads((tmp_path / "photos" / "500_s.json").read_text()) if (tmp_path / "photos" / "500_s.json").exists() else json.loads((tmp_path / "photos" / "500_None.json").read_text())
    assert marked["pushed"] is False and "owner" in marked["reason"]
    monkeypatch.setattr(faces, "verify_frames", lambda user, frames: ({"face": True, "match": False, "distance": 80.0}, frames[0]))
    actions.on_alert({"ts": 501.0, "kind": "intruder", "user": "owner", "identity": "Someone Else"},
                     lambda alert, jpeg, source, verdict=None: {"ok": True, "face": dict(verdict)})
    time.sleep(0.6)
    assert calls == ["lock"] and pushed_text == ["camera: not the owner at the keyboard"]


def test_a_frame_from_the_dashboard_stops_the_machine_opening_its_own_camera(monkeypatch, tmp_path):
    """The usual case: a dashboard is open and posts a frame. The alert must be decided from
    that frame, as soon as its face check lands, without the backend opening the camera too."""
    monkeypatch.setattr(actions, "SETTINGS_PATH", tmp_path / "settings.json")
    monkeypatch.setattr(actions, "PHOTO_GRACE_S", 1.0)
    monkeypatch.setattr(actions, "PHOTO_SETTLE_S", 0.2)
    monkeypatch.setattr(actions, "LOCK_DELAY_S", 0.05)
    grabs, pushed, calls = [], [], []
    monkeypatch.setattr(actions, "grab_webcam_burst", lambda **k: grabs.append("grab") or [b"\xff\xd8jpeg"])
    monkeypatch.setattr(actions, "lock_workstation", lambda: calls.append("lock") or True)
    from backend import notify
    monkeypatch.setattr(notify, "PHOTO_DIR", tmp_path / "photos")
    monkeypatch.setattr(notify, "push_alert", lambda a, why="": pushed.append((a["kind"], why)) or {"sent": True, "channel": "ntfy"})
    actions.update_settings({"lock_on_intruder": True, "photo_on_intruder": True})
    alert = {"ts": 900.0, "kind": "intruder", "user": "owner", "session": "s", "identity": "Someone Else"}
    t0 = time.time()
    actions.on_alert(alert, lambda *a, **k: None)
    time.sleep(0.2)                                          # the dashboard's frame lands mid-grace
    notify.save_verdict(900.0, "s", {"face": True, "match": True, "similarity": 0.62, "enrolled": 5})
    actions.photo_arrived(900.0)
    for _ in range(40):                                      # let the alert thread finish
        if json.loads((tmp_path / "photos" / "900_s.json").read_text()).get("reason"):
            break
        time.sleep(0.05)
    decided = json.loads((tmp_path / "photos" / "900_s.json").read_text())
    assert grabs == [], "the machine opened its own camera even though a frame had arrived"
    assert pushed == [] and calls == []                      # the frame says the owner: kept local, no lock
    assert decided["pushed"] is False and "owner" in decided["reason"]
    assert time.time() - t0 < 1.0, "it waited out the whole grace instead of taking the frame when it landed"


def test_bystander_faces_are_ignored_and_best_frame_wins(monkeypatch):
    from backend import faces
    import numpy as np
    small = np.zeros((480, 640), dtype=np.uint8)
    monkeypatch.setattr(faces, "_detector", lambda: type("D", (), {"detectMultiScale": lambda self, g, **k: np.array([[40, 100, 100, 100]])})())
    assert faces.largest_face(small) is None                       # 100 px in a 480 px frame: two desks back
    monkeypatch.setattr(faces, "_detector", lambda: type("D", (), {"detectMultiScale": lambda self, g, **k: np.array([[40, 100, 100, 100], [260, 150, 200, 200]])})())
    assert faces.largest_face(small) == (260, 150, 200, 200)
    seq = iter([{"face": True, "match": False, "distance": 80.0, "score": -80.0}, {"face": True, "match": True, "distance": 40.0, "score": -40.0},
                {"face": False, "match": None, "distance": None, "score": None}])
    monkeypatch.setattr(faces, "verify", lambda user, jpeg, threshold=None: next(seq))
    v, frame = faces.verify_frames("owner", [b"a", b"b", b"c"])
    assert v["match"] is True and v["distance"] == 40.0 and frame == b"b" and v["frames"] == 3


def test_face_engine_and_blank_frames():
    """Whichever engine is on this machine (SFace with the ONNX models, LBPH without), a blank frame has
    no face, and an unknown user is not enrolled."""
    import io
    from PIL import Image
    from backend import faces
    assert faces.method() in ("sface", "lbph")
    buf = io.BytesIO(); Image.new("RGB", (640, 480), (128, 128, 128)).save(buf, format="JPEG"); blank = buf.getvalue()
    v = faces.verify("Nobody Enrolled", blank)
    assert v["face"] is False and v["match"] is None and v["method"] == faces.method() and v["score"] is None
    assert faces.n_samples("Nobody Enrolled") == 0
    v, frame = faces.verify_frames("Nobody Enrolled", [blank, blank])
    assert v["face"] is False and frame == blank
