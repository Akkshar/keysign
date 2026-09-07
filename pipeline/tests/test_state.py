import json

import numpy as np
import pandas as pd
import pytest

from pipeline.baseline import BASELINE_FEATURES
from pipeline.features import FEATURE_NAMES
from pipeline.state import (
    STATE_FEATURES, StateModel, leave_one_user_out_auc, rule_load, train, zscore_frame,
)


def team(n_calm=15, n_stress=10, seed=0, users=("a", "b", "c")):
    """Synthetic people whose stress = faster, more errors, more overlap, relative to their own calm."""
    r = np.random.default_rng(seed)
    rows = []
    for k, u in enumerate(users):
        base_speed, base_hold = 4 + k, 90 + 15 * k
        for cond, n in (("calm", n_calm), ("stress", n_stress)):
            for i in range(n):
                f = {name: 1.0 + r.normal(0, 0.1) for name in FEATURE_NAMES}
                s = 1.0 if cond == "stress" else 0.0
                f["speed_kps"] = base_speed * (1 + 0.25 * s) + r.normal(0, 0.3)
                f["hold_mean"] = base_hold * (1 - 0.1 * s) + r.normal(0, 4)
                f["error_rate"] = 0.02 + 0.05 * s + abs(r.normal(0, 0.01))
                f["rp_negative_ratio"] = 0.1 + 0.3 * s + abs(r.normal(0, 0.05))
                f["flight_median"] = 1000 / f["speed_kps"] + r.normal(0, 10)
                rows.append({"sample_id": f"{u}{cond}{i}", "user": u, "condition": cond, "started_at": "", **f})
    return pd.DataFrame(rows)


def test_rule_load_direction_and_range():
    calm = {f: 0.0 for f in STATE_FEATURES}
    assert rule_load(calm) == 0.0
    stressed = dict(calm, speed_kps=3.0, error_rate=3.0, rp_negative_ratio=3.0, flight_median=-3.0, hold_mean=-3.0)
    assert rule_load(stressed) == pytest.approx(1.0)
    relaxed = dict(calm, speed_kps=-3.0, error_rate=-3.0)      # slower + fewer errors is not load
    assert rule_load(relaxed) == 0.0


def test_zscore_frame_builds_baselines_on_the_fly():
    df = team()
    Z, y, users = zscore_frame(df, baselines_dir=None)
    assert list(Z.columns) == STATE_FEATURES and len(Z) == len(df)
    assert y.sum() == 30 and set(users) == {"a", "b", "c"}
    # calm rows sit near 0 for their own user, stress rows move up in speed
    assert abs(Z.loc[df.condition == "calm", "speed_kps"].median()) < 0.5
    assert Z.loc[df.condition == "stress", "speed_kps"].median() > 2


def test_model_learns_direction_and_generalises_across_people():
    df = team()
    Z, y, users = zscore_frame(df, None)
    assert leave_one_user_out_auc(Z, y, users) > 0.95
    m = StateModel().fit(Z, y)
    hi = m.predict(Z[df.condition == "stress"].iloc[0].to_dict())
    lo = m.predict(Z[df.condition == "calm"].iloc[0].to_dict())
    assert hi["load"] > 0.7 > 0.3 > lo["load"]
    assert hi["drivers"][0][0] in ("speed_kps", "rp_negative_ratio", "error_rate", "flight_median", "hold_mean")
    coef = m.coefficients()
    assert coef["speed_kps"] > 0 and coef["rp_negative_ratio"] > 0


def test_train_cli_and_roundtrip(tmp_path, capsys):
    df = team()
    csv = tmp_path / "f.csv"; df.to_csv(csv, index=False)
    m = train(csv, baselines_dir=None, out=tmp_path / "s.joblib")
    assert m.louo_auc > 0.95 and "leave-one-user-out" in capsys.readouterr().out
    m2 = StateModel.load(tmp_path / "s.joblib")
    z = zscore_frame(df, None)[0].iloc[3].to_dict()
    assert m2.predict(z)["load"] == pytest.approx(m.predict(z)["load"])
    assert m2.features == STATE_FEATURES and m2.n_train == len(df)


def test_calibrate_thresholds_writes_per_user_cutoffs(tmp_path):
    from pipeline.baseline import Baseline, build_baseline
    from pipeline.features import FEATURE_NAMES
    from pipeline.state import calibrate_thresholds
    rng = np.random.default_rng(0)
    rows = []
    for i in range(60):
        f = {name: 50 + rng.normal(0, 3) for name in FEATURE_NAMES}
        stress = i >= 40
        f["speed_kps"] = 5 + (2.5 if stress else 0) + rng.normal(0, 0.3)
        f["error_rate"] = 0.02 + (0.08 if stress else 0) + rng.normal(0, 0.01)
        f["rp_negative_ratio"] = 0.1 + (0.2 if stress else 0) + rng.normal(0, 0.02)
        f["n_keys"] = 40
        rows.append({"sample_id": f"s{i}", "user": "ann", "condition": "stress" if stress else "calm", "started_at": "", **f})
    import pandas as pd
    df = pd.DataFrame(rows)
    bdir = tmp_path / "b"; bdir.mkdir()
    build_baseline(df, "ann").save(bdir / "ann.json")
    csv = tmp_path / "w.csv"; df.to_csv(csv, index=False)
    thr = calibrate_thresholds(csv, bdir)
    lo, hi = thr["ann"]
    assert 0 < lo < hi < 1
    b = Baseline.load(bdir / "ann.json")
    assert b.state["focus_below"] == round(lo, 3) and b.state["load_above"] == round(hi, 3)
    assert json.loads((bdir / "ann.json").read_text())["state"]["load_above"] == round(hi, 3)
