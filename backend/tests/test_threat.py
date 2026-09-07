"""Threat head: persistence, classification, cooldown, silent alert channel."""
import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend import app as backend
from backend import heads, notify
from pipeline.baseline import BASELINE_FEATURES, Baseline, robust_center_scale


def typed(n, t0=0.0, flight=120.0, hold=60.0):
    ev, t = [], t0
    for i in range(n):
        ch = "abcdefghij"[i % 10]
        ev.append({"type": "down", "key": ch, "code": f"Key{ch.upper()}", "t": t})
        ev.append({"type": "up", "key": ch, "code": f"Key{ch.upper()}", "t": t + hold})
        t += flight
    return sorted(ev, key=lambda e: e["t"])


def normal_features():
    return backend.extract_features(typed(40))


def odd_features():
    return backend.extract_features(typed(40, flight=400, hold=150))


@pytest.fixture
def baseline():
    rng = np.random.default_rng(0)
    rows = [[backend.extract_features(typed(40, flight=120 + rng.normal(0, 5), hold=60 + rng.normal(0, 3)))[k]
             for k in BASELINE_FEATURES] for _ in range(20)]
    c, s = robust_center_scale(np.array(rows))
    return Baseline(user="Test User", features=BASELINE_FEATURES, center=c, scale=s, n_samples=20)


@pytest.fixture
def alert_log(tmp_path, monkeypatch):
    p = tmp_path / "alerts.jsonl"
    monkeypatch.setattr(heads, "_alert_log_path", p)
    monkeypatch.setattr(notify, "ALERT_LOG", p)
    monkeypatch.delenv("KEYSIGN_NTFY_TOPIC", raising=False)
    return p


def ctx_with(identity=None, state=None, user="Test User"):
    return {"user": user, "session": "s", "heads_so_far": {"identity": identity or {}, "state": state or {}}}


def test_no_baseline():
    out = heads.threat_head(normal_features(), None, {})
    assert out["level"] == "none"


def test_alert_needs_sustained_deviation(baseline, alert_log):
    ctx = ctx_with(identity={"user": "Test User", "matches_declared": True, "unknown": False})
    assert heads.threat_head(normal_features(), baseline, ctx)["level"] == "ok"
    levels = [heads.threat_head(odd_features(), baseline, ctx)["level"] for _ in range(heads.THREAT_PERSIST)]
    assert levels[:-1] == ["warn"] * (heads.THREAT_PERSIST - 1) and levels[-1] == "alert"
    out = heads.threat_head(odd_features(), baseline, ctx)
    assert out["level"] == "alert" and out["sustained_ticks"] == heads.THREAT_PERSIST
    assert out["alerts_total"] == 1                              # fired once on entering alert
    assert out["last_alert"]["channel"] == "log-only" and out["last_alert"]["sent"] is False
    logged = [json.loads(l) for l in alert_log.read_text().splitlines()]
    assert len(logged) == 1 and logged[0]["kind"] == "duress" and logged[0]["user"] == "Test User"
    # calms down -> back to ok, history forgets
    for _ in range(heads.THREAT_PERSIST):
        out = heads.threat_head(normal_features(), baseline, ctx)
    assert out["level"] == "ok" and out["kind"] is None


def test_thin_windows_never_alert(baseline, alert_log):
    """The first seconds of a session (few keys in the window) are noise for everyone: they
    neither count towards an alert nor carry an earlier streak over."""
    ctx = ctx_with()
    thin = backend.extract_features(typed(heads.THREAT_MIN_KEYS - 1, flight=400, hold=150))
    for _ in range(heads.THREAT_PERSIST * 2):
        out = heads.threat_head(thin, baseline, ctx)
    assert out["level"] == "ok" and out["sustained_ticks"] == 0 and out["warming_up"] is True
    # a streak that is interrupted by a thin window starts over
    for _ in range(heads.THREAT_PERSIST - 1):
        heads.threat_head(odd_features(), baseline, ctx)
    heads.threat_head(thin, baseline, ctx)
    out = heads.threat_head(odd_features(), baseline, ctx)
    assert out["level"] == "warn" and out["sustained_ticks"] == 1 and ctx["threat"]["alerts"] == 0


