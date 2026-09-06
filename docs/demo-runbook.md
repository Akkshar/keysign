# KeySign demo runbook

One laptop, one phone, three teammates at the table, three minutes.
Print this or keep it open on a phone. Everything runs on the laptop; the
only thing that leaves it is the silent alert to the phone.

## Cast

| Role | Who | Why |
|------|-----|-----|
| Typist A (owner of the session) | Akkshar | 25-sample baseline, cleanest identity (96-99%) |
| Typist B (takes the chair) | Shourya | furthest from A's baseline (4σ), strongest stress signal |
| The interrupter | Utkarsh or Akshaj | stands behind A, counts down, talks over them |
| Narrator | whoever is not typing | reads the beats below |

Phone: the one with the ntfy app subscribed to the topic. Volume on.

## Start-up (5 minutes before, three terminals, all in the project folder)

    cd "C:\Users\akksh\OneDrive\Desktop\C2C"

Terminal 1, capture page:

    node capture/serve.js

Terminal 2, backend (no auto-reload during the demo):

    uv run python -m backend --no-reload

Terminal 3, dashboard (the team UI):

    npm --prefix ui run dev

Open two Chrome windows side by side, or one on the projector and one on
the laptop screen:

- http://localhost:5173 — the dashboard (team UI). This goes on the projector.
  Fallback: `npm --prefix dashboard run dev` gives the minimal dashboard on http://localhost:5175.
- http://localhost:8080 — the capture page. This stays on the laptop.

On the capture page: User = `Akkshar Ranjan`, tick **Live**. The status
should read `streaming · session …`. On the dashboard, the header pill should
read **Live · on-device backend** and the user selector should show
`Akkshar Ranjan · 25 samples`. Typing directly into the dashboard also
streams to the backend, so either window can be the typing surface.

## Pre-flight checklist (2 minutes)

- [ ] http://localhost:8000/ shows `"alerts": "ntfy"` (topic picked up). If it
      says `log-only`, the env var isn't set in that terminal: close it, open a
      new one, start the backend again.
- [ ] http://localhost:8000/api/alerts shows `"channel":"ntfy"` (the team UI has no channel tag; the lite dashboard does).
- [ ] A types one sentence: distance settles near 1σ, Identity shows
      Akkshar Ranjan, State shows deep focus / engaged.
- [ ] Phone test: `curl -d "KeySign check" https://ntfy.sh/<topic>` buzzes.
- [ ] Replay file loaded on the capture page (Replay row → choose
      `data/samples/all_new_page.json`). This is the fallback.
- [ ] Wifi off test done once earlier: everything but the phone push still works.
- [ ] Laptop on power, notifications muted, screen lock off.

## The three minutes

**0:00 — Hook (narrator, 20 s).** "Everyone's typing has a rhythm as
personal as a signature. KeySign listens to that rhythm, builds a private
baseline, and answers four questions from one signal: who is typing, what
state they're in, whether something is wrong right now, and whether their
baseline is drifting. Nothing leaves this laptop."

**0:20 — Beat 1, calm (A types, 30 s).** A types the prompt on the capture
page at a normal pace. Point at the dashboard:

- Identity view: `Akkshar Ranjan`, confidence 90%+, "~1σ from Akkshar Ranjan's calm baseline".
- State view: cognitive load low, focus high, interruption shield on.
- Threats view: ALL CLEAR, Level 0.

Say: "This is Akkshar's normal. One sigma means: exactly like the 25 calm
samples he recorded. The system already knows it's him." (Keep the Identity
view up for beats 1 and 3, State view for beat 2, Threats view when the alert
lands; the sidebar switches instantly.)

**0:50 — Beat 2, load (interrupter + A, 40 s).** Interrupter stands
behind A, starts a loud 20-second countdown and talks over them; A keeps
typing as fast as possible. Watch State climb toward high load and the
drivers change to `speed_kps +`, `error_rate +`, `rp_negative_ratio +`.

Say: "Same person, different state. Faster, sloppier, keys overlapping.
Other apps can ask `/api/state` and get one word back: defer. This is what
'do not disturb' should have been."

