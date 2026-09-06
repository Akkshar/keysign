"""
Run:  python -m pytest pipeline/tests -q
"""
import json
import math
import os

import numpy as np
import pytest

from pipeline.features import (
    COMMON_DIGRAPHS, FEATURE_NAMES, PAUSE_MS, extract_features,
    samples_to_frame, sliding_windows, to_vector,
)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def typed(text, t0=1000.0, flight=100.0, hold=50.0):
    """Synthetic events: each char pressed `flight` ms apart, held `hold` ms."""
    ev = []
    t = t0
    for ch in text:
        code = "Space" if ch == " " else f"Key{ch.upper()}"
        ev.append({"type": "down", "key": ch, "code": code, "t": t})
        ev.append({"type": "up", "key": ch, "code": code, "t": t + hold})
        t += flight
    return sorted(ev, key=lambda e: e["t"])


def test_feature_names_are_unique_and_complete():
    assert len(FEATURE_NAMES) == len(set(FEATURE_NAMES))
    f = extract_features(typed("hello"))
    assert list(f.keys()) == FEATURE_NAMES
    assert to_vector(f).shape == (len(FEATURE_NAMES),)


def test_regular_typing_has_exact_stats():
    f = extract_features(typed("abcdefghij", flight=100, hold=50))
    assert f["n_keys"] == 10
    assert f["hold_mean"] == pytest.approx(50)
    assert f["hold_std"] == pytest.approx(0)
    assert f["flight_mean"] == pytest.approx(100)
    assert f["flight_std"] == pytest.approx(0)
    assert f["rp_mean"] == pytest.approx(50)         # up at +50, next down at +100
    assert f["rp_negative_ratio"] == 0
    assert f["duration_s"] == pytest.approx(0.9)     # 9 gaps of 100 ms
    assert f["speed_kps"] == pytest.approx(10 / 0.9)
    assert f["error_rate"] == 0
    assert f["rhythm_cv"] == 0
    assert f["pause_count"] == 0
    assert f["modifier_ratio"] == 0


def test_overlapping_keys_give_negative_release_press():
    # hold longer than flight: next key pressed before previous released
    f = extract_features(typed("abcd", flight=80, hold=120))
    assert f["hold_mean"] == pytest.approx(120)
    assert f["rp_mean"] == pytest.approx(-40)
    assert f["rp_negative_ratio"] == 1.0


def test_backspace_counts_as_error():
    ev = typed("abcd")
    t = ev[-1]["t"] + 100
    ev += [{"type": "down", "key": "Backspace", "code": "Backspace", "t": t},
           {"type": "up", "key": "Backspace", "code": "Backspace", "t": t + 40}]
    f = extract_features(ev)
    assert f["n_keys"] == 5
    assert f["error_rate"] == pytest.approx(0.2)


def test_pause_detection():
    ev = typed("abc", flight=100)                    # t=1000,1100,1200
    ev += typed("def", t0=1200 + PAUSE_MS + 300, flight=100)  # one long gap
    f = extract_features(ev)
    assert f["pause_count"] == 1
    assert f["longest_pause_ms"] == pytest.approx(PAUSE_MS + 300)
    assert f["pause_ratio"] == pytest.approx(1 / 5)
    # the pause is still a normal flight (< MAX_FLIGHT), so it inflates flight_std
    assert f["flight_std"] > 0


def test_stuck_key_hold_is_dropped():
    ev = typed("abc", hold=50)
    ev += [{"type": "down", "key": "z", "code": "KeyZ", "t": 5000},
           {"type": "up", "key": "z", "code": "KeyZ", "t": 5000 + 60_000}]  # stuck 60 s
    f = extract_features(ev)
    assert f["hold_mean"] == pytest.approx(50)       # the 60 s hold is ignored
    assert f["n_keys"] == 4                          # but the press still counts


def test_empty_code_falls_back_to_key():
    ev = [{"type": "down", "key": "a", "code": "", "t": 0},
          {"type": "up", "key": "a", "code": "", "t": 70},
          {"type": "down", "key": "b", "code": "", "t": 150},
          {"type": "up", "key": "b", "code": "", "t": 210}]
    f = extract_features(ev)
    assert f["hold_mean"] == pytest.approx(65)


def test_digraphs_measured_and_filled():
    # "th" typed twice with a 130 ms gap each time, nothing else common
    ev = typed("th", flight=130) + typed("th", t0=5000, flight=130)
    f = extract_features(ev)
    assert f["dg_th"] == pytest.approx(130)
    # "he" absent -> filled with flight_mean (dense vector)
    assert f["dg_he"] == pytest.approx(f["flight_mean"])
    f2 = extract_features(ev, fill_missing_digraphs=False)
    assert math.isnan(f2["dg_he"])
    assert not any(math.isnan(v) for v in f.values())


def test_modifier_ratio():
    ev = typed("ab")
    ev += [{"type": "down", "key": "Shift", "code": "ShiftLeft", "t": 2000},
           {"type": "up", "key": "Shift", "code": "ShiftLeft", "t": 2100}]
    f = extract_features(ev)
    assert f["modifier_ratio"] == pytest.approx(1 / 3)


def test_degenerate_inputs_do_not_crash():
    for ev in ([], typed("a"), [{"type": "up", "key": "a", "code": "KeyA", "t": 5}]):
        f = extract_features(ev)
        assert list(f.keys()) == FEATURE_NAMES
        assert not any(math.isnan(v) or math.isinf(v) for v in f.values())


def test_samples_to_frame_shape():
    samples = [
        {"id": "s1", "user": "A", "condition": "calm", "events": typed("hello world")},
        {"id": "s2", "user": "B", "condition": "stress", "events": typed("goodbye", flight=60)},
    ]
    df = samples_to_frame(samples)
    assert list(df.columns[:4]) == ["sample_id", "user", "condition", "started_at"]
    assert list(df.columns[4:]) == FEATURE_NAMES
    assert len(df) == 2
    assert df.loc[1, "flight_mean"] == pytest.approx(60)


def test_sliding_windows_cover_events():
    ev = typed("a" * 50, flight=200)                 # 10 s of typing
    wins = list(sliding_windows(ev, window_ms=2000, step_ms=1000))
    assert len(wins) >= 9
    assert all(len(w) > 0 for w in wins)
    assert all(w[-1]["t"] - w[0]["t"] < 2000 for w in wins)


@pytest.mark.skipif(
    not os.path.exists(os.path.join(ROOT, "keystrokes (1).json")),
    reason="real capture export not present",
)
def test_real_export_produces_sane_features():
    with open(os.path.join(ROOT, "keystrokes (1).json"), encoding="utf-8") as fh:
        samples = json.load(fh)
    df = samples_to_frame(samples)
    assert len(df) == len(samples)
    assert df["n_keys"].min() >= 10
    # human typing: holds 30-300 ms, flights 50-1000 ms on average
    assert df["hold_mean"].between(30, 300).all()
    assert df["flight_mean"].between(50, 1000).all()
    assert np.isfinite(df[FEATURE_NAMES].to_numpy()).all()
    # every user should have both conditions in this dataset
    assert (df.groupby("user")["condition"].nunique() == 2).all()
