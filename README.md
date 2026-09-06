# KeySign

A behavioral vital-signs engine. Reads keystroke timing and answers four
questions from one signal: who is typing, what state they're in, whether
something is wrong right now, and whether the baseline is drifting.

See [CLAUDE.md](CLAUDE.md) for the full brief, architecture, and 48h plan.

## Layout

    capture/     Browser capture page (build-order step 1). Zero deps. serve.js hosts it.
    pipeline/    Python feature extractor + baseline builder (step 2-3).
    backend/     FastAPI + WebSocket stream (step 4).
    dashboard/   React dashboard (step 4).
    data/        Exported samples land in data/samples/ (gitignored).
    docs/        Notes, data format spec.
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

Run the viability check on an export (needs Python 3 + scikit-learn):

    python analyze.py data/samples/keysign_<date>.json

## Data format

See [docs/data-format.md](docs/data-format.md). Short version: an array of
samples, each with `user`, `condition`, `prompt`, `text`, and `events` of
`{type: "down"|"up", key, code, t}` where `t` is a millisecond
`DOMHighResTimeStamp`.