If the State meter stays under 50: A is too calm. Interrupter gets louder,
A types with both hands faster than comfortable. It lifts within 5 seconds.

**1:30 — Beat 3, chair swap (B, 30 s).** Mid-sentence, B slides in and
keeps typing the same prompt. Don't touch the user field. Within about
two seconds:

- Identity flips to `Shourya` (or UNKNOWN USER if B is stressed), 3-4σ.
- Threats view: Level 1 Caution at once, then **DURESS DETECTED** after
  three seconds of sustained deviation (six ticks; the first seconds of any
  session never count, so B must keep typing);
  the duress modal pops on the dashboard (dismiss it, it's the operator's view).
- The phone buzzes: "KeySign: possible intruder". Hold it up.

Say: "The declared user is still Akkshar. The keyboard says otherwise. The
alert is silent on the screen: the person at the keyboard sees nothing.
That's the duress case too, when it IS you, typing under pressure."

**2:00 — Beat 4, drift (narrator, 30 s).** The real drift chart lives on the
lite dashboard: have http://localhost:5175 open in a second tab (start it with
`npm --prefix dashboard run dev`), scroll to the Drift panel, pick `mt_U`. The
team UI's Drift view is illustrative only.

Say: "Fourth question: is the baseline moving over months? We don't have
years of our own data yet, so this is public data: 22 people, 15,000
typing tests. This one drifted three sigma over two years. On the CMU
benchmark, an identity model trained on early sessions loses a third of
its accuracy on later ones. Baselines move. That's the roadmap: a
screening signal, never a diagnosis."

**2:30 — Close (30 s).** Back to the top of the dashboard.

Say: "One pipeline, four heads. Identity 98% on our team. State and Threat
running live, alert on a phone. Drift as the vision. Every keystroke stayed
on this laptop. Questions."

## Numbers slide (say them, don't read them)

| Claim | Number |
|-------|--------|
| Identity, cross-validated, 4 people, 131 samples | 97.7% (chance 25%) |
| Own-baseline distance vs other-person distance | 0.8-1.6σ vs 1.8-4.1σ |
| Stress detection, own baseline, best person | AUC 0.97 |
| Public benchmark scale | CMU 51 people, 20,400 samples |
| Longitudinal data behind Drift | 22 people, 15,003 tests, up to 3 years |
| Datasets converted into one format | 4 public + ours |
| Timing resolution | 0.1 ms |
| Tests | 60 |

## If something breaks

| Symptom | Fix |
|---------|-----|
| Dashboard pill says "No backend on :8000" | Terminal 2 died. Restart `uv run python -m backend --no-reload`; the dashboard reconnects on its own. |
| Capture page status "disconnected" | Untick and re-tick **Live**. |
| Nothing moves when typing | Cursor isn't in the textarea, or Live is off. Click into the box. |
| Identity says UNKNOWN for A | A is typing far from calm (nervous). Take a breath, type one slow sentence; it settles in 5 s. Or say "and that's the open-set rule working" and move on. |
| Threat never reaches ALERT | Needs 6 consecutive ticks over 3σ (~3 s) with 25+ keys in the 10 s window. B keeps typing; do not press reset. |
| Phone silent | Wifi. Say "the alert is in the local log" and open http://localhost:8000/api/alerts. |
| Anything else | Replay. Capture page → Replay row → pick a sample → Replay. It streams a real recording at its original pace: `Shourya · stress` for the chair swap, `Akkshar Ranjan · calm` to reset. |

## Reset between rehearsals

Click **Reset** on the capture page's Live row (clears the backend window),
wait one minute before expecting another phone push (cooldown), and put
the user field back to `Akkshar Ranjan`.

## Do not

- Don't type in the User field during the demo; the swap works because it stays on Akkshar.
- Don't paste the topic name on a slide.
- Don't let anyone "just try it" on the demo laptop between rehearsal and stage: every stray sample changes nothing, but a stray Clear-all on the capture page deletes the localStorage session (the JSON files are safe).
