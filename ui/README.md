# ui

The demo dashboard: React + TypeScript + Tailwind + Three.js, designed by the
team, wired to the live KeySign backend. Motion: Framer Motion for view and
gauge transitions, GSAP for the `StrokeText` outline trace, React Bits
Aceternity `ShootingStars`,
`CardSpotlight`, `HoverBorderGradient`, `BackgroundLines` and
`TextGenerateEffect` (all local copies under `src/components/motion`).
Design tokens: `figma-tokens.json`.

    npm install          # once
    npm run dev          # http://localhost:5173 (localhost only, on purpose)

Needs the backend (`uv run python -m backend`). The header pill shows the
connection; the selector next to it is the **declared user**, i.e. whose
baseline the typing is measured against. The Identity head decides who is
really typing from the rhythm alone.

## How the live wiring works

- `src/lib/keysign.ts` — backend client: subscribes to `/ws/dashboard` for
  ticks and streams this window's keystroke timings to `/ws/capture`
  (key names, key codes, timestamps; nothing else, and only to localhost).
- `src/context/BiometricsContext.tsx` — the single source every view reads.
  When a tick arrives, `deriveFromTick()` maps the 28 features, the baseline
  distance and the identity / state / threat heads onto the view model the
  components were built against (`userProfile`, `cognitiveState`,
  `neuromotorGauges`, `liveConfidence`, `liveWpm`, ...). The "judge presets"
  still work when no backend is running; with a backend, a tick overrides
  them and the preset badge follows the real verdict.
- Typing anywhere in the window feeds the 3D typewriter locally AND the
  backend. `Reset` in the header clears the backend's 10-second window.
- A Threat alert opens the duress modal once per alert.

## What is live and what is still illustrative

| View / element | Source |
|---|---|
| Header: connection pill, declared-user selector, Reset, rhythm strip | live (the strip is your last 40 real inter-key intervals) |
| Overview: four-heads strip, stability ring, connection line | live |
| Overview / Health Signals: three screening cards | illustrative; labelled "Research roadmap", never computed from data |
| Live Monitoring: hold, gap, wpm, sigma, per-key table, "what the backend saw", waveform, waterfall | live (`recentPulses` are this window's real timings; ticks from the backend) |
| Live Monitoring: judge presets disclosure | illustrative, disabled while a backend is connected |
| Identity: name, declared vs detected, confidence, probabilities per user, what moved, baseline vs now | live |
| Identity: digraph card | illustrative (labelled) |
| State: load, label, explanation, advice, drivers, load-over-session strip, timeline | live (timeline shows a labelled sketch until the first label change) |
| Threats: level, kind, clocks, top drivers, channel, alert log | live (`/api/alerts`, refreshed every 10 s and on each new alert) |
| Drift | public longitudinal data from `public/drift.json` plus our own days; roadmap |
| Privacy | factual description of the running architecture |
| History | illustrative sketch (labelled) |
| Settings | declared user, reset, theme are real; the rest is read-only and labelled "coming later" |

Design rules and the motion budget are in `DESIGN.md`.

The app lands on Live Monitoring. The Overview's condition cards are a
roadmap; keep the disclaimer with them.

The mapping from live features to the gauge scales is in `deriveFromTick`.
Icons are bundled locally (`material-symbols`) so the demo survives no wifi;
the Google text fonts fall back to system fonts offline.

`dashboard/` (port 5175) is the minimal fallback dashboard with the same feed.
