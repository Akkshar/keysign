"""
End-to-end test of the whole KeySign app on this machine.

    uv run python ui/tests/e2e.py                 # starts its own backend on :8000
    uv run python ui/tests/e2e.py --headed        # watch it happen
    uv run python ui/tests/e2e.py --keep          # leave the backend running afterwards

What it drives, in order:

  1. the backend starts and serves the built dashboard;
  2. the face engine and the owner's enrolment are ready;
  3. the sign-in gate renders and "Continue as operator" reaches the dashboard;
  4. the owner's OWN recorded keystrokes, replayed through the browser as real
     key events, are recognised as the owner and raise no alert;
  5. the Threat view shows both clocks, and the alert card is a card at the edge
     of the screen, not a modal: the page underneath stays usable;
  6. Settings shows the face engine, the enrolment and the new tray toggle;
  7. CHAIR SWAP: another teammate's recorded typing, replayed under the owner's
     name, raises an intruder alert; a stored webcam frame of someone else is
     posted as the alert's photo, and the machine keeps the call at "intruder";
  8. DURESS: the owner's own typing sped up (far from calm, high load) raises an
     alert; a stored frame of the OWNER is posted, and the machine turns it into
     a duress alert instead: pushed, no images, no lock.

Everything runs against the real models, the real baselines and the real face
enrolment on this machine. Nothing leaves it: the test refuses to run with a
phone topic configured, and it switches the screen lock off while it runs and
puts the setting back afterwards. The alerts, photos and recordings it creates
are deleted at the end (`--keep-data` keeps them).

Refuses to run while the desktop agent is up: quit it first with
`uv run python -m agent --quit`.

Screenshots land in ui/tests/out/. Exit code 1 on the first failure.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

OUT = Path(__file__).parent / "out"
PAGE = "http://localhost:8000"      # what the browser loads (Firebase authorises "localhost")
BASE = "http://127.0.0.1:8000"      # what this script calls: `localhost` resolves to ::1 first on
                                    # Windows and uvicorn binds 127.0.0.1 only, so every request to
                                    # localhost from Python waits out a 2 s IPv6 connect first
DATA = ROOT / "data"
SESSION_PREFIX = "e2ex"                     # alnum only: photo names strip the rest
SAMPLES = DATA / "samples" / "all_new_page.json"

try:                                   # the Windows console is cp1252; the reports contain sigma
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

failures: list[str] = []
notes: list[str] = []
step_n = 0


# ---------------------------------------------------------------- reporting
def step(title: str) -> None:
    global step_n
    step_n += 1
    print(f"\n=== {step_n}. {title}")


def check(cond: bool, msg: str, detail: str = "") -> bool:
    short = " ".join(str(detail).split())[:180]
    print(("   PASS  " if cond else "   FAIL  ") + msg)
    if short and not cond:
        print("           got: " + short)
    if not cond:
        failures.append(msg + (f"  [got: {short}]" if short else ""))
    return bool(cond)


def note(msg: str) -> None:
    print("   note  " + msg)
    notes.append(msg)


@contextmanager
def guard(what: str):
    """A step that blows up is one failure, not the end of the run."""
    try:
        yield
    except Exception as e:
        check(False, f"{what} ran without errors", f"{type(e).__name__}: {e}")


def die(msg: str) -> None:
    print("\nSTOPPED: " + msg)
    sys.exit(2)


# ---------------------------------------------------------------- http
def get(path: str, timeout: float = 5.0):
    with urllib.request.urlopen(BASE + path, timeout=timeout) as r:
        return json.loads(r.read().decode())


def put(path: str, body: dict, timeout: float = 5.0):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), method="PUT",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def post_jpeg(path: str, data: bytes, timeout: float = 20.0):
    req = urllib.request.Request(BASE + path, data=data, method="POST", headers={"Content-Type": "image/jpeg"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": e.read().decode()[:200], "status": e.code}


def up(timeout: float = 1.0) -> bool:
    try:
        get("/health", timeout=timeout)
        return True
    except Exception:
        return False


# ---------------------------------------------------------------- typing data
def load_samples() -> list[dict]:
    if not SAMPLES.exists():
        die(f"{SAMPLES} is missing; this test replays the team's recorded samples.")
    return json.loads(SAMPLES.read_text(encoding="utf-8"))


def stream_of(samples: list[dict], user: str, condition: str = "calm", n: int = 8) -> list[dict]:
    """One continuous event stream from a person's recorded samples, joined 300 ms apart."""
    out: list[dict] = []
    t = 0.0
    for s in [x for x in samples if x["user"] == user and x["condition"] == condition][:n]:
        ev = sorted(s["events"], key=lambda e: e["t"])
        if not ev:
            continue
        base = ev[0]["t"]
        for e in ev:
            out.append({"type": e["type"], "key": e["key"], "code": e["code"], "t": round(t + e["t"] - base, 3)})
        t = out[-1]["t"] + 300.0
    return out


