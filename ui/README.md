# ui

The demo dashboard: React + TypeScript + Tailwind + Three.js, designed by the
team, wired to the live KeySign backend.

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
| Header pill, user selector, Reset | live |
| Identity: name, samples, dwell / flight stats, confidence gauge | live (`/api/baseline/<user>` for the means) |
| Identity: digraph matrix, audit table | illustrative (mock data) |
| State: load, focus, interruption shield, variance figures | live |
| State: timeline events | live (one entry per label change this session; mock until the first tick) |
| Threats: engine status, level, the four gauges | live (scaled from z-scores) |
| Threats: audit archive | live (`/api/alerts`, refreshed every 10 s and on each new alert) |
| Overview: stability ring | live (sigma-distance from the declared user's baseline) |
| Overview / Health Signals: six condition cards | illustrative; labelled "Research roadmap", never computed from data |
| Drift view | live from `public/drift.json` (Monkeytype weekly series, CMU sessions, our own days) |
| History, Privacy | static copy |

The app lands on Live Monitoring. The Overview's condition cards are a
roadmap; keep the disclaimer with them.

The mapping from live features to the gauge scales is in `deriveFromTick`.
Icons are bundled locally (`material-symbols`) so the demo survives no wifi;
the Google text fonts fall back to system fonts offline.

`dashboard/` (port 5175) is the minimal fallback dashboard with the same feed.
