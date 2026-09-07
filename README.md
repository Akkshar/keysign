# KeySign

A behavioral vital-signs engine. Reads keystroke timing and answers four
questions from one signal: who is typing, what state they're in, whether
something is wrong right now, and whether the baseline is drifting.

See [CLAUDE.md](CLAUDE.md) for the full brief, architecture, and 48h plan.

## Layout

    capture/     Browser capture page (build-order step 1). Zero deps. serve.js hosts it.
    pipeline/    Python feature extractor + baseline builder (step 2-3).
    backend/     FastAPI + WebSocket stream (step 4).
    ui/          The demo dashboard (team design, live-wired). npm --prefix ui run dev
    dashboard/   Minimal fallback dashboard on :5175.
    data/        Exported samples land in data/samples/ (gitignored).
    docs/        Data format spec, demo runbook (docs/demo-runbook.md).
    analyze.py   Pre-hackathon viability check. Reads a capture export, reports
                 whether users separate and whether stress shows up.

## Quick start (capture)

Serve the capture page (any static server works; this one needs only Node)
and open it in Chrome:

    node capture/serve.js
    # -> http://localhost:8080

Then: enter your name, pick calm/stress, press Start, type the prompt, press
Save (or Ctrl+Enter). Repeat 5+ times per person per condition. Export JSON
and drop the file into data/samples/.

## Run it as an app (no browser, no localhost on screen)

    npm --prefix ui run build          # once, and after UI changes
    uv run python -m agent             # backend + system-wide capture + tray + native window

One process: the backend serves the built dashboard at 127.0.0.1:8000, a
tray icon offers Open KeySign / Pause capture / Start a fresh window / Quit,
and a native window (Windows WebView2) shows the dashboard with no address
bar. The keyboard hook scores typing in every application; agent sessions
are recorded with key classes only (letter, digit, space, edit, modifier),
never the key, and capture pauses by itself while a password manager or a
sign-in window is in front. On an intruder alert the backend takes a webcam
frame itself if no dashboard sent one within 1.5 s, runs the face check and
the push, then locks the workstation (Settings, or `data/settings.json`).
Flags: `--no-window` (tray only), `--no-capture`, `--browser`, `--port`.

## Python side (pipeline)

Python deps are managed with [uv](https://docs.astral.sh/uv/); it fetches an
interpreter too, so a bare Windows box works:

    uv sync                                  # one-time, creates .venv
    uv run python -m pytest -q               # pipeline tests
    uv run python -m pipeline.features data/samples/<export>.json -o data/features.csv

Run the viability check on an export:

    uv run python analyze.py data/samples/keysign_<date>.json

## Data format

See [docs/data-format.md](docs/data-format.md). Short version: an array of
samples, each with `user`, `condition`, `prompt`, `text`, and `events` of
`{type: "down"|"up", key, code, t}` where `t` is a millisecond
`DOMHighResTimeStamp`.
