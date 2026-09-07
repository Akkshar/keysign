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

Threat alerts are silent for the typist: nothing opens in front of the
typing. They are appended to `data/alerts.jsonl` and, if `KEYSIGN_NTFY_TOPIC`
is set, pushed to a phone through ntfy (install the ntfy app, subscribe to a
random topic name, set the same name in the env). `KEYSIGN_NTFY_SERVER`
overrides the server. The push carries kind, user label, distance, load and
time only; one push per minute per session. The dashboard shows a card at
the edge of the screen, and the desktop agent a tray notification in the
corner (`toast_on_alert` in `data/settings.json`).

Two clocks fire an alert (`backend/heads.py`): 6 consecutive ticks over
3 sigma *while the State head says the person is at or above their own
high-load cut-off* is duress (stress has a direction; "far from calm" alone
is the owner writing prose in another app, measured 4 false duress alerts
in one ordinary session before the gate); 6 consecutive ticks of a confident
identity mismatch is an intruder, load or not.

**The camera is the second factor for both kinds.** When an alert fires the
dashboard, if open, posts one JPEG to `POST /api/alerts/photo?ts=<alert ts>`;
otherwise the backend takes a five-frame burst itself 1.5 s later
(`backend/actions.py`). The face is compared with the owner's enrolled face
and the two verdicts are combined (`backend/actions.decide`):

| typing says | camera sees   | final call        | phone push | lock | images pushed |
|-------------|---------------|-------------------|-----------|------|---------------|
| intruder    | someone else  | intruder          | yes       | yes  | frame + screen |
| intruder    | the owner     | kept local        | no        | no   | no |
| intruder    | cannot tell   | intruder          | yes       | yes  | frame if any + screen |
| duress      | someone else  | intruder          | yes       | no   | frame + screen |
| duress      | the owner     | duress (confirmed)| yes       | no   | no |
| duress      | cannot tell   | duress            | yes       | no   | no |

A duress frame never leaves the machine: the person at the keyboard is the
victim. The lock needs the typing's word as well as the camera's: a typist
looking straight down at the keys scores like a stranger to the face model,
so the camera alone never locks the owner out. Frames, screen snapshots and
verdicts live in `data/alert_photos/`
(gitignored), listed with each alert in `/api/alerts`, served from
`/api/alerts/photo/<name>`. `KEYSIGN_SCREEN_SNAPSHOT=0` disables the screen
snapshot.

Face engine (`backend/faces.py`): YuNet detection + SFace embeddings from
OpenCV's model zoo, cosine similarity against the owner's enrolled
embeddings; >= 0.40 is the owner, < 0.25 somebody else, in between the
camera abstains and the typing decides. Measured on this machine's stored
alert frames: the owner scored 0.42-0.79, every other person 0.14-0.26.
The models (39 MB) are not in git: `uv run python -m backend.faces fetch`
downloads them into `backend/assets/`; without them the old Haar + LBPH
check runs instead (it accepted a stranger at distance 67 and rejected the
owner at 76, so fetch the models). Enrol from Settings, or from the app's own
camera with `POST /api/faces/{user}/grab`; include looking down at the keys.
`uv run python -m backend.faces check "<user>" <frames...>` scores frames by
hand. `GET/POST/DELETE /api/faces/{user}` manage the enrolment.

Run it as an app instead: `uv run python -m agent` starts this backend, a
system-wide keystroke hook (pynput), a tray icon and a native window showing
the built dashboard (`npm --prefix ui run build` first). Agent sessions say
`redact: true`, so their recordings keep only key classes, never the key;
shortcut chords (Ctrl/Alt/Win + key) are not typing and are dropped before
they reach the stream. A confirmed intruder locks the workstation
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
