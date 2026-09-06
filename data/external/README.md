# External keystroke datasets

Staged here from Kaggle-style `archive*.zip` downloads. Everything in this
folder except this README is gitignored (raw third-party data, up to 4.5 MB
per set). Re-stage with `uv run python -m pipeline.datasets --stage <zip dir>`
or by hand, as described per dataset.

All three are converted into KeySign samples by `pipeline/datasets.py`, so
they flow through the same `extract_features()` as our own captures.

## stress_logger/  (from archive.zip)

Two users, continuous keyboard + mouse logging over ~1 week (Sept 2021), with a
self-report questionnaire roughly every 30 minutes: fatigue, stress, energy,
pleasantness, PAM mood score. Letter/digit keys are anonymised as `$`; named
keys (space, backspace, enter, modifiers, arrows) are kept. Press and release
timestamps are microsecond ISO strings.

Files kept per user: `keystrokes.tsv`, `usercondition.tsv`, `inactivity.tsv`,
`activewindows.tsv`. The mouse logs (up to 220 MB) were left in the zip.

Use: **State head** (fatigue / stress labels vs. typing features) and the
**Drift** chart (one week of baseline per user). Digraph features are useless
here (keys are masked); hold, flight, release-press, speed, error rate, pauses
and modifier ratio all work.

## cmu_password/  (from archive (1).zip)

`DSL-StrongPasswordData.csv`: the CMU keystroke-dynamics benchmark
(Killourhy & Maxion, 2009). 51 subjects x 8 sessions x 50 repetitions of the
password `.tie5Roanl`, given as per-key hold (H), down-down (DD) and
up-down (UD) times in seconds. The loader reconstructs exact press/release
timestamps from H and DD, so it becomes ordinary raw events.

Use: **Identity head** benchmark at 51 users, and session-to-session drift.

## tie5_raw/  (from archive (2).zip)

Six named subjects (2025) typing the same `.tie5Roanl` password many times,
logged with pynput-style key names and epoch-second press/release times.
Repetitions are delimited by Enter; typos and backspaces are real. The
`*_aggregated.csv` files in the zip were not staged: their UD column is
negative and H is duplicated, i.e. miscomputed. Only `*_keystroke_raw.csv`
is used.

Use: extra Identity subjects on the same task as the CMU set.

## monkeytype/  (from Modeling-Typing-Performance-main.zip)

`Subject_A..V_Results.csv`: 15,003 Monkeytype typing tests by 22 people,
exported from their Monkeytype dashboards (Chaitanya & Gupta, "Modeling
Typing Performance", AI-HCSST 2025, MIT licence, `LICENSE` kept alongside).
Per-test summaries only: wpm, raw wpm, accuracy, consistency, duration, mode,
timestamp. **No keystroke events**, so it never goes through
`extract_features`. Histories span weeks to 3+ years per person.

Use: the **Drift** chart. `monkeytype_weekly.csv` holds per-user weekly
medians of wpm / accuracy / consistency, the closest public analogue to
"is this person's baseline moving over weeks". wpm maps to our `speed_kps`,
accuracy to `1 - error_rate`, consistency to `1 / rhythm_cv`.
