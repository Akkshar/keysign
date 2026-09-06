"""
Identity head model: who is typing?

A RandomForest over the length-independent features (digraph timings
included: they help identity even though they hurt the baseline distance).
Open-set decision ("unknown user") is made in the backend head. The
classifier's confidence is useless for it (a stranger gets called someone
with 92% confidence), so `train` also calibrates a per-user open-set score
into each baseline: distance weighted by this model's feature importances,
thresholded at the user's own p95 (see calibrate_open_set).

    uv run python -m pipeline.features <exports...> --windows -o data/features_windows.csv
    uv run python -m pipeline.identity train data/features_windows.csv -o data/models/identity.joblib
    uv run python -m pipeline.identity eval  data/features_windows.csv

Train on the *windows* file: the backend scores 10 s windows, and a model
trained on whole 70-key samples misreads short or unusually fast windows
(measured: Shourya's fast windows were called Utkarsh 17-33% of the time;
window-trained, held out by sample, that drops to 0-10%).

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
from sklearn.model_selection import GroupKFold, StratifiedKFold, cross_val_predict

from pipeline.baseline import Baseline, _slug
from pipeline.features import FEATURE_NAMES

# Length-independent features. Digraph timings are left out: on the 131-sample
# team set they cost a point of accuracy (96.2% with, 97.7% without) because a
# 70-key sample sees each digraph only once or twice. Revisit with more data.
IDENTITY_FEATURES: list[str] = [f for f in FEATURE_NAMES
                                if f not in ("n_keys", "duration_s", "pause_count", "longest_pause_ms")
                                and not f.startswith("dg_")]
DEFAULT_MODEL_PATH = Path("data/models/identity.joblib")
DEFAULT_BASELINE_DIR = Path("data/baselines")
OPEN_SET_MIN_KEYS = 25          # calibrate on windows at least this big (the backend gates the rule the same way)
OPEN_SET_FALSE_RATE = 0.10      # threshold = the user's own score at this quantile from the top.
                                # Per window; the head majority-votes 5 windows, so the shown false-unknown
                                # rate is far lower. Held-out strangers flagged: p95 87% (worst pair 31%),
                                # p90 92% (worst pair 62%).
OPEN_SET_THRESHOLD_RANGE = (2.0, 3.5)


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
            groups = df["sample_id"].to_numpy() if "sample_id" in df else None
            self.cv_accuracy = cross_val_accuracy(X, y, self.features, groups=groups)
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
        # Store plain parts, not this object: a pickled IdentityModel instance
        # records the class under whatever module trained it (__main__ when run
        # as a script) and then fails to load inside the server.
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"clf": self.clf, "features": self.features, "users": self.users, "n_train": self.n_train,
                     "cv_accuracy": self.cv_accuracy, "trained_at": self.trained_at}, path)
        return path

    @classmethod
    def load(cls, path: Path | str = DEFAULT_MODEL_PATH) -> "IdentityModel":
        d = joblib.load(path)
        m = cls(features=d["features"])
        m.clf, m.users, m.n_train = d["clf"], list(d["users"]), int(d["n_train"])
        m.cv_accuracy, m.trained_at = d.get("cv_accuracy"), d.get("trained_at", "")
        return m


def cross_val_accuracy(X: np.ndarray, y: np.ndarray, features: list[str], folds: int = 5,
                       groups: np.ndarray | None = None) -> float:
    """
    Stratified k-fold accuracy; k shrinks to the smallest class if needed.
    With `groups` (sample ids) and more rows than groups, whole samples are
    held out together so windows of one sample can't leak into the test fold.
    """
    counts = pd.Series(y).value_counts()
    k = int(max(2, min(folds, counts.min())))
    clf = RandomForestClassifier(n_estimators=300, random_state=0, class_weight="balanced", n_jobs=-1)
    if groups is not None and len(set(groups)) < len(groups):
        k = int(max(2, min(folds, len(set(groups)))))
        pred = cross_val_predict(clf, X, y, cv=GroupKFold(k), groups=groups)
    else:
        pred = cross_val_predict(clf, X, y, cv=StratifiedKFold(k, shuffle=True, random_state=0))
    return float((pred == y).mean())


def calibrate_open_set(model: IdentityModel, df: pd.DataFrame, baseline_dir: Path | str | None = DEFAULT_BASELINE_DIR,
                       min_keys: int = OPEN_SET_MIN_KEYS, false_rate: float = OPEN_SET_FALSE_RATE,
                       threshold_range: tuple[float, float] = OPEN_SET_THRESHOLD_RANGE) -> dict[str, float]:
    """
    Give every enrolled user's baseline an open-set score: the identity model's
    feature importances as weights (mean 1 over the baseline features) and a
    threshold at the user's own (1 - false_rate) quantile on their windows with
    >= min_keys keys, clipped to threshold_range. Saves the baselines in place.
    Returns {user: threshold} for the users that had a baseline.
    """
    if baseline_dir is None:
        return {}
    baseline_dir = Path(baseline_dir)
    imp = pd.Series(model.clf.feature_importances_, index=model.features)
    out: dict[str, float] = {}
    for user in model.users:
        path = baseline_dir / f"{_slug(user)}.json"
        if not path.exists():
            continue
        b = Baseline.load(path)
        w = imp.reindex(b.features).fillna(0.0).to_numpy(dtype=float)
        if w.sum() <= 0:
            continue
        w = w / w.sum() * len(w)
        b.open_set = {"weights": [float(v) for v in w], "threshold": None,
                      "calibrated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                      "note": f"identity importances; own p{int((1 - false_rate) * 100)} on windows >= {min_keys} keys"}
        own = df[(df["user"] == user) & (df["n_keys"] >= min_keys)] if "n_keys" in df else df[df["user"] == user]
        if len(own) >= 5:
            scores = np.asarray(b.open_set_score(own[b.features].to_numpy(dtype=float)))
            thr = float(np.clip(np.quantile(scores, 1 - false_rate), *threshold_range))
        else:
            thr = float(threshold_range[1])
        b.open_set["threshold"] = thr
        b.save(path)
        out[user] = thr
    return out


def train(features_csv: Path | str, out: Path | str = DEFAULT_MODEL_PATH, min_samples: int = 5,
          baselines: Path | str | None = DEFAULT_BASELINE_DIR) -> IdentityModel:
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
    thresholds = calibrate_open_set(m, df, baselines)
    if thresholds:
        print(f"  open-set thresholds (weighted distance, own p{int((1 - OPEN_SET_FALSE_RATE) * 100)}): " +
              ", ".join(f"{u} {t:.2f}" for u, t in thresholds.items()))
    return m


def _main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="KeySign identity model")
    sub = p.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("train"); t.add_argument("features_csv"); t.add_argument("-o", "--out", default=str(DEFAULT_MODEL_PATH))
    t.add_argument("--baselines", default=str(DEFAULT_BASELINE_DIR),
                   help="baseline folder to calibrate the open-set score in ('' to skip)")
    e = sub.add_parser("eval"); e.add_argument("features_csv")
    a = p.parse_args(argv)
    if a.cmd == "train":
        train(a.features_csv, a.out, baselines=a.baselines or None)
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
