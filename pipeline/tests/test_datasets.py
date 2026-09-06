import os

import pandas as pd
import pytest

from pipeline.datasets import (
    CMU_KEYS, EXTERNAL, cmu_frame_to_samples, key_and_code, load_cmu,
    load_stress_logger, load_tie5_raw, logger_frames_to_samples, tie5_frame_to_samples,
)
from pipeline.features import FEATURE_NAMES, extract_features, samples_to_frame


def test_key_mapping():
    assert key_and_code("Key.enter") == ("Enter", "Enter")
    assert key_and_code("Key.backspace") == ("Backspace", "Backspace")
    assert key_and_code("shift_r") == ("Shift", "ShiftRight")
    assert key_and_code("a") == ("a", "KeyA")
    assert key_and_code("R") == ("R", "KeyR")
    assert key_and_code("5") == ("5", "Digit5")
    assert key_and_code("$") == ("$", "")
    assert key_and_code("$$$") == ("$", "")
    assert key_and_code("space") == (" ", "Space")


def test_cmu_reconstruction_roundtrips_timings():
    # one rep: every hold 0.1 s, every down-down 0.25 s
    row = {"subject": "s002", "sessionIndex": 1, "rep": 1}
    for k in CMU_KEYS:
        row[f"H.{k}"] = 0.1
    for a, b in zip(CMU_KEYS[:-1], CMU_KEYS[1:]):
        row[f"DD.{a}.{b}"] = 0.25
        row[f"UD.{a}.{b}"] = 0.15
    s = cmu_frame_to_samples(pd.DataFrame([row]))
    assert len(s) == 1 and s[0]["user"] == "cmu_s002"
    f = extract_features(s[0]["events"])
    assert f["n_keys"] == 11
    assert f["hold_mean"] == pytest.approx(100)
    assert f["flight_mean"] == pytest.approx(250)
    assert f["rp_mean"] == pytest.approx(150)
    keys = [e["key"] for e in s[0]["events"] if e["type"] == "down"]
    assert keys == [".", "t", "i", "e", "5", "R", "o", "a", "n", "l", "Enter"]


def test_tie5_split_on_enter_and_glitch_drop():
    t = 1_700_000_000.0
    rows = []
    def add(k, p, r=None, rep=None):
        rows.append({"User_ID": "u", "Session_ID": 1, "Key_Pressed": k,
                     "Press_Time": t + p, "Release_Time": t + (r if r is not None else p + 0.08)})
    # rep 1: 6 keys + enter
    for i, k in enumerate(list(".tie5") + ["Key.enter"]):
        add(k, i * 0.2)
    # glitch: enter with a press time that goes backwards
    add("Key.enter", 0.0, 1.5)
    # rep 2: too short (2 keys + enter) -> dropped
    add(".", 3.0); add("t", 3.2); add("Key.enter", 3.4)
    # rep 3: 5 keys, no trailing enter -> kept via final flush
    for i, k in enumerate("tie5R"):
        add(k, 5 + i * 0.2)
    s = tie5_frame_to_samples(pd.DataFrame(rows), min_keys=5)
    assert [x["rep"] for x in s] == [0, 1]
    assert s[0]["text"] == ".tie5"
    assert s[1]["text"] == "tie5R"
    assert all(e["t"] >= 0 for x in s for e in x["events"])
    f = extract_features(s[0]["events"])
    assert f["n_keys"] == 6
    assert f["flight_mean"] == pytest.approx(200)


def test_logger_windows_and_labels():
    base = pd.Timestamp("2021-09-10 12:00:00")
    ks = []
    for i in range(40):                      # 40 keys in the 10 min before the first report
        p = base + pd.Timedelta(seconds=i * 10)
        ks.append({"Key": "$" if i % 5 else "backspace", "Press_Time": str(p), "Relase_Time": str(p + pd.Timedelta(milliseconds=90))})
    ks.append({"Key": "Key", "Press_Time": "Press_Time", "Relase_Time": "Relase_Time"})   # stray header row
    keys = pd.DataFrame(ks)
    cond = pd.DataFrame([
        {"Time": str(base + pd.Timedelta(minutes=10)), "Fatigue_Val": "Low", "PAM_Val": "7", "Stress_Val": "V_Stressed",
         "Energy_Val": "Neutral", "Pleasant_Val": "Neutral", "Daylight": "Afternoon"},
        {"Time": str(base + pd.Timedelta(hours=5)), "Fatigue_Val": "No", "PAM_Val": "3", "Stress_Val": "Neutral",
         "Energy_Val": "Neutral", "Pleasant_Val": "Neutral", "Daylight": "Evening"},   # no keys in window
    ])
    s = logger_frames_to_samples(keys, cond, user="logger_user_9", window_min=30, min_keys=30)
    assert len(s) == 1
    assert s[0]["condition"] == "stress"
    assert s[0]["labels"]["pam"] == 7.0
    f = extract_features(s[0]["events"])
    assert f["n_keys"] == 40
    assert f["hold_mean"] == pytest.approx(90)
    assert f["error_rate"] == pytest.approx(8 / 40)


# ---- real staged data (skipped when not present) ----

@pytest.mark.skipif(not (EXTERNAL / "cmu_password" / "DSL-StrongPasswordData.csv").exists(), reason="not staged")
def test_real_cmu():
    s = load_cmu()
    assert len(s) == 20400
    df = samples_to_frame(s)
    assert df["user"].nunique() == 51
    assert df["hold_mean"].between(20, 400).all()
    assert (df["n_keys"] == 11).all()


@pytest.mark.skipif(not list((EXTERNAL / "tie5_raw").glob("*_raw.csv")), reason="not staged")
def test_real_tie5():
    s = load_tie5_raw()
    df = samples_to_frame(s)
    assert df["user"].nunique() == 6
    assert len(df) > 300
    assert df["hold_mean"].between(20, 500).all()
    assert df[FEATURE_NAMES].notna().all().all()


@pytest.mark.skipif(not (EXTERNAL / "stress_logger").exists(), reason="not staged")
def test_real_stress_logger():
    s = load_stress_logger()
    df = samples_to_frame(s)
    assert df["user"].nunique() == 2
    assert set(df["condition"]) == {"calm", "stress"}
    assert df["hold_mean"].between(20, 400).all()
