# pipeline

Build-order step 2 and 3: raw events -> feature vector per sample -> personal
baseline per user. Python + NumPy + pandas. Nothing here yet.

Input contract: the JSON exported by `capture/index.html`
(see `docs/data-format.md`). Features to extract are listed in CLAUDE.md.
`analyze.py` at the repo root has a reference `extract_features()` to start from.
