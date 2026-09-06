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
    uv run python -m backend.sessions score  data/sessions/<file>.jsonl        # open-set score per tick, per baseline
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


def _main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="KeySign session recordings")
    sub = p.add_subparsers(dest="cmd", required=True)
    ls = sub.add_parser("list"); ls.add_argument("--dir", default=str(DEFAULT_DIR))
    ex = sub.add_parser("export"); ex.add_argument("recording"); ex.add_argument("--user", required=True)
    ex.add_argument("-o", "--out", required=True); ex.add_argument("--chunk-s", type=float, default=20.0)
    sc = sub.add_parser("score"); sc.add_argument("recording")
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
            scores = " ".join(f"{float(b.open_set_score(r['features'])):10.2f}" for b in bases)
            print(f"{r.get('ts', 0) % 100000:7.1f} {r.get('n_keys', 0):4d} {str(idn.get('user')):16s} {scores}"
                  + ("  UNKNOWN" if idn.get("unknown") else ""))
        print("thresholds:            " + " ".join(f"{(b.open_set_threshold or 0):10.2f}" for b in bases))
    return 0


if __name__ == "__main__":
    sys.exit(_main())
