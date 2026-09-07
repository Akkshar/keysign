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
# (build that CSV from the enrolment exports PLUS data/samples/strangers.json, see CLAUDE.md)
# ---------------------------------------------------------------------------
MODEL_PATH = ROOT / "data" / "models" / "identity.joblib"
UNKNOWN_CONF = 0.85      # classifier confidence below this on most of the last VOTES windows -> unknown.
                         # Team decision (2026-09-07): a stranger must never be shown as a teammate, so
                         # the bar is 85%. Measured cost on held-out live windows with the live turns in
                         # training: Utkarsh is shown unknown ~48% of the time, Akkshar ~28%, Akshaj and
                         # Shourya ~0%. At 0.70 it would be 19% / 9% / 0 / 0 but a stranger called
                         # Shourya at 77% would pass. Fix for Utkarsh: more calm samples on the demo laptop.
UNKNOWN_DIST = 3.0       # distance to the predicted user's baseline above this -> unknown
                         # (measured on 10 s windows with >= 25 keys: own-baseline p90 2.0-2.6,
                         # other people's median 2.9-3.6)
VOTES = 5                # majority vote over the last N ticks so the label doesn't flicker
NON_USER_PREFIX = "stranger"   # classes named "Stranger ..." are known NON-users: people recorded on
                               # the dashboard (backend/sessions.py export) whose typing sits inside a
                               # teammate's calm spread, so the distance rule can't reject them. The
                               # classifier learns them as their own class and the head reports unknown.


def is_non_user(name: str | None) -> bool:
    return bool(name) and name.strip().lower().startswith(NON_USER_PREFIX)
IDENTITY_MIN_KEYS = 20   # windows thinner than this don't vote (measured: 8-12-key windows are
                         # right only 50-90% of the time, 13-20 keys 64% for Akkshar, 21+ keys 85-100%)
UNKNOWN_MIN_KEYS = 25    # the distance rule needs a window this big; thin windows sit at 2+ for everyone
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
    n_keys = int(features.get("n_keys", 0))
    st = ctx.setdefault("identity", {"history": []})
    if n_keys >= IDENTITY_MIN_KEYS:
        st["history"] = (st["history"] + [pred["user"]])[-VOTES:]
        st["low_conf"] = (st.get("low_conf", []) + [pred["confidence"] < UNKNOWN_CONF])[-VOTES:]
    if not st["history"]:                                   # first ticks of a session: too thin to call
        return {"user": None, "confidence": round(pred["confidence"], 3),
                "distance": round(d, 2) if d is not None else None,
                "unknown": False, "matches_declared": None, "probs": pred["probs"], "votes": {},
                "warming_up": True, "reason": f"need {IDENTITY_MIN_KEYS} keys in the window to identify"}
    votes = {u: st["history"].count(u) for u in set(st["history"])}
    voted = max(votes, key=votes.get)
    enrolled = {u: p for u, p in pred["probs"].items() if not is_non_user(u)}
    closest = max(enrolled, key=enrolled.get) if enrolled else None
    lc = st.get("low_conf", [])
    low_conf = len(lc) >= 1 and sum(lc) * 2 > len(lc)            # most of the recent windows under UNKNOWN_CONF
                                                                  # (the first voting window already counts:
                                                                  # a stranger may only type 20 keys)
    unknown = is_non_user(voted) or low_conf or \
              (n_keys >= UNKNOWN_MIN_KEYS and d is not None and d > UNKNOWN_DIST)
    return {
        "user": voted,
        "closest": closest,                      # nearest enrolled teammate (differs from user for a known non-user)
        "confidence": round(pred["confidence"], 3),
        "distance": round(d, 2) if d is not None else None,
        "unknown": bool(unknown),
        "low_confidence": bool(low_conf),
        "matches_declared": voted == ctx.get("user"),
        "probs": pred["probs"],
        "votes": votes,
        "warming_up": False,
    }

# ---------------------------------------------------------------------------
# Threat: is something wrong right now? Sustained deviation from the person's
# baseline, classified with the other heads' outputs (identity mismatch ->
# intruder, right person but abnormal and loaded -> duress). Fires a SILENT
# alert (backend/notify.py) with a cooldown. Runs after identity and state.
# ---------------------------------------------------------------------------
THREAT_WARN = 2.0            # single-tick distance for "warn"
THREAT_ALERT = 3.0           # distance that must be sustained for "alert"
THREAT_PERSIST = 6           # consecutive ticks (>= 3 s of typing) above THREAT_ALERT
INTRUDER_PERSIST = 6         # or: identity disagrees with the declared user for this many consecutive
                             # ticks while EITHER the typing is at least THREAT_WARN off OR the identity
                             # vote is confident (not low_confidence). Akshaj under Akkshar's name sits
                             # at 1.2-1.9 sigma (they type alike) yet identity names him on every window
                             # at 90-100%. Measured on 37 recorded teammate turns: false intruder alerts
                             # on the right person 1/37 with or without the confidence clause; swaps
                             # caught 79/111 -> 96/111 with it. Mismatch alone would be 7/37 false.
