"""
What this machine has actually seen, from the recordings it already keeps.

Every live session is written to data/sessions/*.jsonl: the key events (redacted to a
coarse class, never the characters) and every tick, with each head's output. That is a
real history and the dashboard was showing a sketch instead, so this summarises the files
into one row per session.

Reading them is cheap (12 MB, about 30 ms for the last forty) but not free, so a summary
is cached against the file's size and modification time and only recomputed when the file
changes. A session still being written is summarised again on the next request.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SESSIONS_DIR = ROOT / "data" / "sessions"

_cache: dict[str, tuple[tuple[int, float], dict]] = {}


def _records(path: Path):
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return
    for line in text.splitlines():
        if not line.strip():
            continue
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(r, str):                       # some rows were written double-encoded
            try:
                r = json.loads(r)
            except json.JSONDecodeError:
                continue
        if isinstance(r, dict):
            yield r


def summarise(path: Path) -> dict:
    """One row for one recording. Counts only; no keystroke content is read or returned."""
    declared = None
    source = "browser"
    keys = ticks = 0
    started = ended = None
    called: dict[str, int] = {}
    levels: dict[str, int] = {}
    alerts: list[dict] = []
    load_sum = load_n = 0.0
    distances: list[float] = []
    prev_level = None

    for r in _records(path):
        t = r.get("type")
        if t == "hello":
            declared = r.get("user") or declared
            source = "agent" if str(r.get("session", "")).startswith("agent-") else source
        elif t == "events":
            keys += sum(1 for e in (r.get("events") or []) if e.get("type") == "down")
        elif t in ("down", "up"):
            keys += t == "down"
        elif t == "tick" and r.get("features"):
            ticks += 1
            ts = r.get("ts")
            if isinstance(ts, (int, float)):
                started = ts if started is None else min(started, ts)
                ended = ts if ended is None else max(ended, ts)
            heads = r.get("heads") or {}
            idn, th, stt = heads.get("identity") or {}, heads.get("threat") or {}, heads.get("state") or {}
            who = idn.get("user")
            if who and not idn.get("warming_up"):
                called[who] = called.get(who, 0) + 1
            lvl = th.get("level")
            if lvl:
                levels[lvl] = levels.get(lvl, 0) + 1
            # One alert, not one per tick: the head stays at "alert" for as long as the
            # condition holds, so count the moment it enters that state.
            if lvl == "alert" and prev_level != "alert":
                alerts.append({"ts": ts, "kind": th.get("kind"), "identity": who,
                               "distance": th.get("distance")})
            prev_level = lvl
            if isinstance(r.get("distance"), (int, float)):
                distances.append(float(r["distance"]))
            if isinstance(stt.get("load"), (int, float)):
                load_sum += float(stt["load"]); load_n += 1

    stat = path.stat()
    name = path.name
    # 2026-09-08_031222_agent-xxxx.jsonl -> the wall-clock the file was opened
    when = name[:17].replace("_", " ")
    if len(when) == 17:
        when = f"{when[:10]} {when[11:13]}:{when[13:15]}:{when[15:17]}"
    return {
        "file": name,
        "when": when,
        "modified": stat.st_mtime,
        "declared": declared,
        "source": "agent" if "agent-" in name else source,
        "keys": keys,
        "ticks": ticks,
        "seconds": round((ended - started), 1) if (started and ended) else None,
        "called": dict(sorted(called.items(), key=lambda kv: -kv[1])),
        "levels": levels,
        "alerts": alerts,
        "mean_distance": round(sum(distances) / len(distances), 2) if distances else None,
        "mean_load": round(load_sum / load_n, 3) if load_n else None,
    }


def _cached(path: Path) -> dict:
    st = path.stat()
    key = path.name
    stamp = (st.st_size, st.st_mtime)
    hit = _cache.get(key)
    if hit and hit[0] == stamp:
        return hit[1]
    row = summarise(path)
    _cache[key] = (stamp, row)
    return row


def recent(n: int = 40, min_ticks: int = 1) -> list[dict]:
    """
    The most recent recordings, newest first. Sessions that never produced a scored tick
    are dropped: a page that opened and closed is not history, it is noise.
    """
    if not SESSIONS_DIR.is_dir():
        return []
    files = sorted(SESSIONS_DIR.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    out = []
    for p in files:
        if len(out) >= n:
            break
        try:
            row = _cached(p)
        except OSError:
            continue
        if row["ticks"] >= min_ticks:
            out.append(row)
    return out


def totals() -> dict:
    """What the machine has seen overall, across every recording on disk."""
    if not SESSIONS_DIR.is_dir():
        return {"sessions": 0, "keys": 0, "ticks": 0, "alerts": 0, "since": None}
    files = sorted(SESSIONS_DIR.glob("*.jsonl"), key=lambda p: p.stat().st_mtime)
    keys = ticks = alerts = scored = 0
    seconds = 0.0
    for p in files:
        try:
            row = _cached(p)
        except OSError:
            continue
        if row["ticks"] < 1:
            continue
        scored += 1
        keys += row["keys"]
        ticks += row["ticks"]
        alerts += len(row["alerts"])
        seconds += row["seconds"] or 0.0
    since = files[0].name[:10].replace("_", "-") if files else None
    return {"sessions": scored, "keys": keys, "ticks": ticks, "alerts": alerts,
            "since": since, "files": len(files),
            # wall-clock across the sessions that produced scored ticks, from their own
            # first and last tick; not ticks x the tick interval, which double counts
            # because the windows overlap
            "minutes": round(seconds / 60, 1)}
