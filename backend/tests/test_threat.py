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
    """The head records the alert and leaves the push to backend/actions.py (after the camera);
    push_alert then reaches ntfy with kind, user, distance and time only."""
    sent = []
    monkeypatch.setenv("KEYSIGN_NTFY_TOPIC", "keysign-test-topic")
    monkeypatch.setattr(notify, "_post", lambda alert: sent.append(alert))
    ctx = ctx_with()
    out = None
    for _ in range(heads.THREAT_PERSIST):
        out = heads.threat_head(odd_features(), baseline, ctx)
    assert out["last_alert"]["sent"] is None and out["last_alert"]["channel"] == "ntfy"
    logged = json.loads(alert_log.read_text().splitlines()[-1])
    assert logged["kind"] == "duress"
    notify.push_alert(logged, "camera: the owner is at the keyboard")
    import time
    for _ in range(50):                      # background thread
        if sent:
            break
        time.sleep(0.02)
    assert sent and sent[0]["kind"] == "duress" and "events" not in sent[0] and sent[0]["why"].startswith("camera")


def test_duress_needs_load_but_intruder_does_not(baseline, alert_log):
    """Duress has a direction. The same 3-sigma typing by the declared user is a warn while the
    State head says the load is under the person's cut-off, and an alert once it is over.
    An impostor is an intruder either way."""
    calm = ctx_with(identity={"user": "Test User", "matches_declared": True, "unknown": False}, state={"load": 0.1})
    out = None
    for _ in range(heads.THREAT_PERSIST * 2):
        out = heads.threat_head(odd_features(), baseline, calm)
    assert out["level"] == "warn" and out["sustained_ticks"] == heads.THREAT_PERSIST and out["stressed_ticks"] == 0
    assert out["stressed"] is False and out["load_above"] == heads.LOAD_ABOVE and calm["threat"]["alerts"] == 0
    loaded = ctx_with(identity={"user": "Test User", "matches_declared": True, "unknown": False}, state={"load": 0.9})
    for _ in range(heads.THREAT_PERSIST):
        out = heads.threat_head(odd_features(), baseline, loaded)
    assert out["level"] == "alert" and out["kind"] == "duress" and out["stressed_ticks"] == heads.THREAT_PERSIST
    # the per-user cut-off from `pipeline.state calibrate` wins over the global one
    baseline.state = {"load_above": 0.95}
    strict = ctx_with(identity={"user": "Test User", "matches_declared": True, "unknown": False}, state={"load": 0.9})
    for _ in range(heads.THREAT_PERSIST):
        out = heads.threat_head(odd_features(), baseline, strict)
    assert out["level"] == "warn" and out["load_above"] == 0.95
    baseline.state = None
    # a confident stranger at low load still trips the intruder clock
    impostor = ctx_with(identity={"user": "Someone Else", "matches_declared": False, "unknown": False, "low_confidence": False}, state={"load": 0.05})
    for _ in range(heads.THREAT_PERSIST):
        out = heads.threat_head(odd_features(), baseline, impostor)
    assert out["level"] == "alert" and out["kind"] == "intruder"



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
    # a duress alert gets a frame too: a stranger in it makes the final call an intruder, images and all
    r = client.post("/api/alerts/photo?ts=2000", content=jpeg, headers={"Content-Type": "image/jpeg"}).json()
    assert r["ok"] is True and r["final_kind"] == "intruder" and r["sent"] is True
    # garbage is refused; unknown alert time is refused
    assert client.post("/api/alerts/photo?ts=1000", content=b"not a jpeg", headers={"Content-Type": "image/jpeg"}).status_code == 400
    assert client.post("/api/alerts/photo?ts=5000", content=jpeg, headers={"Content-Type": "image/jpeg"}).status_code == 404
    import time
    for _ in range(50):
        if len(pushed) >= 4:
            break
        time.sleep(0.02)
    assert sorted(pushed) == [("duress", "2000_abc.jpg"), ("duress", "2000_abc_screen.jpg"), ("intruder", "1000_abc.jpg"), ("intruder", "1000_abc_screen.jpg")]
    # the owner in a duress frame: stored, never pushed
    monkeypatch.setattr(faces, "verify", lambda user, data: {"face": True, "match": True, "similarity": 0.6, "enrolled": 5})
    notify.record({"ts": 2500.0, "session": "abc", "kind": "duress", "user": "u"}, alert_log)
    r = client.post("/api/alerts/photo?ts=2500", content=jpeg, headers={"Content-Type": "image/jpeg"}).json()
    assert r["final_kind"] == "duress" and r["sent"] is False and (tmp_path / "photos" / "2500_abc.jpg").exists()
    time.sleep(0.1)
    assert len(pushed) == 4


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


