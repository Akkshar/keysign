import json

import numpy as np
import pandas as pd

from pipeline.drift import build, cmu_session_drift, drift_score, monkeytype_drift, team_drift


def test_drift_score_direction_and_units():
    flat = np.full(40, 80.0) + np.tile([-1, 1], 20)
    d = drift_score(flat)
    assert abs(d["z"]) < 1 and abs(d["slope_per_month"]) < 0.1 and d["n"] == 40
    rising = np.concatenate([np.full(20, 80.0) + np.tile([-1, 1], 10), np.full(20, 95.0) + np.tile([-1, 1], 10)])
    d = drift_score(rising)
    assert d["z"] > 3 and d["delta"] == 15 and d["slope_per_month"] > 0
    assert drift_score(np.arange(5))["z"] is None                 # too short


def weekly(user, n, start=80.0, step=0.0, seed=0):
    r = np.random.default_rng(seed)
    ts = pd.date_range("2024-01-07", periods=n, freq="W")
    return pd.DataFrame({"user": user, "ts": ts, "wpm": start + step * np.arange(n) + r.normal(0, 2, n),
                         "acc": 95 + r.normal(0, 1, n), "consistency": 70 + r.normal(0, 3, n), "tests": 10})


def test_monkeytype_drift_selects_and_scores():
    df = pd.concat([weekly("mt_A", 40, step=0.5), weekly("mt_B", 10), weekly("mt_C", 30, seed=1)])
    out = monkeytype_drift(df, min_weeks=24)
    assert [u["user"] for u in out] == ["mt_A", "mt_C"]          # B too short; A longest span first
    a = out[0]
    assert a["weeks"] == 40 and len(a["points"]) == 40
    assert a["drift"]["wpm"]["z"] > 3 and a["drift"]["wpm"]["slope_per_month"] > 1.5
    assert a["points"][20]["wpm_roll"] is not None
    assert all(set(p) >= {"week", "wpm", "acc", "consistency", "tests"} for p in a["points"])


def cmu_like():
    rows = []
    r = np.random.default_rng(0)
    for s in range(1, 9):
        for u in range(6):
            rows.append({"user": f"cmu_s{u}", "session": s, "hold_mean": 100 + 10 * u + r.normal(0, 2),
                         "flight_mean": 300 + 20 * u - 10 * s + r.normal(0, 3), "rp_mean": 150, "speed_kps": 3 + 0.1 * s,
                         **{f: r.normal(0, 1) for f in ("hold_std", "hold_median", "flight_std", "flight_median", "rp_std",
                                                        "rp_negative_ratio", "error_rate", "rhythm_cv", "pause_ratio", "modifier_ratio")}})
    return pd.DataFrame(rows)


def test_cmu_session_drift_without_holdout():
    d = cmu_session_drift(cmu_like(), holdout=False)
    assert d["sessions"] == list(range(1, 9)) and d["subjects"] == 6
    assert d["flight_mean"][0] > d["flight_mean"][-1]              # people get faster with practice
    assert d["flight_change_pct_median"] < 0 and "identity_holdout" not in d


def test_team_drift_groups_by_day():
    df = pd.DataFrame([
        {"user": "a", "condition": "calm", "started_at": "2026-09-06T10:00:00Z", "hold_mean": 100, "flight_mean": 200, "speed_kps": 5, "error_rate": 0},
        {"user": "a", "condition": "calm", "started_at": "", "hold_mean": 110, "flight_mean": 210, "speed_kps": 5, "error_rate": 0},
        {"user": "a", "condition": "stress", "started_at": "2026-09-06T10:00:00Z", "hold_mean": 50, "flight_mean": 100, "speed_kps": 9, "error_rate": 0.1},
    ])
    out = team_drift(df)
    assert out[0]["user"] == "a" and {d["day"] for d in out[0]["days"]} == {"2026-09-06", "earlier"}
    assert all(d["n"] == 1 for d in out[0]["days"])                # stress row excluded


def test_build_writes_json(tmp_path):
    ext = tmp_path / "ext"; ext.mkdir()
    weekly("mt_A", 30, step=0.3).to_csv(ext / "monkeytype_weekly.csv", index=False)
    cmu_like().to_csv(ext / "cmu_password_features.csv", index=False)
    out = tmp_path / "drift.json"
    d = build(external=ext, features_csv=tmp_path / "nope.csv", out=out, holdout=False)
    j = json.loads(out.read_text())
    assert j["monkeytype"][0]["user"] == "mt_A" and j["cmu"]["subjects"] == 6 and "team" not in j
    assert "framing" in j and d["monkeytype"] == j["monkeytype"]
