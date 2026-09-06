"""
Detection heads. Each is a plain function:

    def my_head(features: dict, baseline: Baseline | None, ctx: dict) -> dict

- features: the 28 live features for the current window (pipeline.features.FEATURE_NAMES)
- baseline: the declared user's Baseline, or None if they have no baseline yet
- ctx: per-session dict; keep your own state in ctx["my_head"] (models, history, cooldowns).
       ctx also has "user", "session", "tick", "window" (the raw events of this window).

Return a small JSON-able dict; it lands in tick["heads"][name] on the dashboard.
Register at the bottom. One head per teammate, keep them independent.
"""
from __future__ import annotations

import time
from pathlib import Path

import numpy as np

from backend import explain, notify
from backend.app import ROOT, load_baseline, register_head
from pipeline.baseline import Baseline
from pipeline.identity import IdentityModel
from pipeline.state import StateModel, rule_load

# ---------------------------------------------------------------------------
# Identity: who is typing? RandomForest (pipeline/identity.py) + open-set rule.
# Train with:  uv run python -m pipeline.identity train data/features.csv
# ---------------------------------------------------------------------------
MODEL_PATH = ROOT / "data" / "models" / "identity.joblib"
UNKNOWN_CONF = 0.45      # classifier confidence below this -> unknown
UNKNOWN_DIST = 2.5       # distance to the predicted user's baseline above this -> unknown
                         # (measured: own-baseline medians 0.8-1.6, other-people 1.8-4.1)
VOTES = 5                # majority vote over the last N ticks so the label doesn't flicker
_model_cache: dict[str, tuple[float, IdentityModel]] = {}


def _identity_model() -> IdentityModel | None:
    if not MODEL_PATH.exists():
        return None
    mtime = MODEL_PATH.stat().st_mtime
    hit = _model_cache.get("m")
    if hit and hit[0] == mtime:
        return hit[1]
    m = IdentityModel.load(MODEL_PATH)
    _model_cache["m"] = (mtime, m)
    return m


def identity_head(features: dict, baseline: Baseline | None, ctx: dict) -> dict:
    m = _identity_model()
    if m is None:
        return {"user": None, "unknown": None, "reason": "no identity model yet (uv run python -m pipeline.identity train data/features.csv)"}
    pred = m.predict(features)
    b = load_baseline(pred["user"])
    d = float(b.distance(features)) if b is not None else None
    st = ctx.setdefault("identity", {"history": []})
    st["history"] = (st["history"] + [pred["user"]])[-VOTES:]
    votes = {u: st["history"].count(u) for u in set(st["history"])}
    voted = max(votes, key=votes.get)
    unknown = pred["confidence"] < UNKNOWN_CONF or (d is not None and d > UNKNOWN_DIST)
    return {
        "user": voted,
        "confidence": round(pred["confidence"], 3),
        "distance": round(d, 2) if d is not None else None,
        "unknown": bool(unknown),
        "matches_declared": voted == ctx.get("user"),
        "probs": pred["probs"],
        "votes": votes,
    }

# ---------------------------------------------------------------------------
# Threat: is something wrong right now? Sustained deviation from the person's
# baseline, classified with the other heads' outputs (identity mismatch ->
# intruder, right person but abnormal and loaded -> duress). Fires a SILENT
# alert (backend/notify.py) with a cooldown. Runs after identity and state.
# ---------------------------------------------------------------------------
THREAT_WARN = 2.0            # single-tick distance for "warn"
THREAT_ALERT = 3.0           # distance that must be sustained for "alert"
THREAT_PERSIST = 3           # consecutive ticks (>= 1.5 s of typing) above THREAT_ALERT
THREAT_COOLDOWN_S = 60.0     # minimum gap between pushes per session
_alert_log_path = None       # tests point this at a temp file


