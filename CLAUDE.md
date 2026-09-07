# KeySign

A behavioral vital-signs engine. It reads a person's keystroke timing and answers
four questions from one signal: who is typing, what state they're in, whether
something is wrong right now, and whether their baseline is drifting over time.

Built for a 48-hour GDG hackathon at VIT Vellore. Team of 4.

---

## The core idea

Everyone's typing carries a measurable signature: rhythm, hold times, error
bursts, pauses. It's unique per person, shifts with fatigue, and spikes under
stress. KeySign captures that signal, builds a personal baseline, and runs four
detection "heads" on it.

The pitch test every feature must pass: **why is this not just a chatbot prompt?**
Answer: continuous sensing, a personal baseline, real-time reaction, and fully
on-device. A chat window can do none of those.

---

## Architecture: one pipeline, four heads

Shared pipeline (built first, by everyone):

    capture keystrokes -> extract features -> build personal baseline -> detect deviation

Four heads consume the same features. Only the question differs:

- **Identity** — who is typing? Classifier per user. Locks screen / flags when an
  unknown user takes over. Also attributes shared-account sessions.
- **State** — cognitive load / fatigue score, exposed as an API so other apps
  could defer notifications during deep focus.
- **Threat** — is the user typing under duress? Anomaly detection against the
  calm baseline. Fires a SILENT alert, not a visible one.
