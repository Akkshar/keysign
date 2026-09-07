"""
State head model: how loaded is the typist right now?

Stress / cognitive load has a *direction* relative to the person's own calm
baseline (measured on the team set: faster, more key overlap, more errors,
fewer pauses), so a symmetric distance can't see it. This model is a
regularised logistic regression on per-user robust z-scores: every row is
"how far from *this person's* calm" per feature, then one classifier is
shared across people. Output is P(stress) in [0, 1] plus the features that
pushed it, so the dashboard can say why.

    uv run python -m pipeline.state train data/features.csv -o data/models/state.joblib
    uv run python -m pipeline.state eval  data/features.csv          # leave-one-user-out AUC

    from pipeline.state import StateModel, rule_load
    m = StateModel.load("data/models/state.joblib")
    m.predict(zscores_dict) -> {"load": 0.71, "drivers": [["speed_kps", 0.9], ...]}

rule_load(z) is the no-model fallback: a fixed weighting of the four
directions above, so the head works before anyone has trained anything.

    uv run python -m pipeline.state calibrate data/features_windows.csv

writes per-user label cut-offs into each baseline JSON. Measured on the team:
calm typing scores 0.12-0.23 on the rule and stress 0.18-0.71, so one global
cut-off (0.25 / 0.50) called everyone "deep focus" all day. Per person:
deep focus below their calm p30, high load above the larger of their calm
p85 and the midpoint between their calm and stress medians.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

from pipeline.baseline import BASELINE_FEATURES, Baseline, _slug, build_baseline

STATE_FEATURES: list[str] = list(BASELINE_FEATURES)
DEFAULT_MODEL_PATH = Path("data/models/state.joblib")
Z_CLIP = 5.0

# Fallback weights: direction of stress measured on the team data. Positive
# = more of this means more load. Scaled so ~3 sigma on every driver -> 1.0.
RULE_WEIGHTS = {"speed_kps": 0.30, "error_rate": 0.25, "rp_negative_ratio": 0.20,
                "flight_median": -0.15, "hold_mean": -0.10}


def rule_load(z: dict[str, float]) -> float:
    s = sum(w * max(0.0, np.sign(w) * z.get(f, 0.0)) * np.sign(w) for f, w in RULE_WEIGHTS.items())
    return float(max(0.0, min(1.0, s / 3.0)))


class StateModel:
    def __init__(self, features: list[str] = STATE_FEATURES, C: float = 0.3):
        self.features = list(features)
        self.clf = LogisticRegression(C=C, class_weight="balanced", max_iter=5000)
        self.n_train = 0
        self.louo_auc: float | None = None
        self.trained_at = ""

    def fit(self, Z: pd.DataFrame, y: np.ndarray) -> "StateModel":
        self.clf.fit(np.clip(Z[self.features].to_numpy(dtype=float), -Z_CLIP, Z_CLIP), y)
        self.n_train = len(Z)
        self.trained_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        return self

    def predict(self, z, top: int = 3) -> dict:
        vec = np.clip(np.asarray([float(z[f]) for f in self.features]), -Z_CLIP, Z_CLIP)
        p = float(self.clf.predict_proba(vec.reshape(1, -1))[0, 1])
        contrib = self.clf.coef_[0] * vec
        order = np.argsort(-np.abs(contrib))[:top]
        return {"load": p, "drivers": [[self.features[i], round(float(contrib[i]), 2)] for i in order]}

    def coefficients(self) -> pd.Series:
        return pd.Series(self.clf.coef_[0], index=self.features).sort_values(key=np.abs, ascending=False)

    def save(self, path: Path | str = DEFAULT_MODEL_PATH) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"clf": self.clf, "features": self.features, "n_train": self.n_train,
                     "louo_auc": self.louo_auc, "trained_at": self.trained_at}, path)
        return path

    @classmethod
    def load(cls, path: Path | str = DEFAULT_MODEL_PATH) -> "StateModel":
        d = joblib.load(path)
        m = cls(features=d["features"])
        m.clf, m.n_train, m.louo_auc, m.trained_at = d["clf"], int(d["n_train"]), d.get("louo_auc"), d.get("trained_at", "")
        return m


# ---------------------------------------------------------------------------
# Data prep: features -> per-user z-scores against each user's calm baseline
# ---------------------------------------------------------------------------

def zscore_frame(df: pd.DataFrame, baselines_dir: Path | str | None = None, min_calm: int = 4) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """
    Returns (Z, y, users) for rows whose user has a baseline. If baselines_dir
    is None (or a user has no file there) the baseline is built on the fly from
    that user's calm rows in df.
    """
    Zs, ys, us = [], [], []
    for user, g in df.groupby("user"):
        b = None
        if baselines_dir is not None:
            p = Path(baselines_dir) / f"{_slug(user)}.json"
            if p.exists():
                b = Baseline.load(p)
        if b is None:
            if (g["condition"] == "calm").sum() < min_calm:
                continue
            b = build_baseline(g, user, features=STATE_FEATURES)
        Z = b.zscores(g[b.features].to_numpy(dtype=float))
        Zs.append(pd.DataFrame(Z, columns=b.features, index=g.index))
        ys.append((g["condition"] == "stress").astype(int).to_numpy())
        us.append(np.full(len(g), user))
    if not Zs:
        raise ValueError("no user with enough calm samples")
    return pd.concat(Zs), np.concatenate(ys), np.concatenate(us)


def leave_one_user_out_auc(Z: pd.DataFrame, y: np.ndarray, users: np.ndarray, C: float = 0.3) -> float:
    probs = np.zeros(len(y))
    for u in np.unique(users):
        tr = users != u
        if len(np.unique(y[tr])) < 2:
            continue
        m = StateModel(C=C).fit(Z[tr], y[tr])
        probs[~tr] = m.clf.predict_proba(np.clip(Z[~tr][m.features].to_numpy(dtype=float), -Z_CLIP, Z_CLIP))[:, 1]
    return float(roc_auc_score(y, probs)) if len(np.unique(y)) > 1 else float("nan")


def train(features_csv: Path | str, baselines_dir: Path | str | None = "data/baselines",
          out: Path | str = DEFAULT_MODEL_PATH) -> StateModel:
    df = pd.read_csv(features_csv)
    Z, y, users = zscore_frame(df, baselines_dir)
    m = StateModel().fit(Z, y)
    m.louo_auc = leave_one_user_out_auc(Z, y, users)
    m.save(out)
    rule = np.asarray([rule_load(dict(zip(Z.columns, row))) for row in Z.to_numpy()])
    rule_auc = float(roc_auc_score(y, rule)) if len(np.unique(y)) > 1 else float("nan")
    print(f"state: {len(y)} rows ({int(y.sum())} stress) from {len(np.unique(users))} users -> {out}")
    print(f"  leave-one-user-out AUC: trained model {m.louo_auc:.2f} | fixed rule {rule_auc:.2f}")
    print("  the backend uses the model only if its AUC >= 0.80 (backend/heads.py MODEL_MIN_AUC), else the rule")
    print("  directions (coef on z):", ", ".join(f"{k} {v:+.2f}" for k, v in m.coefficients().head(6).items()))
    return m


DEFAULT_FOCUS_BELOW, DEFAULT_LOAD_ABOVE = 0.10, 0.35     # global fallbacks, from the team's calm p30 / p85
THRESHOLD_FLOOR = 0.04                                   # a person whose calm sits at 0 still needs a gap


def calibrate_thresholds(windows_csv: Path | str, baselines_dir: Path | str = "data/baselines",
                         min_keys: int = 20, min_rows: int = 20) -> dict[str, tuple[float, float]]:
    """
    Per-user State cut-offs from that person's own windows, saved into their
    baseline JSON. Returns {user: (focus_below, load_above)}.
    """
    df = pd.read_csv(windows_csv)
    if "n_keys" in df:
        df = df[df["n_keys"] >= min_keys]
    out: dict[str, tuple[float, float]] = {}
    for user, g in df.groupby("user"):
        path = Path(baselines_dir) / f"{_slug(user)}.json"
        if not path.exists():
            continue
        b = Baseline.load(path)
        Z = np.clip(b.zscores(g[b.features].to_numpy(dtype=float)), -Z_CLIP, Z_CLIP)
        load = np.asarray([rule_load(dict(zip(b.features, row))) for row in Z])
        calm, stress = load[(g["condition"] == "calm").to_numpy()], load[(g["condition"] == "stress").to_numpy()]
        if len(calm) < min_rows:
            continue
        focus_below = float(max(THRESHOLD_FLOOR, np.quantile(calm, 0.30)))
        load_above = float(np.quantile(calm, 0.85))
        if len(stress) >= min_rows // 2:
            load_above = max(load_above, float((np.median(calm) + np.median(stress)) / 2))
        load_above = float(max(load_above, focus_below + 2 * THRESHOLD_FLOOR))
        b.state = {"focus_below": round(focus_below, 3), "load_above": round(load_above, 3),
                   "calibrated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                   "note": f"rule_load on {len(calm)} calm / {len(stress)} stress windows >= {min_keys} keys"}
        b.save(path)
        out[user] = (focus_below, load_above)
    return out


def _main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="KeySign state (cognitive load) model")
    sub = p.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("train"); t.add_argument("features_csv"); t.add_argument("--baselines", default="data/baselines"); t.add_argument("-o", "--out", default=str(DEFAULT_MODEL_PATH))
    e = sub.add_parser("eval"); e.add_argument("features_csv"); e.add_argument("--baselines", default="data/baselines")
    c = sub.add_parser("calibrate", help="per-user deep-focus / high-load cut-offs into the baselines")
    c.add_argument("windows_csv"); c.add_argument("--baselines", default="data/baselines")
    a = p.parse_args(argv)
    if a.cmd == "train":
        train(a.features_csv, a.baselines, a.out)
    elif a.cmd == "calibrate":
        thr = calibrate_thresholds(a.windows_csv, a.baselines)
        for u, (lo, hi) in thr.items():
            print(f"{u:16s} deep focus < {lo:.2f}   high load >= {hi:.2f}")
        if not thr:
            print("no user with a baseline and enough windows", file=sys.stderr); return 1
    else:
        df = pd.read_csv(a.features_csv)
        Z, y, users = zscore_frame(df, a.baselines)
        print(f"leave-one-user-out AUC {leave_one_user_out_auc(Z, y, users):.2f} on {len(y)} rows, {len(np.unique(users))} users")
        for u in np.unique(users):
            m_ = users == u
            r = np.asarray([rule_load(dict(zip(Z.columns, row))) for row in Z[m_].to_numpy()])
            if len(np.unique(y[m_])) > 1:
                print(f"  {u:16s} rule-only AUC {roc_auc_score(y[m_], r):.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(_main())