THREAT_MIN_KEYS = 25         # windows thinner than this can't count towards an alert: the first seconds
                             # of any session sit at distance 2-2.5 for everyone (features are noise on
                             # 8-15 keys). Replaying the team's calm samples: the old 8-key / 3-tick rule
                             # false-alarmed on 15% of them, this rule on 4%, intruders still 63%.
THREAT_COOLDOWN_S = 60.0     # minimum gap between pushes per session
_alert_log_path = None       # tests point this at a temp file


def threat_head(features: dict, baseline: Baseline | None, ctx: dict) -> dict:
    st = ctx.setdefault("threat", {"hist": [], "level": "ok", "last_alert_at": 0.0, "alerts": 0, "last_alert": None})
    if baseline is None:
        return {"level": "none", "kind": None, "reason": "no baseline for this user yet"}
    d = float(baseline.distance(features))
    n_keys = int(features.get("n_keys", 0))
    others = ctx.get("heads_so_far") or {}
    idn, state = others.get("identity") or {}, others.get("state") or {}
    # Positive evidence of another person: the vote names someone else (a teammate or a Stranger
    # class) or is not confident. "Unknown" by distance alone, with a confident vote for the
    # declared user, is the owner typing far from their calm baseline (composing prose in another
    # app, nervous, tired): that is the duress/state path, silent, never the lock. Measured: the
    # owner writing a chat message through the OS hook sat at 3-4 sigma (flight and pause spread
    # +6-8 sigma) while identity said Akkshar at 90%+, and the old rule locked the machine twice.
    mismatch = (idn.get("user") is not None and idn.get("matches_declared") is False) or bool(idn.get("low_confidence"))
    if n_keys >= THREAT_MIN_KEYS:
        st["hist"] = (st["hist"] + [d])[-THREAT_PERSIST:]
        counts = mismatch and (d >= THREAT_WARN or not idn.get("low_confidence"))
        st["mismatch_run"] = st.get("mismatch_run", 0) + 1 if counts else 0
    else:                                     # warm-up: thin windows neither count nor carry over
        st["hist"], st["mismatch_run"] = [], 0
    sustained = sum(1 for x in st["hist"] if x >= THREAT_ALERT)
    kind = "intruder" if mismatch else "duress"

    if sustained >= THREAT_PERSIST or st.get("mismatch_run", 0) >= INTRUDER_PERSIST:
        level = "alert"
    elif (d >= THREAT_WARN and n_keys >= THREAT_MIN_KEYS) or sustained > 0 or mismatch:
        level = "warn"                        # a thin window's distance is noise: no warn on it alone
    else:
        level = "ok"

    out = {"level": level, "kind": kind if level != "ok" else None, "distance": round(d, 2),
           "sustained_ticks": sustained, "mismatch_ticks": st.get("mismatch_run", 0),
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
        res = notify.send(alert, _alert_log_path, push=(kind != "intruder"))   # intruder: backend/actions pushes after the camera check
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
# Label cut-offs. Per user when `pipeline.state calibrate` has written them into the
# baseline (calm typing scores 0.12-0.23 on the rule, stress 0.18-0.71, and people
# differ a lot); these globals are the fallback, set at the team's calm p30 / p85.
FOCUS_BELOW, LOAD_ABOVE = 0.10, 0.35
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
    cut = baseline.state or {}
    focus_below, load_above = float(cut.get("focus_below", FOCUS_BELOW)), float(cut.get("load_above", LOAD_ABOVE))
    label = "deep focus" if load < focus_below else "engaged" if load < load_above else "high load"
    advice = "defer" if label == "deep focus" or label == "high load" else "ok"
    user = ctx.get("user") or baseline.user
    return {
        "load": round(load, 2), "raw": round(float(raw), 2), "label": label,
        "advice": advice,                      # what other apps should do with notifications right now
        "cutoffs": {"focus_below": round(focus_below, 2), "load_above": round(load_above, 2), "per_user": bool(cut)},
        "drivers": drivers, "source": source,
        "explanation": explain.get(st, user, label, load, drivers),
        "explainer": "gemini" if explain.enabled() else "template",
    }


# Order matters: threat reads identity and state from ctx["heads_so_far"].
register_head("identity", identity_head)
register_head("state", state_head)
register_head("threat", threat_head)