- **Drift** — is the baseline itself moving over weeks? ROADMAP ONLY for the
  hackathon (needs longitudinal data we won't have). Present as a chart + the
  MIT neuroQWERTY research, framed as a screening signal, never a diagnosis.

---

## Tech stack (chosen for 48h shippability, not theoretical best)

- **Capture: browser-first.** A web page captures keydown/keyup events in JS.
  Zero install, works on any laptop, bulletproof for a live demo. Frame it as
  "the KeySign environment." (OS-level pynput capture is a STRETCH GOAL only —
  it trips antivirus and permission prompts that can wreck the demo.)
- **Feature extraction: Python + NumPy + pandas.** The heart of the project.
- **Models: scikit-learn.** SVM / RandomForest for identity, IsolationForest for
  threat, regression/thresholds for state. NO deep learning — not enough data,
  adds failure modes, and classical ML is explainable to judges.
- **Backend: FastAPI** with WebSockets for the real-time stream to the dashboard.
- **Frontend: React** + Recharts (or Chart.js) for live-updating meters and
  timelines. The dashboard IS the demo.
- **Storage: SQLite or flat JSON/CSV.** No real DB — reinforces the on-device
  privacy story.
- **Google tech (GDG event):** Gemini API in the State head's application layer
  (plain-language "you're in deep focus, defer this" explanations). Core
  detection stays classical ML. Firebase/Colab optional.
- **Raspberry Pi 5: optional.** Can host the capture daemon + backend as a
  dedicated "KeySign appliance" to make the privacy story physical. Cut without
  hesitation if it eats time.

---

## Features to extract from keystrokes

- Hold time (dwell): keyup - keydown for each key
- Inter-key latency (flight): time between one keyup and the next keydown
- Digraph timing: time for common two-key sequences
- Error rate: backspace / delete frequency
- Typing speed: keys per second over a window
- Rhythm variance: variance of inter-key intervals

---

## 48-hour plan (revised for 3 reviews)

Status at the start of the clock: steps 1-3 of the build order are DONE and
pushed (capture page, feature extractor, baseline builder, 28 tests, four
public datasets converted). The team starts from a working core, not zero.
Clock started 2026-09-06 ~15:00 IST. R1 is at ~22:00 IST the same day (h7).
R2 and R3 times TBC (assumed ~h30 and the final at ~h48).

- **h0-h1 — data sprint, everyone.** DONE: 91 samples on the new page
  (20/10 for Akkshar, 10/10 Shourya, 10/10 Utkarsh, 7/14 Akshaj) plus the 40
  older ones. `data/samples/all_new_page.json` is the merged, de-duplicated,
  name-normalised file. When more samples land, the one-shot way is
  `uv run python -m pipeline.rebuild --label <why>` (snapshots baselines, models,
  samples and feature tables first, runs every step below, prints the numbers;
  undo with `uv run python -m pipeline.snapshot restore latest`). Step by step:
  `uv run python -m pipeline.features "keystrokes (1).json" data/samples/all_new_page.json -o data/features.csv`
  then `uv run python -m pipeline.baseline build data/features.csv -o data/baselines`,
  then retrain identity on live-shaped windows (NOT on features.csv), including
  the known non-users file:
  `uv run python -m backend.sessions harvest -o data/samples/live_turns.json` (teammates' own
  live turns from recorded sessions; live typing runs hotter than enrolment), then
  `uv run python -m pipeline.features "keystrokes (1).json" data/samples/all_new_page.json data/samples/strangers.json data/samples/live_turns.json --windows -o data/features_windows.csv`
  and `uv run python -m pipeline.identity train data/features_windows.csv`,
  then `uv run python -m pipeline.state calibrate data/features_windows.csv`
  (per-user deep-focus / high-load cut-offs into the baselines; without it
  everyone reads "deep focus" all day).
  Unknown-user bar is 85% classifier confidence (team decision): a stranger is
  never shown as a teammate, at the cost of Utkarsh being shown unknown about
  half the time until he records more calm samples on the demo laptop.
  `data/samples/strangers.json` holds people recorded on the dashboard whose
  typing sits inside a teammate's calm spread (one so far, "Stranger 1", the
  third party who kept being called Utkarsh). The identity head reports any
  class named "Stranger ..." as unknown. Add another with
  `uv run python -m backend.sessions export data/sessions/<file>.jsonl --user "Stranger 2" -o data/samples/stranger2.json`
  and merge into strangers.json. Strangers never go into features.csv, so
  they get no baseline. A person with fewer than 5 samples must not be added as a
  class at all (measured: 2 samples of "Aditya" were recognised 23% of the time
  and stole 8 of Akkshar's windows); park them in `data/samples/pending_<name>.json`
  until there are more.
  Every live session is recorded to `data/sessions/` (see `backend/sessions.py`):
  when the demo misjudges someone, their typing is already on disk to score or
  export, no separate recording needed.
- **h0-h7 — live stream end-to-end.** DONE: backend, dashboard, capture Live
  mode, and all four heads (Identity, State, Threat live; Drift chart).
  Demo script: `docs/demo-runbook.md`.
- **R1 (22:00, h7) — show:** live dashboard reacting to typing, chair swap
  making the distance jump, plus the benchmark slide (identity accuracy on 4
  teammates, 51-user CMU benchmark, four datasets). Message: "the sensing
  works, the heads are next."
- **h12-h28 — one head per person, in parallel.** Each head is a function
  `head(features, baseline, ctx) -> dict` plugged into the backend, plus its
  dashboard panel. Priorities, in order: Identity (open-set: classifier +
  "unknown" when distance to the claimed baseline is high), State
  (supervised model on per-user z-scores, measured AUC 0.82; Gemini writes
  the plain-language explanation), Threat (distance threshold + silent push
  to a phone), Drift (chart only: Monkeytype weekly medians + CMU
  session-to-session, `data/external/monkeytype_weekly.csv`).
- **R2 (~h30) — show:** the full 3-minute demo story with at least Identity
  and State live, Threat if ready. Take the reviewers' objections as the h30-h36
  bug list.
- **h30-h36 — integrate and polish.** One demo storyline, one dashboard, cut
  anything flaky. Pi appliance only if someone is idle. Feature freeze at h36.
- **h36-h48 — rehearse and pitch.** Demo 3x end-to-end, once with wifi off.
  Deck: problem, one-pipeline-four-heads, live demo, benchmarks, privacy
  (on-device, no network calls), drift as the vision.
- **R3 (final) — show:** the demo, then the numbers.

Degrades gracefully: core + Identity + State is already a complete, demoable
story. Threat is the first cut, Drift is a chart no matter what.

Findings that already changed the design (see `pipeline/README.md`):
digraph timings help identity but hurt the baseline distance, so they are
excluded from it; stress has a direction (faster, more errors, more pauses,
more key overlap), so State is supervised on z-scores, not a distance; the
public stress-logger labels do not separate and are used only for drift.

## Team split

- Person 1 — capture + feature pipeline (the shared core everyone depends on)
- Person 2 — FastAPI backend + WebSocket streaming
- Person 3 — React dashboard
- Person 4 — the models, one head at a time

**The blocking dependency:** the feature pipeline. Until it emits clean feature
vectors, no head can be built and the dashboard has nothing to show. Strongest
person on it, done first.

---

## The demo (the whole thing is one 3-minute live story)

1. Teammate A types normally -> dashboard: "A, calm, low load."
2. A does a timed puzzle -> cognitive-load meter climbs. (State)
3. Teammate B takes the chair mid-sentence -> identity flips to unknown, screen
   locks. (Identity)
4. A returns; someone stands over them barking orders on a countdown -> silent
   duress alert lands on a phone. (Threat)
5. Close on the drift head as the long-term vision. (Drift)

---

## Build order (do these in sequence)

1. DONE — Browser capture page (`capture/index.html`, serve with `node capture/serve.js`).
2. DONE — Feature extractor (`pipeline/features.py`, `FEATURE_NAMES`).
3. DONE — Baseline builder (`pipeline/baseline.py`, JSON per user in `data/baselines/`).
4. DONE — Backend + dashboards. `backend/` (WebSocket in, features + baseline
   distance + heads out), `ui/` (the team's dashboard, live-wired, :5173),
   `dashboard/` (minimal fallback, :5175).
5. Heads, one per person, as backend plug-ins: identity -> state -> threat.
   Drift is a chart only.

Run everything with `uv run ...` (Python) and `node ...` (JS). Tests:
`uv run python -m pytest -q`.

As an app: `npm --prefix ui run build` then `uv run python -m agent` (see `agent/`):
backend + pynput keyboard hook for every application + tray + WebView2 window.
Agent sessions are recorded redacted (key classes only); Ctrl/Alt/Win chords
are dropped (not typing). Any alert -> webcam burst -> SFace face check
(`uv run python -m backend.faces fetch` once for the models, 39 MB, gitignored)
-> `backend/actions.decide` (someone else in the chair = intruder: push, and the
lock when the typing agrees; the owner in the chair = duress if the typing said
so, else kept local) -> tray notification + a card at the edge of the dashboard,
never a window over the typing. Duress needs the State head's high-load cut-off
on every one of its 6 ticks (2026-09-07: 4 of 6 duress alerts on recorded
sessions were the owner's ordinary typing; the gate keeps only the one at full
load). `modifier_ratio` is out of the baseline distance (zero spread in
enrolment; one Shift pinned it at the clip). Reviewers asked not to see
localhost: the window has no address bar.

## Working principles

- Keep it simple and explainable. A working scikit-learn model beats a fancy one
  that won't train in time.
- Test each piece before moving to the next.
- On-device only. Keystrokes never leave the machine. Privacy is the architecture.
- Don't build all four heads before the core streams end-to-end.