def test_kind_is_intruder_on_identity_mismatch(baseline, alert_log):
    ctx = ctx_with(identity={"user": "Someone Else", "matches_declared": False, "unknown": False})
    out = None
    for _ in range(heads.THREAT_PERSIST):
        out = heads.threat_head(odd_features(), baseline, ctx)
    assert out["level"] == "alert" and out["kind"] == "intruder" and out["identity_mismatch"] is True
    assert out["mismatch_ticks"] == heads.INTRUDER_PERSIST


def test_intruder_alerts_on_sustained_mismatch_without_3_sigma(baseline, alert_log):
    """Someone else typing at ~2.5 sigma from the declared baseline: never over THREAT_ALERT, but
    identity names them on every window, so the intruder clock fires on its own."""
    mild = backend.extract_features(typed(40, flight=140, hold=75))
    d = float(baseline.distance(mild))
    assert heads.THREAT_WARN <= d < heads.THREAT_ALERT, d
    ctx = ctx_with(identity={"user": "Someone Else", "matches_declared": False, "unknown": False})
    levels = [heads.threat_head(mild, baseline, ctx)["level"] for _ in range(heads.INTRUDER_PERSIST)]
    assert levels[:-1] == ["warn"] * (heads.INTRUDER_PERSIST - 1) and levels[-1] == "alert"
    assert ctx["threat"]["alerts"] == 1 and json.loads(alert_log.read_text().splitlines()[-1])["kind"] == "intruder"
    # the same typing by the declared user is only ever a warn
    ctx2 = ctx_with(identity={"user": "Test User", "matches_declared": True, "unknown": False})
    for _ in range(heads.INTRUDER_PERSIST * 2):
        out = heads.threat_head(mild, baseline, ctx2)
    assert out["level"] == "warn" and ctx2["threat"]["alerts"] == 0
    assert json.loads(alert_log.read_text().splitlines()[-1])["kind"] == "intruder"
    # a mismatch alone (no deviation) is a warn, not an alert
    ctx2 = ctx_with(identity={"user": "Someone Else", "matches_declared": False})
    assert heads.threat_head(normal_features(), baseline, ctx2)["level"] == "warn"


def test_cooldown_prevents_repeat_pushes(baseline, alert_log, monkeypatch):
    ctx = ctx_with()
    for _ in range(heads.THREAT_PERSIST):
        heads.threat_head(odd_features(), baseline, ctx)
    assert ctx["threat"]["alerts"] == 1
    # drop out and re-enter alert within the cooldown: no second alert
    for _ in range(heads.THREAT_PERSIST):
        heads.threat_head(normal_features(), baseline, ctx)
    for _ in range(heads.THREAT_PERSIST):
        heads.threat_head(odd_features(), baseline, ctx)
    assert ctx["threat"]["alerts"] == 1
    # after the cooldown it fires again
    ctx["threat"]["last_alert_at"] -= heads.THREAT_COOLDOWN_S + 1
    for _ in range(heads.THREAT_PERSIST):
        heads.threat_head(normal_features(), baseline, ctx)
    for _ in range(heads.THREAT_PERSIST):
        heads.threat_head(odd_features(), baseline, ctx)
    assert ctx["threat"]["alerts"] == 2
    assert len(alert_log.read_text().splitlines()) == 2


def test_push_goes_through_ntfy_when_configured(baseline, alert_log, monkeypatch):
    sent = []
    monkeypatch.setenv("KEYSIGN_NTFY_TOPIC", "keysign-test-topic")
    monkeypatch.setattr(notify, "_post", lambda alert: sent.append(alert))
    ctx = ctx_with()
    out = None
    for _ in range(heads.THREAT_PERSIST):
        out = heads.threat_head(odd_features(), baseline, ctx)
    assert out["last_alert"]["sent"] is True and out["last_alert"]["channel"] == "ntfy"
    import time
    for _ in range(50):                      # background thread
        if sent:
            break
        time.sleep(0.02)
    assert sent and sent[0]["kind"] == "duress" and "events" not in sent[0]


