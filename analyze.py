#!/usr/bin/env python3
"""
KeySign validation analysis.

Reads keystrokes.json (from keysign_logger.html) and answers two questions
that decide whether the project is worth building:

  1. Do different people's typing signatures separate?  (Identity head viability)
  2. Does stressed typing differ from calm typing?       (State / Threat viability)

Usage:
    python analyze.py keystrokes.json

Only dependency is scikit-learn (+ numpy). Install if needed:
    pip install scikit-learn numpy
"""

import json
import sys
import statistics as st
from collections import defaultdict


def extract_features(events):
    """Turn one sample's raw keydown/keyup events into a feature vector."""
    downs = {}
    hold_times = []          # keyup - keydown per key
    down_times = []          # timestamps of keydowns, in order
    backspaces = 0
    total_keys = 0

    for e in events:
        k = e["code"]
        if e["type"] == "down":
            downs[k] = e["t"]
            down_times.append(e["t"])
            total_keys += 1
            if e["key"] in ("Backspace", "Delete"):
                backspaces += 1
        elif e["type"] == "up" and k in downs:
            hold_times.append(e["t"] - downs[k])
            del downs[k]

    # inter-key latency: gap between consecutive keydowns
    flights = [down_times[i + 1] - down_times[i] for i in range(len(down_times) - 1)]

    def safe(fn, xs, default=0.0):
        return fn(xs) if len(xs) >= 2 else (xs[0] if xs else default)

    span = (down_times[-1] - down_times[0]) / 1000.0 if len(down_times) >= 2 else 1.0

    return {
        "hold_mean": safe(st.mean, hold_times),
        "hold_std": safe(st.pstdev, hold_times),
        "flight_mean": safe(st.mean, flights),
        "flight_std": safe(st.pstdev, flights),
        "flight_median": safe(st.median, flights),
        "speed_kps": total_keys / span if span > 0 else 0.0,
        "error_rate": backspaces / total_keys if total_keys else 0.0,
    }


FEATURE_ORDER = ["hold_mean", "hold_std", "flight_mean", "flight_std",
                 "flight_median", "speed_kps", "error_rate"]


def to_vector(feat):
    return [feat[k] for k in FEATURE_ORDER]


def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze.py keystrokes.json")
        sys.exit(1)

    with open(sys.argv[1]) as f:
        samples = json.load(f)

    if not samples:
        print("No samples in file.")
        sys.exit(1)

    feats = [(s["user"], s["condition"], extract_features(s["events"])) for s in samples]

    users = sorted(set(u for u, _, _ in feats))
    n_calm = sum(1 for _, c, _ in feats if c == "calm")
    n_stress = sum(1 for _, c, _ in feats if c == "stress")

    print("=" * 60)
    print("KEYSIGN VALIDATION REPORT")
    print("=" * 60)
    print(f"Samples: {len(feats)}  |  Users: {len(users)} ({', '.join(users)})")
    print(f"Calm: {n_calm}  |  Stressed: {n_stress}")
    print()

    # ---- QUESTION 1: do people separate? ----
    print("-" * 60)
    print("Q1. Do people's typing signatures separate? (Identity head)")
    print("-" * 60)
    if len(users) < 2:
        print("  Need >= 2 users. Get all teammates to add samples.")
    elif len(feats) < len(users) * 4:
        print("  Too few samples for a real test. Aim for >= 5 per person.")
    else:
        try:
            import numpy as np
            from sklearn.ensemble import RandomForestClassifier
            from sklearn.model_selection import cross_val_score

            X = np.array([to_vector(f) for _, _, f in feats])
            y = np.array([u for u, _, f in feats])
            clf = RandomForestClassifier(n_estimators=200, random_state=0)
            k = min(5, min(list(defaultdict(int, {u: sum(1 for uu in y if uu == u) for u in users}).values())))
            k = max(2, k)
            scores = cross_val_score(clf, X, y, cv=k)
            acc = scores.mean()
            chance = 1.0 / len(users)
            print(f"  Cross-validated identity accuracy: {acc*100:.1f}%")
            print(f"  Random chance with {len(users)} users: {chance*100:.1f}%")
            if acc > chance * 2 and acc > 0.6:
                print("  VERDICT: Strong separation. Identity head is viable. BUILD IT.")
            elif acc > chance * 1.5:
                print("  VERDICT: Some separation. Workable — collect more data to firm it up.")
            else:
                print("  VERDICT: Weak separation. Lead with State + Threat instead of Identity.")
        except ImportError:
            print("  scikit-learn not installed. Run: pip install scikit-learn numpy")

    print()

    # ---- QUESTION 2: does stress show up? ----
    print("-" * 60)
    print("Q2. Does stressed typing differ from calm? (State / Threat)")
    print("-" * 60)
    if n_calm < 3 or n_stress < 3:
        print("  Need >= 3 calm and >= 3 stressed samples. Collect more.")
    else:
        calm_feats = [f for _, c, f in feats if c == "calm"]
        stress_feats = [f for _, c, f in feats if c == "stress"]
        moved = 0
        for key in FEATURE_ORDER:
            cm = st.mean([f[key] for f in calm_feats])
            sm = st.mean([f[key] for f in stress_feats])
            if cm == 0:
                continue
            delta = (sm - cm) / abs(cm) * 100
            arrow = "up" if delta > 0 else "down"
            flag = "  <-- notable" if abs(delta) > 15 else ""
            if abs(delta) > 15:
                moved += 1
            print(f"  {key:16s} calm={cm:8.1f}  stress={sm:8.1f}  ({arrow} {abs(delta):.0f}%){flag}")
        print()
        if moved >= 2:
            print("  VERDICT: Stress shifts the signal clearly. State + Threat viable. BUILD THEM.")
        elif moved == 1:
            print("  VERDICT: One feature moves. Workable — tune the stressor to be harsher.")
        else:
            print("  VERDICT: Little movement. Make stressed sessions genuinely harder (real timer, real pressure).")

    print()
    print("=" * 60)
    print("If both verdicts say viable: commit to KeySign, open Claude Code.")
    print("If Identity is weak but stress shows: build State + Threat first.")
    print("If neither separates: pick another idea from the shortlist tonight.")
    print("=" * 60)


if __name__ == "__main__":
    main()
