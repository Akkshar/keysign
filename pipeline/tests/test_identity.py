import numpy as np
import pandas as pd
import pytest

from pipeline.features import FEATURE_NAMES
from pipeline.identity import IDENTITY_FEATURES, IdentityModel, train


def fake_users(n_per_user=12, seed=0):
    """Three synthetic typists with distinct hold/flight signatures."""
    r = np.random.default_rng(seed)
    rows = []
    for user, (hold, flight) in {"ann": (80, 140), "bob": (120, 220), "cat": (60, 300)}.items():
        for i in range(n_per_user):
            f = {name: 50 + r.normal(0, 5) for name in FEATURE_NAMES}
            f["hold_mean"] = hold + r.normal(0, 6); f["hold_median"] = hold + r.normal(0, 6)
            f["flight_mean"] = flight + r.normal(0, 15); f["flight_median"] = flight + r.normal(0, 15)
            f["speed_kps"] = 1000 / flight + r.normal(0, 0.3)
            rows.append({"sample_id": f"{user}{i}", "user": user, "condition": "calm", "started_at": "", **f})
    return pd.DataFrame(rows)


def test_fit_predict_and_confidence():
    df = fake_users()
    m = IdentityModel().fit(df)
    assert set(m.users) == {"ann", "bob", "cat"}
    assert m.cv_accuracy > 0.9
    row = df[df.user == "bob"].iloc[0]
    p = m.predict(row.to_dict())
    assert p["user"] == "bob" and 0.5 < p["confidence"] <= 1.0
    assert abs(sum(p["probs"].values()) - 1) < 1e-6
    assert (m.predict_many(df) == df.user).mean() > 0.95


def test_save_load_roundtrip(tmp_path):
    df = fake_users()
    m = IdentityModel().fit(df, evaluate=False)
    path = m.save(tmp_path / "id.joblib")
    m2 = IdentityModel.load(path)
    assert m2.users == m.users and m2.features == IDENTITY_FEATURES
    row = df.iloc[5].to_dict()
    assert m2.predict(row)["user"] == m.predict(row)["user"]


def test_train_cli_skips_tiny_users(tmp_path, capsys):
    df = pd.concat([fake_users(), fake_users(n_per_user=2, seed=1).assign(user=lambda d: d.user + "_x")])
    csv = tmp_path / "f.csv"; df.to_csv(csv, index=False)
    m = train(csv, tmp_path / "m.joblib", min_samples=5)
    assert set(m.users) == {"ann", "bob", "cat"}
    assert "skipped" in capsys.readouterr().out
