"""
Drift head (chart only): is a person's typing baseline moving over weeks?

We have no longitudinal keystroke data of our own, so the chart is built from
public sources converted by pipeline/datasets.py, plus whatever the team has
recorded so far:

  monkeytype  22 people, 15k typing tests over months. Weekly medians of
              wpm / accuracy / consistency, a rolling personal baseline, and
              a drift score: how far the latest weeks sit from the first
              weeks, in that person's own MAD units.
  cmu         51 people x 8 sessions of the same password. Session-to-session
              shift of hold and flight, and how much an identity model
              trained on sessions 1-4 loses on sessions 5-8.
  team        our own samples grouped by day (only a couple of days so far).

Output: dashboard/public/drift.json (small, aggregated, safe to commit).

    uv run python -m pipeline.drift            # rebuild the JSON
    uv run python -m pipeline.drift --print    # summary only

Framing for the pitch: a screening signal, never a diagnosis. The MIT
neuroQWERTY work showed keystroke timing drifts with motor decline; KeySign
would surface "your baseline moved" and leave interpretation to a clinician.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
EXTERNAL = ROOT / "data" / "external"
OUT = ROOT / "dashboard" / "public" / "drift.json"

BASE_WEEKS = 8          # first N weeks define the personal baseline
CUR_WEEKS = 8           # last N weeks are "now"
ROLL = 6                # rolling median window, weeks
MAD_TO_SIGMA = 1.4826


def drift_score(series: np.ndarray, base_n: int = BASE_WEEKS, cur_n: int = CUR_WEEKS) -> dict:
    """(latest median - baseline median) / baseline MAD-sigma, plus a slope per 30 days."""
    x = np.asarray(series, dtype=float)
    x = x[~np.isnan(x)]
    if len(x) < base_n + cur_n:
        return {"z": None, "delta": None, "slope_per_month": None, "n": int(len(x))}
    base, cur = x[:base_n], x[-cur_n:]
    med = np.median(base)
    mad = np.median(np.abs(base - med)) * MAD_TO_SIGMA
    scale = max(mad, 0.05 * abs(med), 1e-6)
    t = np.arange(len(x))
    slope = float(np.polyfit(t, x, 1)[0]) * (30 / 7)          # per week -> per ~month
    return {"z": round(float((np.median(cur) - med) / scale), 2), "delta": round(float(np.median(cur) - med), 2),
            "slope_per_month": round(slope, 3), "n": int(len(x))}


def monkeytype_drift(weekly: pd.DataFrame, min_weeks: int = 24, max_users: int = 8) -> list[dict]:
    """Per-user weekly series with rolling baseline and drift scores; longest histories first."""
    out = []
    weekly = weekly.copy()
    weekly["ts"] = pd.to_datetime(weekly["ts"])
    for user, g in weekly.groupby("user"):
        g = g.sort_values("ts")
        g = g[g["tests"] >= 3]                         # weeks with too few tests are noise
        if len(g) < min_weeks:
            continue
        roll = g[["wpm", "acc", "consistency"]].rolling(ROLL, min_periods=3, center=True).median()
        out.append({
            "user": user,
            "weeks": int(len(g)),
            "span_days": int((g["ts"].iloc[-1] - g["ts"].iloc[0]).days),
            "points": [{"week": r.ts.strftime("%Y-%m-%d"), "wpm": round(float(r.wpm), 1), "acc": round(float(r.acc), 2),
                        "consistency": round(float(r.consistency), 1), "tests": int(r.tests),
                        "wpm_roll": None if np.isnan(w) else round(float(w), 1),
                        "acc_roll": None if np.isnan(a) else round(float(a), 2)}
                       for r, w, a in zip(g.itertuples(index=False), roll["wpm"], roll["acc"])],
            "drift": {"wpm": drift_score(g["wpm"].to_numpy()), "acc": drift_score(g["acc"].to_numpy()),
                      "consistency": drift_score(g["consistency"].to_numpy())},
        })
    out.sort(key=lambda u: -u["span_days"])
    return out[:max_users]


def cmu_session_drift(features: pd.DataFrame, holdout: bool = True) -> dict:
    """Mean hold/flight per session across subjects, per-subject session-8 vs session-1 shift, identity holdout."""
    per = features.groupby("session")[["hold_mean", "flight_mean", "rp_mean", "speed_kps"]].mean()
    first = features[features["session"] == 1].groupby("user")[["hold_mean", "flight_mean"]].mean()
    last = features[features["session"] == features["session"].max()].groupby("user")[["hold_mean", "flight_mean"]].mean()
    shift = (last - first).dropna()
    result = {
        "sessions": [int(s) for s in per.index],
        "hold_mean": [round(float(v), 1) for v in per["hold_mean"]],
        "flight_mean": [round(float(v), 1) for v in per["flight_mean"]],
        "speed_kps": [round(float(v), 2) for v in per["speed_kps"]],
        "subjects": int(features["user"].nunique()),
        "flight_change_pct_median": round(float((shift["flight_mean"] / first.loc[shift.index, "flight_mean"]).median() * 100), 1),
        "hold_change_pct_median": round(float((shift["hold_mean"] / first.loc[shift.index, "hold_mean"]).median() * 100), 1),
    }
    if holdout:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import StratifiedKFold, cross_val_score
        from pipeline.identity import IDENTITY_FEATURES
        X, y = features[IDENTITY_FEATURES].to_numpy(), features["user"].to_numpy()
        rf = lambda: RandomForestClassifier(200, random_state=0, n_jobs=-1)
        rand = float(cross_val_score(rf(), X, y, cv=StratifiedKFold(5, shuffle=True, random_state=0)).mean())
        tr, te = features["session"] <= 4, features["session"] > 4
        sess = float(rf().fit(X[tr], y[tr]).score(X[te], y[te]))
        result["identity_holdout"] = {"random_split": round(rand, 3), "train_s1_4_test_s5_8": round(sess, 3)}
    return result


def team_drift(features: pd.DataFrame) -> list[dict]:
    """Our own samples by day: the start of everyone's personal longitudinal record."""
    f = features.copy()
    f["day"] = pd.to_datetime(f["started_at"], errors="coerce", utc=True).dt.strftime("%Y-%m-%d").fillna("earlier")
    out = []
    for user, g in f[f["condition"] == "calm"].groupby("user"):
        days = g.groupby("day")[["hold_mean", "flight_mean", "speed_kps", "error_rate"]].median()
        out.append({"user": user, "days": [{"day": d, "n": int((g["day"] == d).sum()), "hold_mean": round(float(r.hold_mean), 1),
                                            "flight_mean": round(float(r.flight_mean), 1), "speed_kps": round(float(r.speed_kps), 2)}
                                           for d, r in days.iterrows()]})
    return out