def test_owner_far_from_baseline_is_duress_not_intruder(baseline, alert_log):
    """Identity says the declared user, confidently; the distance rule alone says unknown (prose,
    nerves). That is the same person off their baseline: duress kind, no intruder clock."""
    ctx = ctx_with(identity={"user": "Test User", "matches_declared": True, "unknown": True, "low_confidence": False})
    out = None
    for _ in range(heads.THREAT_PERSIST):
        out = heads.threat_head(odd_features(), baseline, ctx)
    assert out["level"] == "alert" and out["kind"] == "duress" and out["identity_mismatch"] is False
    assert json.loads(alert_log.read_text().splitlines()[-1])["kind"] == "duress"
    # the vote naming a Stranger class is positive evidence: intruder
    ctx2 = ctx_with(identity={"user": "Stranger 1", "matches_declared": False, "unknown": True, "low_confidence": False})
    for _ in range(heads.INTRUDER_PERSIST):
        out = heads.threat_head(odd_features(), baseline, ctx2)
    assert out["kind"] == "intruder"


def test_confident_mismatch_alerts_even_close_to_the_baseline(baseline, alert_log):
    """Two people who type alike: the impostor sits under 2 sigma, but identity is sure it is
    someone else on every window, so the intruder clock counts. An unsure vote does not."""
    close = backend.extract_features(typed(40, flight=128, hold=66))
    assert float(baseline.distance(close)) < heads.THREAT_WARN
    sure = ctx_with(identity={"user": "Someone Else", "matches_declared": False, "unknown": False, "low_confidence": False})
    out = None
    for _ in range(heads.INTRUDER_PERSIST):
        out = heads.threat_head(close, baseline, sure)
    assert out["level"] == "alert" and out["kind"] == "intruder"

    unsure = ctx_with(identity={"user": "Someone Else", "matches_declared": False, "unknown": False, "low_confidence": True})
    for _ in range(heads.INTRUDER_PERSIST * 2):
        out = heads.threat_head(close, baseline, unsure)
    assert out["level"] == "warn" and unsure["threat"]["alerts"] == 0


def test_alert_carries_whether_the_duress_clock_was_full(baseline, alert_log):
    """An intruder alert raised while the person was also far off AND loaded says so, so
    backend/actions.py can turn it into duress when the camera sees the owner."""
    loaded = ctx_with(identity={"user": "Someone Else", "matches_declared": False, "low_confidence": True}, state={"load": 0.9})
    out = None
    for _ in range(heads.THREAT_PERSIST):
        out = heads.threat_head(odd_features(), baseline, loaded)
    assert out["kind"] == "intruder" and out["duress_ready"] is True
    assert json.loads(alert_log.read_text().splitlines()[-1])["duress_ready"] is True
    # the same mismatch with no load: an intruder alert that is only an intruder alert
    calm = ctx_with(identity={"user": "Someone Else", "matches_declared": False, "low_confidence": True}, state={"load": 0.0})
    for _ in range(heads.INTRUDER_PERSIST):
        out = heads.threat_head(odd_features(), baseline, calm)
    assert out["kind"] == "intruder" and out["duress_ready"] is False


def test_a_machine_with_one_profile_still_measures_but_never_accuses(baseline, alert_log, monkeypatch):
    """Telling people apart needs two people enrolled, so a freshly calibrated machine has no
    classifier. The baseline still answers "does this look like you", which is worth saying; what
    it must not do is call the owner an impostor, because there is no evidence of anybody else."""
    monkeypatch.setattr(heads, "_identity_model", lambda: None)
    monkeypatch.setattr(heads, "_model_cache", {})
    ctx = {"user": "Test User"}

    normal = backend.extract_features(typed(40, flight=120, hold=70))
    out = heads.identity_head(normal, baseline, ctx)
    assert out["solo"] is True and out["unknown"] is False
    assert out["matches_declared"] is True and out["closest"] is None

    far = backend.extract_features(typed(40, flight=60, hold=30))
    out = heads.identity_head(far, baseline, ctx)
    assert out["distance"] > heads.UNKNOWN_DIST
    assert out["unknown"] is True                      # says so
    assert out["matches_declared"] is True             # but never accuses

    # and the threat head therefore keeps it on the duress path, where the camera decides
    ctx2 = ctx_with(identity=out, state={"load": 0.9})
    res = None
    for _ in range(heads.THREAT_PERSIST):
        res = heads.threat_head(far, baseline, ctx2)
    assert res["kind"] == "duress" and res["identity_mismatch"] is False


def test_no_model_and_no_baseline_says_what_to_do(monkeypatch):
    monkeypatch.setattr(heads, "_identity_model", lambda: None)
    monkeypatch.setattr(heads, "_model_cache", {})
    out = heads.identity_head({"n_keys": 40}, None, {"user": "Nobody"})
    assert out["user"] is None and "calibrate" in out["reason"]
