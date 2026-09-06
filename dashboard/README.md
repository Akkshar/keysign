# dashboard

Build-order step 4. React + Vite + Recharts. Subscribes to the backend's
`/ws/dashboard` stream and shows, live: baseline distance with its top
drivers, the feature cards with z-scores, a rhythm timeline, and one panel
per head (identity, state, threat). Reconnects on its own.

    npm install          # once
    npm run dev          # http://localhost:5173

Needs the backend running (`uv run python -m backend`) and
the capture page in Live mode (`node capture/serve.js`, tick "Live").
Point it elsewhere with `VITE_KEYSIGN_WS=ws://host:8000/ws/dashboard`.

Layout: `src/useLiveFeed.js` owns the socket and history; `src/App.jsx` is
the panels. Each head's panel reads `tick.heads.<name>`; add a panel next to
your head. Keep it one file until it hurts.
