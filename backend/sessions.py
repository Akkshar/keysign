"""
Session recordings. The backend appends every live session to
data/sessions/<date>_<session>.jsonl (raw events, ticks with features and
head outputs). Nothing leaves the machine; the folder is gitignored.
Set KEYSIGN_RECORD=0 to switch recording off.

Why: a demo run IS data. When someone the system misjudges sits down (a
stranger called "Utkarsh", a teammate called unknown), their typing is on
disk afterwards and can be scored or turned into samples without asking
them to record anything.

    uv run python -m backend.sessions list
    uv run python -m backend.sessions export data/sessions/<file>.jsonl --user Stranger -o data/samples/stranger.json
    uv run python -m backend.sessions score  data/sessions/<file>.jsonl        # distance per tick, per baseline
    uv run python -m backend.sessions harvest -o data/samples/live_turns.json  # teammates' own live turns as samples

`harvest` labels each typing turn (events separated by > 6 s pauses) with the
teammate whose calm baseline is clearly nearest on the settled half of the
turn (distance <= 1.4, margin >= 0.4 over the next person) and writes those
turns as calm samples. Live typing runs hotter than enrolment, so training
identity on it raises everyone's live confidence. Unsettled turns (strangers,
nervous typing) are skipped.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DIR = ROOT / "data" / "sessions"


def read(path: Path | str) -> list[dict]:
    with open(path, encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def events_of(records: list[dict]) -> list[dict]:
    """All raw keystroke events in a recording, in order, `reset` boundaries dropped."""
    ev: list[dict] = []
    for r in records:
        if r.get("type") == "events":
            ev.extend(e for e in r.get("events", []) if e.get("type") in ("down", "up"))
    return sorted(ev, key=lambda e: e["t"])


def to_samples(records: list[dict], user: str, chunk_s: float = 20.0, min_keys: int = 30) -> list[dict]:
    """
    Cut a recording into capture-style samples of ~chunk_s seconds of typing so it
    can flow through pipeline.features like an export. Gaps longer than 5 s split.
    """
    ev = events_of(records)
    out: list[dict] = []
    cur: list[dict] = []
    started = ev[0]["t"] if ev else 0.0
    for i, e in enumerate(ev):
        gap = e["t"] - ev[i - 1]["t"] if i else 0.0
        if cur and (gap > 5000 or e["t"] - cur[0]["t"] > chunk_s * 1000):
            if sum(1 for x in cur if x["type"] == "down") >= min_keys:
                out.append(_sample(cur, user, len(out)))
            cur = []
        cur.append(e)
    if cur and sum(1 for x in cur if x["type"] == "down") >= min_keys:
        out.append(_sample(cur, user, len(out)))
    return out


def _sample(events: list[dict], user: str, i: int) -> dict:
    t0 = events[0]["t"]
    return {"id": f"rec_{user.lower()}_{i}", "user": user, "condition": "calm", "prompt": "", "text": "",
            "events": [{**e, "t": e["t"] - t0} for e in events],
            "started_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "duration_ms": events[-1]["t"] - t0, "n_events": len(events),
            "n_keydowns": sum(1 for e in events if e["type"] == "down"),
            "meta": {"page_version": "session-recording"}}


def harvest(paths: list[Path], max_distance: float = 1.4, min_margin: float = 0.4, min_keys: int = 30) -> list[dict]:
    """Confidently-labelled teammate turns from recordings, as capture-style calm samples."""
    from backend.app import list_baselines, load_baseline
    bases = {b["user"]: load_baseline(b["user"]) for b in list_baselines()}
    out: list[dict] = []
    for f in paths:
        recs = read(f)
        evmsgs = [r for r in recs if r.get("type") == "events" and r.get("events")]
        ticks = [r for r in recs if r.get("type") == "tick" and r.get("features")]
        groups: list[list[dict]] = []
        cur: list[dict] = []
        for r in evmsgs:
            if cur and r["ts"] - cur[-1]["ts"] > 6:
                groups.append(cur); cur = []
            cur.append(r)
        if cur:
            groups.append(cur)
        for g in groups:
            t0, t1 = g[0]["ts"], g[-1]["ts"] + 1.0
            tk = [r for r in ticks if t0 <= r["ts"] <= t1 and r["n_keys"] >= 20]
            ev = sorted([e for r in g for e in r["events"] if e.get("type") in ("down", "up")], key=lambda e: e["t"])
            n_keys = sum(1 for e in ev if e["type"] == "down")
            if len(tk) < 3 or n_keys < min_keys:
                continue
            tail = tk[-max(3, len(tk) // 2):]
            import numpy as np
            dmed = {u: float(np.median([b.distance(r["features"]) for r in tail])) for u, b in bases.items() if b is not None}
            if not dmed:
                continue
            order = sorted(dmed, key=dmed.get)
            best = order[0]
            margin = dmed[order[1]] - dmed[order[0]] if len(order) > 1 else float("inf")
            if dmed[best] > max_distance or margin < min_margin:
                continue
            s = _sample(ev, best, len(out))
            s["id"] = f"live_{Path(f).stem}_{int(t0)}"
            s["meta"] = {"page_version": "live-turn", "distance": round(dmed[best], 2), "margin": round(margin, 2)}
            out.append(s)
    return out


def _main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="KeySign session recordings")
    sub = p.add_subparsers(dest="cmd", required=True)
    ls = sub.add_parser("list"); ls.add_argument("--dir", default=str(DEFAULT_DIR))
    ex = sub.add_parser("export"); ex.add_argument("recording"); ex.add_argument("--user", required=True)
    ex.add_argument("-o", "--out", required=True); ex.add_argument("--chunk-s", type=float, default=20.0)
    sc = sub.add_parser("score"); sc.add_argument("recording")
    hv = sub.add_parser("harvest"); hv.add_argument("--dir", default=str(DEFAULT_DIR)); hv.add_argument("-o", "--out", required=True)
    a = p.parse_args(argv)
    if a.cmd == "list":
        for f in sorted(Path(a.dir).glob("*.jsonl")):
            recs = read(f)
            hello = next((r for r in recs if r.get("type") == "hello"), {})
            ticks = [r for r in recs if r.get("type") == "tick"]
            ids = [((r.get("heads") or {}).get("identity") or {}).get("user") for r in ticks]
            called = {u: ids.count(u) for u in set(ids) if u}
            n_keys = sum(1 for e in events_of(recs) if e["type"] == "down")
            print(f"{f.name:40s} declared {hello.get('user', '?'):16s} {n_keys:5d} keys {len(ticks):4d} ticks  called {called}")
    elif a.cmd == "harvest":
        samples = harvest(sorted(Path(a.dir).glob("*.jsonl")))
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(json.dumps(samples), encoding="utf-8")
        counts: dict[str, int] = {}
        for s in samples:
            counts[s["user"]] = counts.get(s["user"], 0) + 1
        print(f"{len(samples)} live turns -> {a.out}  {counts}")
    elif a.cmd == "export":
        samples = to_samples(read(a.recording), a.user, a.chunk_s)
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(json.dumps(samples), encoding="utf-8")
        print(f"{len(samples)} samples for {a.user!r} -> {a.out}  (then: uv run python -m pipeline.features {a.out} --windows -o ...)")
    else:
        from backend.app import list_baselines, load_baseline
        ticks = [r for r in read(a.recording) if r.get("type") == "tick" and r.get("features")]
        bases = [load_baseline(b["user"]) for b in list_baselines()]
        print(f"{'t':>7s} {'keys':>4s} {'voted':16s} " + " ".join(f"{b.user[:10]:>10s}" for b in bases))
        for r in ticks:
            idn = (r.get("heads") or {}).get("identity") or {}
            scores = " ".join(f"{float(b.distance(r['features'])):10.2f}" for b in bases)
            print(f"{r.get('ts', 0) % 100000:7.1f} {r.get('n_keys', 0):4d} {str(idn.get('user')):16s} {scores}"
                  + ("  UNKNOWN" if idn.get("unknown") else ""))
        print("(unknown above %.1f)" % 3.0)
    return 0


if __name__ == "__main__":
    sys.exit(_main())