def sped_up(events: list[dict], factor: float) -> list[dict]:
    return [{**e, "t": round(e["t"] * factor, 3)} for e in events]


# ---------------------------------------------------------------- replay driver
def replay(events: list[dict], user: str, session: str, on_alert=None, batch_ms: float = 2000.0,
           wall_gap: float = 0.55, max_seconds: float = 90.0) -> dict:
    """
    Feed a recorded stream to /ws/capture the way the capture page does, and watch the
    ticks the backend echoes back. `on_alert(alert_ts, tick)` is called the moment an
    alert appears, before returning, so a webcam frame can be posted inside the
    backend's 1.5 s grace window.
    """
    from websockets.sync.client import connect

    ws_url = BASE.replace("http://", "ws://") + "/ws/capture"
    result = {"ticks": 0, "alert": None, "levels": [], "kinds": [], "identity": [], "last_tick": None}
    started = time.time()
    with connect(ws_url, open_timeout=10) as ws:
        ws.send(json.dumps({"type": "hello", "user": user, "session": session}))
        ws.recv(timeout=5)
        i, cursor = 0, events[0]["t"]
        end = events[-1]["t"]
        while cursor <= end and time.time() - started < max_seconds:
            batch = []
            while i < len(events) and events[i]["t"] < cursor + batch_ms:
                batch.append(events[i]); i += 1
            cursor += batch_ms
            if batch:
                ws.send(json.dumps({"type": "events", "events": batch}))
            try:
                msg = json.loads(ws.recv(timeout=1.0))
            except Exception:
                msg = None
            if msg and msg.get("type") == "tick" and msg.get("features"):
                result["ticks"] += 1
                result["last_tick"] = msg
                th = (msg.get("heads") or {}).get("threat") or {}
                idn = (msg.get("heads") or {}).get("identity") or {}
                result["levels"].append(th.get("level"))
                result["kinds"].append(th.get("kind"))
                if idn.get("user"):
                    result["identity"].append(idn["user"])
                la = th.get("last_alert")
                if la and result["alert"] is None:
                    result["alert"] = {**la, "threat": th, "identity": idn}
                    if on_alert:
                        on_alert(la["ts"], msg)
                    break
            time.sleep(wall_gap)
    return result


# ---------------------------------------------------------------- face fixtures
def find_face_frames(owner: str) -> tuple[Path | None, Path | None]:
    """
    Pick two stored webcam frames on this machine: one the face engine calls the owner,
    one it calls somebody else. The test configures itself from what is here rather than
    shipping photos of real people in the repo.
    """
    from backend import faces

    owner_frame = stranger_frame = None
    best_owner, best_stranger = -1.0, 1.0
    for p in sorted((DATA / "alert_photos").glob("*.jpg")):
        if "_screen" in p.name:
            continue
        try:
            v = faces.verify(owner, p.read_bytes())
        except Exception:
            continue
        sim = v.get("similarity")
        if v.get("match") is True and sim is not None and sim > best_owner:
            owner_frame, best_owner = p, sim
        if v.get("match") is False and sim is not None and sim < best_stranger:
            stranger_frame, best_stranger = p, sim
    if owner_frame:
        print(f"   using {owner_frame.name} as the owner's face (similarity {best_owner:.2f})")
    if stranger_frame:
        print(f"   using {stranger_frame.name} as somebody else (similarity {best_stranger:.2f})")
    return owner_frame, stranger_frame


