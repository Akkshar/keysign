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

from backend.app import register_head
from pipeline.baseline import Baseline

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


register_head("threat", threat_head)
register_head("state", state_head)
