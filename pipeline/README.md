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

## External datasets (`datasets.py`)  — done

Three public datasets converted into the same sample shape (see
`data/external/README.md` for what each one is):

    uv run python -m pipeline.datasets --stage ~/Downloads   # extract from archive*.zip
    uv run python -m pipeline.datasets                        # -> data/external/<name>_{samples.json,features.csv}

| name            | samples | users | labels                    | use                     |
|-----------------|---------|-------|---------------------------|-------------------------|
| cmu_password    | 20,400  | 51    | user, session 1-8         | Identity benchmark      |
| tie5_raw        | 721     | 6     | user, session             | Identity, extra users   |
| stress_logger   | 74      | 2     | stress/fatigue/energy/PAM | State head, Drift chart |
| monkeytype      | 15,003 tests | 22 | wpm/acc/consistency over months | Drift chart only (no events) |

Our own captures stay the primary data; these are for pretraining, benchmarks
and the pitch ("identity holds at 51 users, not just our four").

## Step 3: baseline (`baseline.py`)  — done

    uv run python -m pipeline.baseline build data/features.csv -o data/baselines   # one JSON per user
    uv run python -m pipeline.baseline score data/baselines/<user>.json data/features.csv

- `build_baseline(df, user)` — per-feature median and MAD (x1.4826) from the
  user's calm rows. Scale is floored so constant features can't explode.
- `Baseline.zscores(x)`, `.distance(x)` (RMS of clipped z, ~1 = typical,
  3+ = clearly off), `.explain(x)` (top moved features, signed).
- `Baseline.save/load` — JSON in `data/baselines/` (gitignored: personal data).
- `score_frame(baseline, df)` — adds `distance` and `z_<feature>` columns.
- `BASELINE_FEATURES` drops length-dependent features (`n_keys`,
  `duration_s`, `pause_count`, `longest_pause_ms`) and the digraph timings
  (too few occurrences per sample to estimate a spread; they hurt the distance).

Baselines need enough calm samples. Measured on the CMU set: with 5 samples a
held-out same-person sample scores 1.3 (should be ~1.0), with 10 it is 1.03,
with 20 it is 0.94. Collect 10 minimum, 20 comfortable, per person.

What the baseline is for, per head (measured on the 4-teammate set):

- **Threat**: `distance()` is the anomaly score. Symmetric: anything unlike
  the calm baseline. Needs the bigger sample counts above to be reliable.
- **State**: distance alone is weak (pooled AUC 0.54) because stress has a
  *direction*: faster, more errors, more pauses, more key overlap. A
  RandomForest on per-user z-scores (`score_frame` z columns), trained across
  users, gets AUC 0.82 leave-one-user-out. Build the State head that way.
- **Identity**: nearest-baseline is a fallback (72% on 4 users); the
  RandomForest on raw features is better (92%). Use the classifier, and use
  distance-to-claimed-baseline only for the "unknown user" decision.