# ---------------------------------------------------------------- browser typing
def type_recorded(page, events: list[dict], max_keys: int = 34) -> int:
    """
    Replay a recorded stream as real key events in the browser, holds and gaps included,
    so the dashboard's own capture sees human timing rather than a robot's.
    """
    seq = [e for e in events if len(e.get("key", "")) == 1 and e["key"].isalpha()]
    keys, sent, prev_t = {}, 0, None
    for e in seq:
        if sent >= max_keys and e["type"] == "down":
            break
        if prev_t is not None:
            time.sleep(max(0.0, min(0.6, (e["t"] - prev_t) / 1000.0)))
        prev_t = e["t"]
        try:
            if e["type"] == "down":
                page.keyboard.down(e["key"]); keys[e["key"]] = True; sent += 1
            elif keys.pop(e["key"], None):
                page.keyboard.up(e["key"])
        except Exception:
            pass
    for k in list(keys):
        try:
            page.keyboard.up(k)
        except Exception:
            pass
    return sent


# ---------------------------------------------------------------- cleanup
def cleanup(sessions: list[str], before: set | None = None) -> None:
    """
    Remove what this run created: its alerts, their photos, and every session recording that
    appeared while it ran. The recordings matter: `pipeline.rebuild` harvests data/sessions for
    training samples, and a browser typing on its own is not a person.
    """
    removed = []
    log = DATA / "alerts.jsonl"
    if log.exists():
        lines = log.read_text(encoding="utf-8").splitlines()
        keep = []
        for line in lines:
            try:
                a = json.loads(line)
            except json.JSONDecodeError:
                keep.append(line); continue
            if str(a.get("session") or "").startswith(SESSION_PREFIX):
                removed.append(f"alert {a.get('kind')} {int(a.get('ts', 0))}")
            else:
                keep.append(line)
        log.write_text("\n".join(keep) + ("\n" if keep else ""), encoding="utf-8")
    for p in (DATA / "alert_photos").glob(f"*_{SESSION_PREFIX}*"):
        p.unlink(); removed.append(p.name)
    for s in sessions:
        for p in (DATA / "sessions").glob(f"*_{s}.jsonl"):
            if p.exists():
                p.unlink(); removed.append(p.name)
    for p in (DATA / "sessions").glob("*.jsonl"):               # the dashboard's own sessions have random ids
        if before is not None and p.name not in before:
            p.unlink(); removed.append(p.name)
    print(f"   removed {len(removed)} test artefact(s): {', '.join(removed[:6])}{' …' if len(removed) > 6 else ''}")