def test_push_failure_is_swallowed(baseline, alert_log, monkeypatch):
    monkeypatch.setenv("KEYSIGN_NTFY_TOPIC", "t")
    def boom(alert): raise RuntimeError("offline")
    monkeypatch.setattr(notify, "_post", boom)
    ctx = ctx_with()
    for _ in range(heads.THREAT_PERSIST):
        out = heads.threat_head(odd_features(), baseline, ctx)
    assert out["level"] == "alert" and len(alert_log.read_text().splitlines()) == 1


def test_alert_photo_stored_listed_and_pushed(alert_log, monkeypatch, tmp_path):
    client = TestClient(backend.app)
    monkeypatch.setattr(notify, "PHOTO_DIR", tmp_path / "photos")
    pushed = []
    monkeypatch.setenv("KEYSIGN_NTFY_TOPIC", "keysign-test")
    monkeypatch.setattr(notify, "_post", lambda a: None)
    monkeypatch.setattr(notify, "_post_photo", lambda a, p, title, msg: pushed.append((a["kind"], p.name)))
    from backend import faces
    monkeypatch.setattr(faces, "verify", lambda user, data: {"face": True, "match": False, "distance": 91.0, "threshold": 70.0, "enrolled": 5})
    monkeypatch.setattr(faces, "grab_screen", lambda: b"\xff\xd8\xff\xe0screen")
    notify.record({"ts": 1000.0, "session": "abc", "kind": "intruder", "user": "u"}, alert_log)
    notify.record({"ts": 2000.0, "session": "abc", "kind": "duress", "user": "u"}, alert_log)
    jpeg = b"\xff\xd8\xff\xe0" + b"0" * 100
    r = client.post("/api/alerts/photo?ts=1000.3&session=abc", content=jpeg, headers={"Content-Type": "image/jpeg"})
    assert r.status_code == 200 and r.json()["photo"] == "1000_abc.jpg" and r.json()["sent"] is True
    assert r.json()["screen"] == "1000_abc_screen.jpg" and r.json()["face"]["match"] is False
    assert (tmp_path / "photos" / "1000_abc.jpg").read_bytes() == jpeg
    assert client.get("/api/alerts/photo/1000_abc.jpg").status_code == 200
    assert client.get("/api/alerts/photo/1000_abc_screen.jpg").status_code == 200
    listed = client.get("/api/alerts").json()["alerts"]
    assert listed[0]["photo"] == "1000_abc.jpg" and listed[0]["screen"] == "1000_abc_screen.jpg"
    assert listed[0]["face"]["match"] is False and listed[0]["face"]["owner"] == "u" and listed[1]["photo"] is None
    # duress never gets a photo; garbage is refused; unknown alert time is refused
    assert client.post("/api/alerts/photo?ts=2000", content=jpeg, headers={"Content-Type": "image/jpeg"}).status_code == 400
    assert client.post("/api/alerts/photo?ts=1000", content=b"not a jpeg", headers={"Content-Type": "image/jpeg"}).status_code == 400
    assert client.post("/api/alerts/photo?ts=5000", content=jpeg, headers={"Content-Type": "image/jpeg"}).status_code == 404
    import time
    for _ in range(50):
        if len(pushed) >= 2:
            break
        time.sleep(0.02)
    assert sorted(pushed) == [("intruder", "1000_abc.jpg"), ("intruder", "1000_abc_screen.jpg")]