def threat_head(features: dict, baseline: Baseline | None, ctx: dict) -> dict:
    st = ctx.setdefault("threat", {"hist": [], "level": "ok", "last_alert_at": 0.0, "alerts": 0, "last_alert": None})
    if baseline is None:
        return {"level": "none", "kind": None, "reason": "no baseline for this user yet"}
    d = float(baseline.distance(features))
    st["hist"] = (st["hist"] + [d])[-THREAT_PERSIST:]
    sustained = sum(1 for x in st["hist"] if x >= THREAT_ALERT)
    others = ctx.get("heads_so_far") or {}
    idn, state = others.get("identity") or {}, others.get("state") or {}
    mismatch = bool(idn.get("unknown")) or (idn.get("user") is not None and idn.get("matches_declared") is False)
    kind = "intruder" if mismatch else "duress"

    if sustained >= THREAT_PERSIST:
        level = "alert"
    elif d >= THREAT_WARN or sustained > 0 or mismatch:
        level = "warn"
    else:
        level = "ok"

    out = {"level": level, "kind": kind if level != "ok" else None, "distance": round(d, 2),
           "sustained_ticks": sustained, "identity_mismatch": mismatch, "load": state.get("load"),
           "drivers": [[f, round(z, 2)] for f, z in baseline.explain(features, top=2)],
           "alerts_total": st["alerts"], "last_alert": st["last_alert"], "channel": notify.channel()}

    now = time.time()
    entering = level == "alert" and st["level"] != "alert"
    if entering and now - st["last_alert_at"] >= THREAT_COOLDOWN_S:
        alert = {"ts": now, "session": ctx.get("session"), "user": ctx.get("user") or baseline.user, "kind": kind,
                 "distance": round(d, 2), "sustained_ticks": sustained, "identity": idn.get("user"),
                 "identity_confidence": idn.get("confidence"), "load": state.get("load"), "drivers": out["drivers"]}
        res = notify.send(alert, _alert_log_path)
        st["last_alert_at"], st["alerts"] = now, st["alerts"] + 1
        st["last_alert"] = {"ts": now, "kind": kind, **res}
        out["alerts_total"], out["last_alert"] = st["alerts"], st["last_alert"]
    st["level"] = level
    return out


# ---------------------------------------------------------------------------
# State: cognitive load. Supervised model on per-user z-scores (pipeline/state.py),
# rule-based fallback until one is trained, EMA smoothing so the meter moves like
# a gauge, and a plain-language line (Gemini if GEMINI_API_KEY is set, template otherwise).
# Train with:  uv run python -m pipeline.state train data/features.csv
# ---------------------------------------------------------------------------
STATE_MODEL_PATH = ROOT / "data" / "models" / "state.joblib"
STATE_EMA = 0.35              # weight of the newest tick
# Label cut-offs, from the measured rule-score distribution on the team set:
# calm median 0.14, timed-stress median 0.38. A real interrupter pushes higher.
FOCUS_BELOW, LOAD_ABOVE = 0.25, 0.50
# A trained model must beat the fixed rule to be used. Measured leave-one-user-out
# on 4 people: rule 0.79, logistic model 0.66 (it learns the people, not the stress).
MODEL_MIN_AUC = 0.80
_state_cache: dict[str, tuple[float, StateModel]] = {}


def _state_model() -> StateModel | None:
    if not STATE_MODEL_PATH.exists():
        return None
    mtime = STATE_MODEL_PATH.stat().st_mtime
    hit = _state_cache.get("m")
    if hit and hit[0] == mtime:
        return hit[1]
    m = StateModel.load(STATE_MODEL_PATH)
    _state_cache["m"] = (mtime, m)
    return m


def state_head(features: dict, baseline: Baseline | None, ctx: dict) -> dict:
    if baseline is None:
        return {"load": None, "label": "unknown", "advice": "unknown", "reason": "no baseline for this user yet"}
    z = dict(zip(baseline.features, np.clip(baseline.zscores(features), -5, 5)))
    m = _state_model()
    if m is not None and (m.louo_auc or 0.0) >= MODEL_MIN_AUC:
        out = m.predict(z)
        raw, drivers, source = out["load"], out["drivers"], "model"
    else:
        raw, source = rule_load(z), "rule"
        drivers = [[f, round(float(z.get(f, 0.0)), 2)] for f in ("speed_kps", "error_rate", "rp_negative_ratio")]
    st = ctx.setdefault("state", {"ema": None})
    st["ema"] = raw if st["ema"] is None else STATE_EMA * raw + (1 - STATE_EMA) * st["ema"]
    load = float(st["ema"])
    label = "deep focus" if load < FOCUS_BELOW else "engaged" if load < LOAD_ABOVE else "high load"
    advice = "defer" if label == "deep focus" or label == "high load" else "ok"
    user = ctx.get("user") or baseline.user
    return {
        "load": round(load, 2), "raw": round(float(raw), 2), "label": label,
        "advice": advice,                      # what other apps should do with notifications right now
        "drivers": drivers, "source": source,
        "explanation": explain.get(st, user, label, load, drivers),
        "explainer": "gemini" if explain.enabled() else "template",
    }


# Order matters: threat reads identity and state from ctx["heads_so_far"].
register_head("identity", identity_head)
register_head("state", state_head)
register_head("threat", threat_head)