# ---------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser(description="KeySign end-to-end test")
    ap.add_argument("--headed", action="store_true", help="show the browser")
    ap.add_argument("--keep", action="store_true", help="leave the backend running at the end")
    ap.add_argument("--keep-data", action="store_true", help="keep the alerts, photos and recordings the test made")
    ap.add_argument("--user", default=None, help="the declared user (default: the app's declared_user setting)")
    ap.add_argument("--skip-agent", action="store_true", help="do not start the desktop agent at the end")
    a = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    random.seed(7)

    # ---- preflight ----
    step("Preflight")
    if not (ROOT / "ui" / "dist" / "index.html").exists():
        die("the dashboard is not built. Run:  npm --prefix ui run build")
    if os.environ.get("KEYSIGN_NTFY_TOPIC"):
        die("KEYSIGN_NTFY_TOPIC is set in this shell; the test would push to your phone. "
            "Open a shell without it and run again.")
    started_backend = None
    if up():
        agent = get("/api/agent")
        if agent.get("running"):
            die("the KeySign desktop agent is running on port 8000. It hooks the keyboard and can lock "
                "this machine, so the test will not run alongside it. Quit it first:\n"
                "    uv run python -m agent --quit")
        note("a backend is already listening on :8000; the test will use it")
    else:
        env = {**os.environ}
        env.pop("KEYSIGN_NTFY_TOPIC", None)                  # nothing may reach the phone during the test
        env["KEYSIGN_PHOTO_GRACE_S"] = "8"                   # room for the test to post its frame before
                                                             # the machine reaches for its own camera
        log_path = OUT / "backend.log"
        log_file = open(log_path, "w", encoding="utf-8")
        started_backend = subprocess.Popen([sys.executable, "-m", "backend", "--no-reload"], cwd=str(ROOT), env=env,
                                           stdout=log_file, stderr=subprocess.STDOUT, text=True)
        print(f"   backend log: {log_path}")
        for _ in range(120):
            if up():
                break
            time.sleep(0.25)
        check(up(), "the backend starts and answers /health")
        if not up():
            die("the backend did not come up; run `uv run python -m backend` by hand to see why")
        print("   started a backend on :8000")

    health = get("/health")
    check(set(health.get("heads", [])) >= {"identity", "state", "threat"}, "identity, state and threat heads are registered",
          str(health.get("heads")))
    info = get("/api/info")
    if info.get("alerts") != "log-only":
        die("the backend on :8000 has a phone topic configured (KEYSIGN_NTFY_TOPIC), so the test's alerts "
            "would be pushed to your phone. Stop that backend and run again; this test starts its own with "
            "the topic removed. Quit the desktop agent with:  uv run python -m agent --quit")
    check(True, "no phone channel on this backend, so nothing can leave the machine")

    settings_before = get("/api/settings")
    owner = a.user or settings_before.get("declared_user") or ""
    users = get("/api/users")["baselines"]
    check(any(u["user"] == owner for u in users), f"the declared user ({owner!r}) has a baseline",
          str([u["user"] for u in users]))
    if not owner:
        die("no declared user is set. Open the dashboard, pick your profile, and run again.")
    put("/api/settings", {"lock_on_intruder": False})
    print(f"   screen lock switched off for the test (it was {settings_before.get('lock_on_intruder')})")

    sessions_made: list[str] = []
    sessions_before = {p.name for p in (DATA / "sessions").glob("*.jsonl")}
    exit_code = 0
    try:
        # ---- face engine ----
        step("Face engine and enrolment")
        f = get("/api/faces/" + urllib.parse.quote(owner))
        check(f.get("method") == "sface", "the SFace engine is in use (models present in backend/assets)",
              f"method={f.get('method')}; run: uv run python -m backend.faces fetch")
        check(f.get("n_samples", 0) >= 5, f"{owner} has at least 5 enrolled face samples", f"n_samples={f.get('n_samples')}")
        owner_frame, stranger_frame = find_face_frames(owner)
        camera_ready = bool(owner_frame and stranger_frame)
        if not camera_ready:
            note("no stored webcam frames on this machine score as owner AND as somebody else, "
                 "so the camera scenarios are skipped (the alerts themselves still run)")

        samples = load_samples()
        owner_stream = stream_of(samples, owner, "calm", 8)
        check(len(owner_stream) > 200, f"{owner}'s recorded keystrokes are available to replay", f"{len(owner_stream)} events")
        others = [u["user"] for u in users if u["user"] != owner
                  and len([s for s in samples if s["user"] == u["user"] and s["condition"] == "calm"]) >= 4]
        check(bool(others), "another teammate's recorded keystrokes are available for the chair swap", str(others))
        intruder_name = others[0] if others else None

        # ---- browser ----
        from playwright.sync_api import sync_playwright

        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=not a.headed)
            ctx = browser.new_context(viewport={"width": 1500, "height": 950})
            # only the declared user is pre-set: the sign-in gate is part of what is being tested,
            # so operator mode has to be reached by clicking through it
            ctx.add_init_script("try { localStorage.setItem('keysign.ui.user', %s); } catch (e) {}"
                                % json.dumps(owner))
            page = ctx.new_page()
            console_errors: list[str] = []
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

            step("The dashboard the app window shows")
            with guard("the the dashboard the app window shows step"):
                page.goto(PAGE)
                page.wait_for_load_state("networkidle")
                gate = page.get_by_role("button", name="Continue as operator")
                try:
                    gate.wait_for(timeout=15000)                 # Firebase decides who is signed in first
                except Exception:
                    pass
                if gate.count():
                    check(True, "the sign-in gate renders")
                    page.screenshot(path=str(OUT / "e2e-1-gate.png"))
                    gate.click()
                    page.wait_for_timeout(1200)
                else:
                    note("no sign-in gate (Firebase not configured in this build); already on the dashboard")
                check(page.get_by_text("The live lab").count() >= 1, "operator mode reaches the live dashboard")
                page.wait_for_timeout(1500)
                body = page.inner_text("body")
                check("on-device backend" in body, "the header says the backend is live", body[:120])
                page.screenshot(path=str(OUT / "e2e-2-live.png"))

            step("Typing in the window is scored and identified")
            with guard("the typing in the window is scored and identified step"):
                page.mouse.click(750, 500)
                sent = type_recorded(page, owner_stream, max_keys=34)
                page.wait_for_timeout(1500)
                print(f"   replayed {sent} of {owner}'s own keystrokes into the window")
                page.get_by_text("Identity", exact=True).first.click()
                page.wait_for_timeout(1200)
                idn_text = page.inner_text("body")
                check(owner.split()[0] in idn_text, f"the Identity view names {owner}", idn_text[:200])
                check("No backend" not in idn_text, "the Identity view is live, not offline")
                page.screenshot(path=str(OUT / "e2e-3-identity.png"))
                live_tick = get("/health")
                check(live_tick.get("sessions", 0) >= 1, "the backend has a live session from the browser")

            step("The Threat view and the alert card")
            with guard("the the Threat view and the alert card step"):
                page.get_by_text("Threats", exact=True).first.click()
                page.wait_for_timeout(1000)
                threat_text = page.inner_text("body")
                check("Above 3" in threat_text and "under load" in threat_text,
                      "the duress clock says it needs load as well as distance", threat_text[:200])
                check("Identity mismatch" in threat_text, "the intruder clock is shown")
                page.get_by_role("button", name="Preview the alert card").click()
                page.wait_for_timeout(800)
                card = page.locator("#alert-card-title")
                check(card.count() == 1, "the alert card opens")
                box = card.bounding_box() or {"x": 0}
                check(box["x"] > 700, "the card sits at the right-hand edge, not over the page", f"x={box.get('x')}")
                modal = page.locator('[aria-modal="true"]')
                dimmer = page.locator('div.fixed.inset-0[class*="bg-black"]')
                check(modal.count() == 0 and dimmer.count() == 0,
                      "it is a card, not a modal: nothing is dimmed or made modal",
                      f"{modal.count()} modal(s), {dimmer.count()} dimmer(s)")
                # the page underneath still works while the card is open
                page.get_by_text("Settings", exact=True).first.click()
                page.wait_for_timeout(800)
                check("Set on the backend" in page.inner_text("body"), "the page underneath is still clickable while the card is open")
                page.screenshot(path=str(OUT / "e2e-4-card-preview.png"))

            step("Settings")
            with guard("the settings step"):
                s_text = page.inner_text("body")
                check("Camera check on every alert" in s_text, "Settings explains the camera check on every alert")
                check("Tray notification on an alert" in s_text, "the tray-notification setting is there")
                before = get("/api/settings")["toast_on_alert"]
                row = page.get_by_text("Tray notification on an alert", exact=True).locator("xpath=../..")
                toggle = row.get_by_role("button").first
                check(toggle.inner_text().strip() in ("On", "Off"),
                      "the tray toggle shows its state", toggle.inner_text()[:40])
                toggle.click()
                page.wait_for_timeout(900)
                after = get("/api/settings")["toast_on_alert"]
                check(after != before, "the tray toggle writes through to data/settings.json", f"{before} -> {after}")
                put("/api/settings", {"toast_on_alert": before})
                page.screenshot(path=str(OUT / "e2e-5-settings.png"))

            # ---------------------------------------------------------------- alerts
            def run_scenario(title: str, events: list[dict], session: str, frame: Path | None, shot: str) -> dict:
                step(title)
                sessions_made.append(session)
                posted: dict = {}

                def on_alert(ts, tick):
                    if frame is not None:
                        posted.update(post_jpeg(f"/api/alerts/photo?ts={ts}&session={session}", frame.read_bytes()))

                t_alert = time.time()
                r = replay(events, owner, session, on_alert=on_alert)
                print(f"   {r['ticks']} ticks, identity said {sorted(set(r['identity']))[:3]}, "
                      f"levels {r['levels'][-4:]}")
                if frame is not None:
                    print(f"   posted {frame.name}: " + json.dumps({k: posted.get(k) for k in
                          ('ok', 'final_kind', 'sent', 'photo', 'screen', 'error')}))
                check(r["alert"] is not None, "an alert was raised", f"levels={r['levels'][-6:]}")
                if r["alert"] is None:
                    return {}
                # the card polls /api/alerts for the camera's verdict; wait for it to land
                for _ in range(20):
                    page.wait_for_timeout(1000)
                    card = page.locator('[aria-labelledby="alert-card-title"]')
                    if card.count() and "Checking the webcam" not in card.inner_text():
                        break
                print(f"   the card settled {time.time() - t_alert:.1f}s after the alert")
                page.screenshot(path=str(OUT / shot))
                return {"replay": r, "posted": posted}

            # 7. chair swap -> intruder
            if intruder_name:
                other_stream = stream_of(samples, intruder_name, "calm", 8)
                res = run_scenario(f"Chair swap: {intruder_name}'s typing under {owner}'s name",
                                   other_stream, SESSION_PREFIX + "intruder",
                                   stranger_frame if camera_ready else None, "e2e-6-intruder.png")
                if res:
                  with guard("the intruder checks"):
                    r, posted = res["replay"], res["posted"]
                    check(r["alert"]["kind"] == "intruder", "the typing alone calls it an intruder", str(r["alert"]["kind"]))
                    check(intruder_name in r["identity"], f"the identity head named {intruder_name}", str(set(r['identity'])))
                    if camera_ready:
                        check(posted.get("final_kind") == "intruder",
                              "with somebody else's face in the frame the machine keeps it at intruder", json.dumps(posted)[:200])
                        check(posted.get("photo"), "the webcam frame was stored with the alert")
                        check(posted.get("screen"), "the screen snapshot was taken")
                        card = page.locator('[aria-labelledby="alert-card-title"]')
                        card_text = card.inner_text() if card.count() else "(no card on screen)"
                        check("Intruder" in card_text, "the card says Intruder", card_text)
                        check("Not the owner" in card_text, "the card says the camera did not see the owner", card_text)
                    alerts = get("/api/alerts?n=5")["alerts"]
                    mine = [x for x in alerts if str(x.get("session", "")).startswith(SESSION_PREFIX)]
                    check(bool(mine) and mine[-1]["kind"] == "intruder", "the alert log has the intruder row")
                    if camera_ready:
                        face = mine[-1].get("face") or {}
                        check(face.get("final_kind") == "intruder" and face.get("pushed") is True,
                              "the log records the final call and that it was pushed", json.dumps(face)[:200])
                        check(face.get("sent") is False,
                              "and that no phone channel took it (log-only during the test)", json.dumps(face)[:160])

            # 8. duress
            fast = sped_up(owner_stream, 0.5)
            res = run_scenario(f"Duress: {owner}'s own typing at twice the speed, under load",
                               fast, SESSION_PREFIX + "duress",
                               owner_frame if camera_ready else None, "e2e-7-duress.png")
            if res:
              with guard("the duress checks"):
                r, posted = res["replay"], res["posted"]
                th = r["alert"]["threat"]
                check(th.get("duress_ready") is True,
                      "the duress clock was full (6 ticks over 3σ and above this person's load cut-off)",
                      f"stressed_ticks={th.get('stressed_ticks')} load={th.get('load')} cut={th.get('load_above')}")
                if camera_ready:
                    check(posted.get("final_kind") == "duress",
                          "with the owner's face in the frame the machine calls it duress, not an intruder",
                          json.dumps(posted)[:220])
                    check(posted.get("sent") is not True, "no image was pushed for a duress alert", json.dumps(posted)[:160])
                    page.wait_for_timeout(1500)
                    card = page.locator('[aria-labelledby="alert-card-title"]')
                    card_text = card.inner_text() if card.count() else "(no card on screen)"
                    check("Duress" in card_text, "the card says Duress", card_text)
                    check("owner is at the keyboard" in card_text, "the card says the camera saw the owner", card_text)
                    alerts = get("/api/alerts?n=5")["alerts"]
                    mine = [x for x in alerts if str(x.get("session", "")).startswith(SESSION_PREFIX)]
                    face = (mine[-1].get("face") or {}) if mine else {}
                    check(face.get("final_kind") == "duress", "the log records duress as the final call", json.dumps(face)[:200])
                    check("no lock" in (face.get("reason") or "") or "under pressure" in (face.get("reason") or ""),
                          "and says why the machine was not locked", str(face.get("reason"))[:160])

            step("Recordings and console")
            with guard("the recordings and console step"):
                recs = list((DATA / "sessions").glob(f"*_{SESSION_PREFIX}*.jsonl"))
                check(len(recs) >= 1, "each test session was recorded to data/sessions", f"{len(recs)} file(s)")
                benign = ("ERR_CONNECTION_REFUSED", "favicon", "status of 400", "Cross-Origin-Opener-Policy",
                          "Failed to load resource")
                bad = [e for e in console_errors if not any(b in e for b in benign)]
                check(not bad, f"no unexpected console errors ({len(bad)})")
                for e in bad[:5]:
                    print("     console:", e[:200])
            browser.close()

        if not a.skip_agent:
            step("The desktop agent (uv run python -m agent)")
            with guard("the desktop agent step"):
                if started_backend:                              # free the port for the agent's own backend
                    started_backend.terminate()
                    try:
                        started_backend.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        started_backend.kill()
                    started_backend = None
                    for _ in range(40):
                        if not up():
                            break
                        time.sleep(0.25)
                env = {**os.environ}
                env.pop("KEYSIGN_NTFY_TOPIC", None)
                agent_log = OUT / "agent.log"
                with open(agent_log, "w", encoding="utf-8") as fh:
                    agent = subprocess.Popen([sys.executable, "-m", "agent", "--no-window"], cwd=str(ROOT),
                                             env=env, stdout=fh, stderr=subprocess.STDOUT, text=True)
                    print(f"   agent log: {agent_log}")
                    status = {}
                    for _ in range(160):                          # it builds nothing, but pynput + tray take a moment
                        try:
                            status = get("/api/agent", timeout=2)
                            if status.get("running") and status.get("connected"):
                                break
                        except Exception:
                            pass
                        time.sleep(0.25)
                    check(status.get("running") is True, "the agent starts and reports itself to the dashboard", json.dumps(status))
                    check(status.get("connected") is True, "its system-wide keyboard hook is connected to the backend",
                          json.dumps(status))
                    check(status.get("paused") is False, "capture is running, not paused", json.dumps(status))
                    sessions_made.append(str(status.get("session") or "agent-none"))
                    served = urllib.request.urlopen(BASE + "/", timeout=10).read().decode(errors="replace")
                    check('<div id="root"' in served, "the agent serves the built dashboard its window loads")
                    text = agent_log.read_text(encoding="utf-8", errors="replace")
                    check("face engine warm: sface" in text, "it warmed the face models at start-up",
                          " ".join(text.split())[-200:])
                    check("tray icon up" in text or "tray icon failed" in text, "the tray icon was set up",
                          " ".join(text.split())[-200:])
                    if "tray icon failed" in text:
                        note("the tray icon did not appear; the agent still runs (see ui/tests/out/agent.log)")
                    # stop it the way the runbook says
                    r = subprocess.run([sys.executable, "-m", "agent", "--quit"], cwd=str(ROOT), env=env,
                                       capture_output=True, text=True, timeout=30)
                    check(r.returncode == 0, "`python -m agent --quit` stops it", (r.stdout + r.stderr)[:160])
                    try:
                        agent.wait(timeout=20)
                    except subprocess.TimeoutExpired:
                        agent.kill()
                        check(False, "the agent process exited on its own")
                    for _ in range(40):
                        if not up():
                            break
                        time.sleep(0.25)
                    check(not up(), "and its backend is gone with it")

    finally:
        step("Putting the machine back")
        try:
            if not up():                                         # the agent step stopped the backend
                env = {**os.environ}
                env.pop("KEYSIGN_NTFY_TOPIC", None)
                started_backend = subprocess.Popen([sys.executable, "-m", "backend", "--no-reload"], cwd=str(ROOT),
                                                   env=env, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
                for _ in range(80):
                    if up():
                        break
                    time.sleep(0.25)
            restore = {"lock_on_intruder": settings_before.get("lock_on_intruder", True),
                       "toast_on_alert": settings_before.get("toast_on_alert", True),
                       "photo_on_intruder": settings_before.get("photo_on_intruder", True)}
            put("/api/settings", restore)
            print("   settings back to " + json.dumps(restore))
        except Exception as e:
            print("   could not restore settings:", e)
        if started_backend and not a.keep:
            started_backend.terminate()
            try:
                started_backend.wait(timeout=10)
            except subprocess.TimeoutExpired:
                started_backend.kill()
            print("   backend stopped")
        elif started_backend:
            print("   backend left running on :8000 (--keep)")
        if not a.keep_data:                                      # last, so nothing can write while we tidy
            try:
                cleanup(sessions_made, sessions_before)
            except Exception as e:
                print("   cleanup failed:", e)

    print("\n" + "=" * 70)
    if failures:
        print(f"{len(failures)} CHECK(S) FAILED:")
        for f in failures:
            print("  - " + f)
        exit_code = 1
    else:
        print(f"ALL {step_n} STEPS PASSED")
    if notes:
        print("notes:")
        for n in notes:
            print("  - " + n)
    print(f"screenshots: {OUT}")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
