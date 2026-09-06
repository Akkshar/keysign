"""
Identity head model: who is typing?

A RandomForest over the length-independent features (digraph timings
included: they help identity even though they hurt the baseline distance).
Open-set decision ("unknown user") is made in the backend head by combining
the classifier's confidence with the distance to the predicted user's
baseline; this module only does the closed-set part.

    uv run python -m pipeline.identity train data/features.csv -o data/models/identity.joblib
    uv run python -m pipeline.identity eval  data/features.csv

    from pipeline.identity import IdentityModel
    m = IdentityModel.load("data/models/identity.joblib")
    m.predict(features_dict) -> {"user": "Shourya", "confidence": 0.81, "probs": {...}}
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold, cross_val_predict

from pipeline.features import FEATURE_NAMES

# Length-independent features. Digraph timings are left out: on the 131-sample
# team set they cost a point of accuracy (96.2% with, 97.7% without) because a
# 70-key sample sees each digraph only once or twice. Revisit with more data.
IDENTITY_FEATURES: list[str] = [f for f in FEATURE_NAMES
                                if f not in ("n_keys", "duration_s", "pause_count", "longest_pause_ms")
                                and not f.startswith("dg_")]
DEFAULT_MODEL_PATH = Path("data/models/identity.joblib")


class IdentityModel:
    def __init__(self, features: list[str] = IDENTITY_FEATURES, n_estimators: int = 300, random_state: int = 0):
        self.features = list(features)
        self.clf = RandomForestClassifier(n_estimators=n_estimators, random_state=random_state,
                                          class_weight="balanced", min_samples_leaf=1, n_jobs=-1)
        self.users: list[str] = []
        self.n_train = 0
        self.cv_accuracy: float | None = None
        self.trained_at = ""

    # ---- training ----
    def fit(self, df: pd.DataFrame, evaluate: bool = True) -> "IdentityModel":
        X = df[self.features].to_numpy(dtype=float)
        y = df["user"].astype(str).to_numpy()
        if evaluate:
            self.cv_accuracy = cross_val_accuracy(X, y, self.features)
        self.clf.fit(X, y)
        self.users = list(self.clf.classes_)
        self.n_train = len(df)
        self.trained_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        return self

    # ---- inference ----
    def _vec(self, x) -> np.ndarray:
        if isinstance(x, dict):
            return np.asarray([[float(x[f]) for f in self.features]])
        if isinstance(x, pd.DataFrame):
            return x[self.features].to_numpy(dtype=float)
        x = np.asarray(x, dtype=float)
        return x.reshape(1, -1) if x.ndim == 1 else x

    def predict(self, x) -> dict:
        p = self.clf.predict_proba(self._vec(x))[0]
        i = int(np.argmax(p))
        return {"user": self.users[i], "confidence": float(p[i]),
                "probs": {u: round(float(v), 3) for u, v in zip(self.users, p)}}

    def predict_many(self, df: pd.DataFrame) -> np.ndarray:
        return self.clf.predict(self._vec(df))

    # ---- persistence ----
    def save(self, path: Path | str = DEFAULT_MODEL_PATH) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path)
        return path

    @classmethod
    def load(cls, path: Path | str = DEFAULT_MODEL_PATH) -> "IdentityModel":
        return joblib.load(path)


def cross_val_accuracy(X: np.ndarray, y: np.ndarray, features: list[str], folds: int = 5) -> float:
    """Stratified k-fold accuracy; k shrinks to the smallest class if needed."""
    counts = pd.Series(y).value_counts()
    k = int(max(2, min(folds, counts.min())))
    cv = StratifiedKFold(k, shuffle=True, random_state=0)
    clf = RandomForestClassifier(n_estimators=300, random_state=0, class_weight="balanced", n_jobs=-1)
    pred = cross_val_predict(clf, X, y, cv=cv)
    return float((pred == y).mean())


def train(features_csv: Path | str, out: Path | str = DEFAULT_MODEL_PATH, min_samples: int = 5) -> IdentityModel:
    df = pd.read_csv(features_csv)
    counts = df["user"].value_counts()
    keep = counts[counts >= min_samples].index
    dropped = sorted(set(counts.index) - set(keep))
    df = df[df["user"].isin(keep)]
    if df["user"].nunique() < 2:
        raise ValueError("need at least 2 users with >= %d samples" % min_samples)
    m = IdentityModel().fit(df)
    m.save(out)
    print(f"identity: {len(df)} samples, {df['user'].nunique()} users, "
          f"cv accuracy {m.cv_accuracy:.1%}, chance {1/df['user'].nunique():.1%} -> {out}")
    if dropped:
        print(f"  skipped (fewer than {min_samples} samples): {', '.join(dropped)}")
    return m


def _main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="KeySign identity model")
    sub = p.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("train"); t.add_argument("features_csv"); t.add_argument("-o", "--out", default=str(DEFAULT_MODEL_PATH))
    e = sub.add_parser("eval"); e.add_argument("features_csv")
    a = p.parse_args(argv)
    if a.cmd == "train":
        train(a.features_csv, a.out)
    else:
        df = pd.read_csv(a.features_csv)
        X, y = df[IDENTITY_FEATURES].to_numpy(dtype=float), df["user"].astype(str).to_numpy()
        counts = pd.Series(y).value_counts()
        cv = StratifiedKFold(int(max(2, min(5, counts.min()))), shuffle=True, random_state=0)
        pred = cross_val_predict(RandomForestClassifier(300, random_state=0, class_weight="balanced", n_jobs=-1), X, y, cv=cv)
        print(f"cv accuracy {(pred == y).mean():.1%} on {len(y)} samples, {len(counts)} users (chance {1/len(counts):.1%})")
        print(pd.crosstab(pd.Series(y, name="true"), pd.Series(pred, name="pred")).to_string())
    return 0


if __name__ == "__main__":
    sys.exit(_main())
