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

from pathlib import Path

from backend.app import ROOT, load_baseline, register_head
from pipeline.baseline import Baseline
from pipeline.identity import IdentityModel

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
# Threat (placeholder): plain distance threshold. Owner: replace with the real head.
# ---------------------------------------------------------------------------
THREAT_WARN = 2.0
THREAT_ALERT = 3.0


def threat_head(features: dict, baseline: Baseline | None, ctx: dict) -> dict:
    if baseline is None:
        return {"level": "none", "reason": "no baseline"}
    d = float(baseline.distance(features))
    level = "alert" if d >= THREAT_ALERT else "warn" if d >= THREAT_WARN else "ok"
    return {"level": level, "distance": round(d, 2), "drivers": baseline.explain(features, top=2)}


# ---------------------------------------------------------------------------
# State (placeholder): rule of thumb on the z-scores until the supervised model lands.
# Measured direction of stress on the teammate set: faster, more errors, more
# pauses, more key overlap. Owner: replace with the RandomForest on z-scores.
# ---------------------------------------------------------------------------
def state_head(features: dict, baseline: Baseline | None, ctx: dict) -> dict:
    if baseline is None:
        return {"load": None, "label": "unknown", "reason": "no baseline"}
    z = dict(zip(baseline.features, baseline.zscores(features)))
    load = (0.35 * max(z.get("speed_kps", 0), 0) + 0.25 * max(z.get("error_rate", 0), 0)
            + 0.20 * max(z.get("pause_ratio", 0), 0) + 0.20 * max(z.get("rp_negative_ratio", 0), 0))
    load = max(0.0, min(1.0, load / 3.0))            # 0..1, ~3 sigma on every driver = 1
    label = "deep focus" if load < 0.2 else "engaged" if load < 0.5 else "high load"
    return {"load": round(load, 2), "label": label}


register_head("identity", identity_head)
register_head("threat", threat_head)
register_head("state", state_head)
