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
# Train with:  uv run python -m pipeline.identity train data/features_windows.csv
# ---------------------------------------------------------------------------
MODEL_PATH = ROOT / "data" / "models" / "identity.joblib"
UNKNOWN_CONF = 0.45      # accumulated posterior below this -> unknown (weak rule; a stranger usually
                         # gets a confident wrong label, so the open-set score below does the real work)
UNKNOWN_DIST = 3.0       # fallback open-set threshold for a baseline that `pipeline.identity train`
                         # has not calibrated (then the score is the plain distance)
VOTES = 5                # majority vote over the last N ticks so the label doesn't flicker
POSTERIOR_SPAN = 8       # the confidence shown is the posterior over this many voting ticks
                         # (product of per-tick probabilities), not one tick's tree vote:
                         # measured p10 of the right person's confidence 0.76 -> 0.96
PROB_FLOOR = 0.02        # one wildly wrong tick can't veto the other seven
IDENTITY_MIN_KEYS = 15   # windows thinner than this don't vote (measured: 8-12-key windows are
                         # right only 50-90% of the time, 21+ keys 85-100%)
UNKNOWN_MIN_KEYS = 25    # the open-set score needs a window this big; thin windows sit at 2+ for everyone
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
    n_keys = int(features.get("n_keys", 0))
    st = ctx.setdefault("identity", {"history": [], "logp": [], "unknown_votes": []})
    if n_keys >= IDENTITY_MIN_KEYS:
        st["history"] = (st["history"] + [pred["user"]])[-VOTES:]
        p = np.asarray([pred["probs"][u] for u in m.users], dtype=float)
        st["logp"] = (st["logp"] + [np.log(np.maximum(p, PROB_FLOOR)).tolist()])[-POSTERIOR_SPAN:]
    if not st["history"]:                                   # first ticks of a session: too thin to call
        b0 = load_baseline(pred["user"])
        return {"user": None, "confidence": round(pred["confidence"], 3), "tick_confidence": round(pred["confidence"], 3),
                "distance": round(float(b0.distance(features)), 2) if b0 is not None else None,
                "unknown": False, "matches_declared": None, "probs": pred["probs"], "votes": {},
                "warming_up": True, "reason": f"need {IDENTITY_MIN_KEYS} keys in the window to identify"}
    # who: posterior over the recent voting ticks (product of per-tick probabilities)
    lp = np.sum(np.asarray(st["logp"]), axis=0); lp -= lp.max()
    post = np.exp(lp); post /= post.sum()
    voted = m.users[int(np.argmax(post))]
    confidence = float(post.max())
    votes = {u: st["history"].count(u) for u in set(st["history"])}
    # is it really them: calibrated open-set score against the voted user's baseline, majority-voted
    b = load_baseline(voted)
    d = float(b.distance(features)) if b is not None else None
    score = float(b.open_set_score(features)) if b is not None else None
    thr = (b.open_set_threshold if b is not None else None) or UNKNOWN_DIST
    if n_keys >= UNKNOWN_MIN_KEYS and score is not None:
        st["unknown_votes"] = (st["unknown_votes"] + [score > thr])[-VOTES:]
    uv = st["unknown_votes"]
    unknown = (len(uv) >= 2 and sum(uv) * 2 > len(uv)) or (len(st["logp"]) >= 3 and confidence < UNKNOWN_CONF)
    return {
        "user": voted,
        "confidence": round(confidence, 3),               # accumulated over POSTERIOR_SPAN ticks
        "tick_confidence": round(pred["confidence"], 3),  # this window alone
        "distance": round(d, 2) if d is not None else None,
        "open_set": {"score": round(score, 2) if score is not None else None, "threshold": round(thr, 2),
                     "calibrated": bool(b is not None and b.open_set_threshold is not None),
                     "votes": int(sum(uv)), "of": len(uv)},
        "unknown": bool(unknown),
        "matches_declared": voted == ctx.get("user"),
        "probs": pred["probs"],
        "posterior": {u: round(float(v), 3) for u, v in zip(m.users, post)},
        "votes": votes,
        "warming_up": False,
    }

# ---------------------------------------------------------------------------
# Threat: is something wrong right now? Two evidence paths, different clocks:
#   intruder: identity says someone else / unknown for INTRUDER_PERSIST ticks while the
#             typing sits at least THREAT_WARN from the declared baseline (~3 s);
#   duress:   the right person, but THREAT_PERSIST ticks above THREAT_ALERT (~6 s).
#             A burst of fast typing looks like duress for a few seconds; real duress
#             lasts the whole interaction, so the duress clock is deliberately slow.
# Fires a SILENT alert (backend/notify.py) with a cooldown. Runs after identity and state.
# ---------------------------------------------------------------------------
THREAT_WARN = 2.0            # single-tick distance for "warn"
THREAT_ALERT = 3.0           # distance that must be sustained for a duress "alert"
THREAT_PERSIST = 12          # duress: consecutive ticks (>= 6 s of typing) above THREAT_ALERT
INTRUDER_PERSIST = 6         # intruder: consecutive ticks (>= 3 s) of identity mismatch + distance >= THREAT_WARN
THREAT_MIN_KEYS = 25         # windows thinner than this can't count towards an alert: the first seconds
                             # of any session sit at distance 2-2.5 for everyone (features are noise on
                             # 8-15 keys). Replaying the team's calm samples: the old 8-key / 3-tick rule
                             # false-alarmed on 15% of them; 25 keys + 6 ticks 4%; 25 keys + 12 ticks 1%.
THREAT_COOLDOWN_S = 60.0     # minimum gap between pushes per session
_alert_log_path = None       # tests point this at a temp file


def threat_head(features: dict, baseline: Baseline | None, ctx: dict) -> dict:
    st = ctx.setdefault("threat", {"hist": [], "mismatch_run": 0, "level": "ok", "last_alert_at": 0.0,
                                   "alerts": 0, "last_alert": None})
    if baseline is None:
        return {"level": "none", "kind": None, "reason": "no baseline for this user yet"}
    d = float(baseline.distance(features))
    n_keys = int(features.get("n_keys", 0))
    others = ctx.get("heads_so_far") or {}
    idn, state = others.get("identity") or {}, others.get("state") or {}
    mismatch = bool(idn.get("unknown")) or (idn.get("user") is not None and idn.get("matches_declared") is False)
    if n_keys >= THREAT_MIN_KEYS:
        st["hist"] = (st["hist"] + [d])[-THREAT_PERSIST:]
        st["mismatch_run"] = st.get("mismatch_run", 0) + 1 if (mismatch and d >= THREAT_WARN) else 0
    else:                                     # warm-up: thin windows neither count nor carry over
        st["hist"], st["mismatch_run"] = [], 0
    sustained = sum(1 for x in st["hist"] if x >= THREAT_ALERT)
    kind = "intruder" if mismatch else "duress"

    if sustained >= THREAT_PERSIST or st["mismatch_run"] >= INTRUDER_PERSIST:
        level = "alert"
    elif (d >= THREAT_WARN and n_keys >= THREAT_MIN_KEYS) or sustained > 0 or mismatch:
        level = "warn"                        # a thin window's distance is noise: no warn on it alone
    else:
        level = "ok"

    out = {"level": level, "kind": kind if level != "ok" else None, "distance": round(d, 2),
           "sustained_ticks": sustained, "mismatch_ticks": st["mismatch_run"],
           "identity_mismatch": mismatch, "load": state.get("load"),
           "warming_up": n_keys < THREAT_MIN_KEYS,
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
