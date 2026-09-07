# backend

Build-order step 4. FastAPI + WebSockets. Keystrokes in, live features and
head outputs out. Localhost only; nothing leaves the machine.

    uv run python -m backend            # http://localhost:8000, auto-reloads on edits
    uv run python -m backend --no-reload   # for the demo itself
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

Three heads are in there: `identity` (RandomForest + open-set rule; classes
named `Stranger ...` are known non-users recorded on the dashboard and are
reported as unknown), `state`
(directional load score, see pipeline/README.md) and `threat` (sustained
deviation, classified as intruder or duress using the other two).

Threat alerts are silent: nothing changes on the typist's page. They are
appended to `data/alerts.jsonl` and, if `KEYSIGN_NTFY_TOPIC` is set, pushed
to a phone through ntfy (install the ntfy app, subscribe to a random topic
name, set the same name in the env). `KEYSIGN_NTFY_SERVER` overrides the
server. An alert needs 3 consecutive ticks above 3 sigma; one push per
minute per session. The push carries kind, user label, distance and time only.

Intruder alerts can carry a webcam frame: with "Photo on intruder alert"
switched on in the dashboard's Settings, the browser posts one JPEG to
`POST /api/alerts/photo?ts=<alert ts>` the moment the alert lands. It is
stored in `data/alert_photos/` (gitignored), listed with the alert in
`/api/alerts` as `photo`, served from `/api/alerts/photo/<name>`, and pushed
to the phone as a second message with the image attached. Duress alerts
never take a photo.

The camera is opened only for that one frame. Before pushing, the backend
checks the face against the owner's enrolled face (`backend/faces.py`:
OpenCV Haar detection + LBPH, enrolled from Settings into `data/faces/<user>/`,
gitignored) and grabs the screen with Pillow (`KEYSIGN_SCREEN_SNAPSHOT=0`
to disable). If the face matches the owner the images stay on disk; if it
does not, or there is no face or no enrolment, the webcam frame and the
screen go to the phone with the alert. `GET/POST/DELETE /api/faces/{user}`
manage the enrolment.

Run it as an app instead: `uv run python -m agent` starts this backend, a
system-wide keystroke hook (pynput), a tray icon and a native window showing
the built dashboard (`npm --prefix ui run build` first). Agent sessions say
`redact: true`, so their recordings keep only key classes, never the key.
On an intruder alert the backend grabs a webcam frame itself if the
dashboard has not posted one within 1.5 s, then locks the workstation
(`data/settings.json`, `lock_on_intruder`; `PUT /api/settings`). See
`agent/__main__.py`.

Every live session is recorded to `data/sessions/<date>_<session>.jsonl`
(raw events plus each tick's features and head outputs; gitignored;
`KEYSIGN_RECORD=0` disables). A demo run is data: when someone is misjudged,
`uv run python -m backend.sessions list` finds their session,
`... score <file>` prints their distance per tick against every
baseline, and `... export <file> --user Stranger -o data/samples/stranger.json`
turns it into capture-style samples for the pipeline.

Baselines are read from `data/baselines/<slug>.json`; build them with
`uv run python -m pipeline.baseline build data/features.csv -o data/baselines`.
Retrain identity on 10 s windows, the shape the backend actually scores:
`uv run python -m pipeline.features <exports...> --windows -o data/features_windows.csv`
then `uv run python -m pipeline.identity train data/features_windows.csv`.
The file is re-read when it changes, no restart needed.
