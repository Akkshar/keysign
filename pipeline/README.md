# pipeline

Build-order steps 2 and 3: raw events -> feature vector per sample -> personal
baseline per user. Python + NumPy + pandas.

## Setup

The repo has a `pyproject.toml`; `uv` handles Python and deps:

    uv sync                      # creates .venv with numpy/pandas/sklearn/pytest
    uv run python -m pytest -q   # run the tests

Without uv: `pip install -r pipeline/requirements.txt` into any Python 3.11+.

## Step 2: features (`features.py`)  — done

    uv run python -m pipeline.features data/samples/<export>.json -o data/features.csv

- `extract_features(events) -> dict` — one sample's events to a dense vector.
  Names in `FEATURE_NAMES`; append new ones at the end only.
- `samples_to_frame(samples) -> DataFrame` — whole export, one row per sample,
  with `sample_id, user, condition, started_at` in front.
- `sliding_windows(events, window_ms, step_ms)` — for the live stream (step 4).

Feature groups: hold (dwell), flight (down->down, matches `analyze.py`),
release->press (up->down, negative when keys overlap), speed, error rate,
rhythm (coefficient of variation, pauses), modifier usage, and down->down
time for ten common English digraphs. Stuck keys (>1.5 s hold) and
walk-aways (>5 s gap) are dropped from timing stats. Digraphs that don't
occur are filled with the sample's mean flight so vectors stay dense.

Input contract: `docs/data-format.md`.

## Step 3: baseline (`baseline.py`)  — next

Aggregate a user's calm samples into per-feature mean/std (robust: median/MAD),
and score a new vector as a z-distance from that baseline. This is what the
Threat and State heads compare against.
