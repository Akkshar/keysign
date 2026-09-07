"""
The identity head gets a few seconds to finish before the machine locks.

An alert is raised the moment the threat clock fills. On prose typed through the OS hook
that is often while the classifier is still under its confidence bar: measured on this
machine's 274 recordings, a 20-29 key window has median confidence 0.79 and the head
reports "unknown" 58% of the time, against 0.98 and 16% at 50-69 keys. All 25 recorded
alerts had `mismatch_ticks` 0, so none of them named anybody; eleven would have had a
confident name within ten more seconds, and most of those names were the owner.

So actions polls the session's own ticks while the camera burst runs, and decides on the
settled read. Widening the window instead was measured and is worse: on labelled chair
swaps the first correct name moves from 4-10 s to 9-21 s and accuracy falls from 69-90%
to 46-77%, because a longer window holds more of the previous typist's keys.
"""
import time

import pytest

from backend import actions


@pytest.fixture(autouse=True)
def _fast_and_isolated(monkeypatch):
    monkeypatch.setattr(actions, "IDENTITY_SETTLE_S", 1.2)
    monkeypatch.setattr(actions, "IDENTITY_POLL_S", 0.02)
    monkeypatch.setattr(actions, "IDENTITY_HOOK", None)
    yield


def feed(reads):
    """A hook that hands out one read per call, then repeats the last one."""
    box = {"i": 0}

    def hook(session_id):
        i = min(box["i"], len(reads) - 1)
        box["i"] += 1
        r = reads[i]
        return {**r, "ts": time.time() + box["i"]}
    return hook


ALERT = {"session": "s1", "user": "Owner", "kind": "intruder", "identity": "Owner", "ts": 1.0}


def test_no_hook_means_no_settling():
    assert actions.settle_identity(dict(ALERT)) is None


def test_settles_on_a_confident_name(monkeypatch):
    monkeypatch.setattr(actions, "IDENTITY_HOOK", feed([
        {"user": "Owner", "unknown": True, "confidence": 0.61},
        {"user": "Someone Else", "unknown": False, "confidence": 0.91},
        {"user": "Someone Else", "unknown": False, "confidence": 0.94},
        {"user": "Someone Else", "unknown": False, "confidence": 0.97},
    ]))
    out = actions.settle_identity(dict(ALERT))
    assert out["confident"] is True and out["user"] == "Someone Else"
    assert out["agreed"] >= 3 and out["confidence"] == pytest.approx(0.97)


def test_unsure_all_the_way_through_stays_unsure(monkeypatch):
    monkeypatch.setattr(actions, "IDENTITY_HOOK", feed([
        {"user": "Owner", "unknown": True, "confidence": 0.55},
        {"user": "Owner", "unknown": True, "confidence": 0.6},
    ]))
    out = actions.settle_identity(dict(ALERT))
    assert out is not None and out["confident"] is False


def test_warming_up_reads_are_not_counted(monkeypatch):
    monkeypatch.setattr(actions, "IDENTITY_HOOK", feed([
        {"user": None, "warming_up": True, "confidence": None},
    ]))
    assert actions.settle_identity(dict(ALERT)) is None


def test_a_hook_that_raises_never_breaks_an_alert(monkeypatch):
    def boom(_):
        raise RuntimeError("session gone")
    monkeypatch.setattr(actions, "IDENTITY_HOOK", boom)
    assert actions.settle_identity(dict(ALERT)) is None


# --------------------------------------------------------------------- the decision itself
def test_settled_owner_with_no_camera_pushes_but_does_not_lock():
    """The case that was locking the machine on ordinary prose: a thin window said the typing
    was not the owner's, the camera had no opinion, and the lock went through. With the settled
    read naming the owner, the phone still gets it and the machine stays open."""
    alert = {**ALERT, "identity_settled": {"user": "Owner", "confidence": 0.93, "confident": True, "reads": 5}}
    d = actions.decide(alert, None)
    assert d["push"] is True and d["lock"] is False and d["kind"] == "duress"
    assert "settled on Owner" in d["why"]


def test_settled_stranger_with_no_camera_still_locks_and_names_them():
    alert = {**ALERT, "identity_settled": {"user": "Someone Else", "confidence": 0.95, "confident": True, "reads": 5}}
    d = actions.decide(alert, None)
    assert d["lock"] is True and d["push"] is True
    assert "Someone Else" in d["why"]


def test_unsettled_identity_behaves_as_before():
    alert = {**ALERT, "identity_settled": {"user": "Owner", "confidence": 0.6, "confident": False, "reads": 5}}
    d = actions.decide(alert, None)
    assert d["lock"] is True and d["kind"] == "intruder"


def test_the_camera_still_outranks_a_settled_owner():
    """A stranger who happens to type like the owner must not walk through: the face says no."""
    alert = {**ALERT, "identity_settled": {"user": "Owner", "confidence": 0.93, "confident": True, "reads": 5}}
    d = actions.decide(alert, {"match": False, "similarity": 0.18})
    assert d["lock"] is True and d["kind"] == "intruder"


def test_owner_face_and_settled_owner_stays_local():
    alert = {**ALERT, "identity_settled": {"user": "Owner", "confidence": 0.93, "confident": True, "reads": 5}}
    d = actions.decide(alert, {"match": True, "similarity": 0.62})
    assert d["push"] is False and d["lock"] is False and d["kind"] is None


def test_the_settled_name_reaches_the_log_the_dashboard_reads(tmp_path, monkeypatch):
    """The alert row is written the moment the clock fills; the dashboard should show the read
    that arrived a couple of seconds later, with the first guess kept beside it."""
    import json
    import time as _time

    from backend import notify

    log = tmp_path / "alerts.jsonl"
    photos = tmp_path / "photos"
    monkeypatch.setattr(notify, "ALERT_LOG", log)
    monkeypatch.setattr(notify, "PHOTO_DIR", photos)
    alert = {"ts": _time.time(), "session": "s1", "user": "Owner", "kind": "intruder",
             "identity": "Owner", "identity_confidence": 0.61, "distance": 3.2}
    log.write_text(json.dumps(alert) + "\n", encoding="utf-8")
    notify.mark_delivery(alert, pushed=True, reason="settled", kind="intruder", sent=True,
                         settled={"user": "Someone Else", "confidence": 0.96, "confident": True, "reads": 4})

    row = notify.recent(5)[-1]
    assert row["identity"] == "Someone Else"
    assert row["identity_confidence"] == 0.96
    assert row["identity_at_alert"] == "Owner"


def test_the_settle_stops_when_the_typing_stops(monkeypatch):
    """Ticks arrive while somebody types. If they stop, no better read is coming and the lock
    should not sit waiting out the whole settle window."""
    frozen = {"user": "Owner", "unknown": True, "confidence": 0.6, "ts": 42.0}
    monkeypatch.setattr(actions, "IDENTITY_HOOK", lambda sid: dict(frozen))
    monkeypatch.setattr(actions, "IDENTITY_QUIET_S", 0.2)
    monkeypatch.setattr(actions, "IDENTITY_SETTLE_S", 5.0)
    t0 = time.time()
    out = actions.settle_identity(dict(ALERT))
    assert out is not None and out["confident"] is False
    assert time.time() - t0 < 1.5