def test_alert_photo_stays_local_when_face_matches_owner(alert_log, monkeypatch, tmp_path):
    client = TestClient(backend.app)
    monkeypatch.setattr(notify, "PHOTO_DIR", tmp_path / "photos")
    monkeypatch.setenv("KEYSIGN_NTFY_TOPIC", "keysign-test")
    pushed = []
    monkeypatch.setattr(notify, "_post_photo", lambda a, p, title, msg: pushed.append(p.name))
    from backend import faces
    monkeypatch.setattr(faces, "verify", lambda user, data: {"face": True, "match": True, "distance": 41.0, "threshold": 70.0, "enrolled": 5})
    monkeypatch.setattr(faces, "grab_screen", lambda: None)
    notify.record({"ts": 3000.0, "session": "s", "kind": "intruder", "user": "owner"}, alert_log)
    jpeg = b"\xff\xd8\xff\xe0" + b"0" * 50
    r = client.post("/api/alerts/photo?ts=3000", content=jpeg, headers={"Content-Type": "image/jpeg"}).json()
    assert r["sent"] is False and r["face"]["match"] is True and r["screen"] is None
    assert (tmp_path / "photos" / "3000_s.jpg").exists()          # kept on disk regardless
    import time; time.sleep(0.1)
    assert pushed == []


def test_face_enrolment_api_and_no_face_frames(monkeypatch, tmp_path):
    from backend import faces
    monkeypatch.setattr(faces, "FACE_DIR", tmp_path / "faces")
    client = TestClient(backend.app)
    assert client.get("/api/faces/Someone").json()["n_samples"] == 0
    # a flat grey JPEG has no face: refused as an enrolment, and verify says no face
    import io
    from PIL import Image
    buf = io.BytesIO(); Image.new("L", (320, 240), 128).save(buf, format="JPEG"); blank = buf.getvalue()
    r = client.post("/api/faces/Someone", content=blank, headers={"Content-Type": "image/jpeg"}).json()
    assert r["ok"] is False and r["face"] is False and r["n_samples"] == 0
    v = faces.verify("Someone", blank)
    assert v["face"] is False and v["match"] is None
    assert client.post("/api/faces/Someone", content=b"nope", headers={"Content-Type": "image/jpeg"}).status_code == 400
    assert client.delete("/api/faces/Someone").json()["removed"] == 0


def test_alerts_api(alert_log, monkeypatch):
    client = TestClient(backend.app)
    assert client.get("/api/alerts").json() == {"channel": "log-only", "alerts": []}
    notify.record({"ts": 1, "kind": "duress", "user": "u"}, alert_log)
    r = client.get("/api/alerts").json()
    assert r["alerts"][0]["kind"] == "duress" and r["alerts"][0]["photo"] is None


def test_ntfy_request_shape(monkeypatch):
    captured = {}
    class FakeResp:
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def read(self): return b"ok"
    def fake_urlopen(req, timeout):
        captured["url"] = req.full_url; captured["headers"] = dict(req.header_items()); captured["body"] = req.data.decode()
        return FakeResp()
    monkeypatch.setenv("KEYSIGN_NTFY_TOPIC", "keysign-abc")
    monkeypatch.setattr(notify.urllib.request, "urlopen", fake_urlopen)
    notify._post({"ts": 0, "user": "Akkshar", "kind": "intruder", "distance": 3.7, "sustained_ticks": 3})
    assert captured["url"] == "https://ntfy.sh/keysign-abc"
    assert "intruder" in captured["headers"].get("Title", "") and "3.7" in captured["body"]


def test_face_threshold_is_derived_from_the_owners_own_crops():
    import numpy as np
    from backend import faces
    rng = np.random.default_rng(0)
    base = rng.integers(0, 255, (faces.CROP, faces.CROP), dtype=np.uint8)
    crops = [np.clip(base.astype(int) + rng.integers(-6, 7, base.shape), 0, 255).astype(np.uint8) for _ in range(6)]
    thr = faces.own_threshold(crops)
    assert faces.THRESHOLD_RANGE[0] <= thr <= faces.THRESHOLD_RANGE[1]
    assert faces.own_threshold(crops[:2]) == faces.THRESHOLD          # too few to measure: fallback