def build(external: Path = EXTERNAL, features_csv: Path = ROOT / "data" / "features.csv", out: Path = OUT,
          holdout: bool = True) -> dict:
    data: dict = {"generated_at": pd.Timestamp.now(tz="UTC").isoformat(timespec="seconds"),
                  "framing": "Screening signal, never a diagnosis. Baselines drift with fatigue, illness, injury and age; "
                             "KeySign would flag the drift and leave interpretation to a person."}
    mt = external / "monkeytype_weekly.csv"
    if mt.exists():
        data["monkeytype"] = monkeytype_drift(pd.read_csv(mt))
    cmu = external / "cmu_password_features.csv"
    if cmu.exists():
        data["cmu"] = cmu_session_drift(pd.read_csv(cmu), holdout=holdout)
    if Path(features_csv).exists():
        data["team"] = team_drift(pd.read_csv(features_csv))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=1), encoding="utf-8")
    return data


def _main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Build the Drift chart data")
    p.add_argument("--print", action="store_true", help="summary only, don't write")
    p.add_argument("--no-holdout", action="store_true", help="skip the CMU identity holdout (faster)")
    a = p.parse_args(argv)
    out = OUT if not a.print else Path(ROOT / "data" / "drift_preview.json")
    d = build(out=out, holdout=not a.no_holdout)
    if "monkeytype" in d:
        print(f"monkeytype: {len(d['monkeytype'])} users with >= 24 active weeks")
        for u in d["monkeytype"]:
            dz = u["drift"]
            print(f"  {u['user']:6s} {u['weeks']:3d} weeks / {u['span_days']:4d} days  drift wpm {dz['wpm']['z']:+.1f}sd "
                  f"({dz['wpm']['delta']:+.1f} wpm, {dz['wpm']['slope_per_month']:+.2f}/month)  acc {dz['acc']['z']:+.1f}sd")
    if "cmu" in d:
        c = d["cmu"]
        print(f"cmu: {c['subjects']} subjects, flight s1->s8 median change {c['flight_change_pct_median']:+.1f}%, "
              f"hold {c['hold_change_pct_median']:+.1f}%")
        if "identity_holdout" in c:
            h = c["identity_holdout"]
            print(f"  identity: random split {h['random_split']:.1%} -> train s1-4/test s5-8 {h['train_s1_4_test_s5_8']:.1%}")
    if "team" in d:
        print(f"team: {len(d['team'])} users, days recorded: " + ", ".join(f"{u['user'].split()[0]} {len(u['days'])}" for u in d["team"]))
    print(f"-> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(_main())
