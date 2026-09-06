# backend

Build-order step 4. FastAPI + WebSockets. Keystrokes in, live features and
head outputs out. Localhost only; nothing leaves the machine.

    uv run uvicorn backend.app:app --port 8000 --reload --reload-dir backend --reload-dir pipeline --reload-exclude "*/tests/*"
    uv run python -m pytest backend/tests -q

Endpoints:

| path              | what                                                        |
|-------------------|-------------------------------------------------------------|
| `WS /ws/capture`  | capture page sends `hello`, then batches of `events`         |
| `WS /ws/dashboard`| dashboard receives one `tick` per session every >= 0.5 s     |
| `GET /health`     | sessions, dashboards, registered heads                       |
| `GET /api/users`  | baselines on disk + feature name lists                       |
| `GET /api/baseline/{user}` | one baseline JSON                                   |
| `GET /api/alerts` | silent alerts the Threat head raised (local log, newest last)  |
| `GET /api/state`  | State head as an API: `advice: defer|ok`, load, label, explanation (latest tick; `?session=` to pick one) |

State explanations: set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`,
default `gemini-2.5-flash`) before starting the backend to get a Gemini
one-liner, fetched in a background thread at most every 20 s per session.
Without a key, or offline, a template sentence is used. Only the label,
load and driver names leave the machine, never keystrokes or text.

A tick = features on the last 10 s of events, the declared user's baseline
distance and z-scores, the top-3 moved features, and every head's output.
Message shapes are documented at the top of `app.py`.

## Adding your head

Open `backend/heads.py`, write

    def identity_head(features, baseline, ctx) -> dict: ...
    register_head("identity", identity_head)

Keep state in `ctx["identity"]`. Your dict shows up in `tick["heads"]["identity"]`
on the dashboard. A head that raises is reported as `{"error": ...}` and the
stream keeps going, so you cannot break someone else's demo.

Three heads are in there: `identity` (RandomForest + open-set rule), `state`
(directional load score, see pipeline/README.md) and `threat` (sustained
deviation, classified as intruder or duress using the other two).

Threat alerts are silent: nothing changes on the typist's page. They are
appended to `data/alerts.jsonl` and, if `KEYSIGN_NTFY_TOPIC` is set, pushed
to a phone through ntfy (install the ntfy app, subscribe to a random topic
name, set the same name in the env). `KEYSIGN_NTFY_SERVER` overrides the
server. An alert needs 3 consecutive ticks above 3 sigma; one push per
minute per session. The push carries kind, user label, distance and time only.

Baselines are read from `data/baselines/<slug>.json`; build them with
`uv run python -m pipeline.baseline build data/features.csv -o data/baselines`.
The file is re-read when it changes, no restart needed.
