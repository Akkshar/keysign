import numpy as np
import pandas as pd
import pytest

from pipeline.baseline import (
    BASELINE_FEATURES, Baseline, build_all, build_baseline, robust_center_scale, score_frame,
)
from pipeline.features import FEATURE_NAMES

rng = np.random.default_rng(0)


def fake_frame(user, n, condition="calm", shift=0.0, seed=0):
    r = np.random.default_rng(seed)
    rows = []
    for i in range(n):
        f = {name: 100.0 + r.normal(0, 10) for name in FEATURE_NAMES}
        f["error_rate"] = 0.0                     # constant in calm typing
        f["hold_mean"] += shift
        rows.append({"sample_id": f"{user}_{condition}_{i}", "user": user, "condition": condition, "started_at": "", **f})
    return pd.DataFrame(rows)


def test_robust_center_scale_ignores_outlier_and_floors_zero_spread():
    X = np.array([[100, 0.0], [102, 0.0], [98, 0.0], [101, 0.0], [5000, 0.0]])
    c, s = robust_center_scale(X)
    assert c[0] == pytest.approx(101)
    assert s[0] < 50                              # the 5000 outlier does not blow up the scale
    assert s[1] > 0                               # constant column still has a positive scale


def test_build_requires_min_samples_and_uses_only_calm():
    df = pd.concat([fake_frame("a", 2), fake_frame("a", 5, "stress", shift=50)])
    with pytest.raises(ValueError):
        build_baseline(df, "a")
    b = build_baseline(df, "a", condition=None)
    assert b.n_samples == 7 and b.condition == "any"


def test_distance_separates_shifted_samples():
    calm = fake_frame("a", 20)
    b = build_baseline(calm, "a")
    assert b.features == BASELINE_FEATURES
    d_calm = b.distance(calm[BASELINE_FEATURES].to_numpy())
    assert d_calm.shape == (20,)
    assert 0.5 < np.median(d_calm) < 1.5           # in-distribution samples sit near 1
    off = fake_frame("a", 20, "stress", shift=60, seed=1)      # hold_mean +6 sigma
    d_off = b.distance(off[BASELINE_FEATURES].to_numpy())
    assert np.median(d_off) > np.median(d_calm)
    top = b.explain(off.iloc[0].to_dict())
    assert top[0][0] == "hold_mean" and top[0][1] > 3


def test_zscores_accept_dict_series_and_array():
    calm = fake_frame("a", 10)
    b = build_baseline(calm, "a")
    row = calm.iloc[0]
    z1 = b.zscores(row.to_dict()); z2 = b.zscores(row); z3 = b.zscores(row[BASELINE_FEATURES].to_numpy())
    assert np.allclose(z1, z2) and np.allclose(z2, z3)
    with pytest.raises(ValueError):
        b.zscores(np.zeros(3))


def test_json_roundtrip(tmp_path):
    b = build_baseline(fake_frame("Akkshar Ranjan", 8), "Akkshar Ranjan")
    p = b.save(tmp_path / "x.json")
    b2 = Baseline.load(p)
    assert b2.user == b.user and b2.features == b.features and b2.n_samples == 8
    assert np.allclose(b2.center, b.center) and np.allclose(b2.scale, b.scale)


def test_score_frame_and_build_all(tmp_path):
    df = pd.concat([fake_frame("a", 6), fake_frame("b", 6, seed=2), fake_frame("c", 2, seed=3)])
    built = build_all(df, tmp_path)
    assert set(built) == {"a", "b"}                # c has too few samples
    assert (tmp_path / "a.json").exists()
    scored = score_frame(built["a"], df)
    assert "distance" in scored.columns and "z_hold_mean" in scored.columns
    assert scored.loc[scored.user == "b", "distance"].median() > scored.loc[scored.user == "a", "distance"].median()
