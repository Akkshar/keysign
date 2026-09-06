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

## 48-hour plan

- **0-10h — build the core, together.** Capture page, feature extractor,
  baseline builder, live dashboard skeleton. NOBODY splits off until raw data
  streams end-to-end. Integrate on day one.
- **10-36h — one head per person.** Each teammate owns a head end-to-end (model
  + its dashboard panel). Independent by design, so parallel work is safe.
- **36-48h — freeze, rehearse, pitch.** Feature freeze at hour 36. Bugs only.
  Rehearse the demo 3x, once with no wifi.

Degrades gracefully: core + two heads is already a complete, demoable story.
Drift is the planned cut.

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

1. Browser capture page: log keydown/keyup with high-resolution timestamps,
   export to a local file. Minimal. Validate with real data before anything else.
2. Feature extractor: raw events -> feature vector per typing sample.
3. Baseline builder: aggregate a user's samples into a personal baseline.
4. Dashboard skeleton: show live features streaming in.
5. Heads, one at a time: identity -> state -> threat. Drift is a chart only.

## Working principles

- Keep it simple and explainable. A working scikit-learn model beats a fancy one
  that won't train in time.
- Test each piece before moving to the next.
- On-device only. Keystrokes never leave the machine. Privacy is the architecture.
- Don't build all four heads before the core streams end-to-end.
