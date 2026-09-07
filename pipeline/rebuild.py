"""
The whole rebuild in one command, snapshot first:

    uv run python -m pipeline.rebuild                       # default inputs, see INPUTS
    uv run python -m pipeline.rebuild --label utkarsh-10    # names the snapshot
    uv run python -m pipeline.rebuild --input more.json     # extra capture exports

Steps, in order (each is the command from CLAUDE.md):
  1. snapshot        pipeline.snapshot save
  2. features        exports -> data/features.csv (whole samples, for baselines)
  3. baselines       data/features.csv -> data/baselines/*.json (calm samples only)
  4. harvest         recorded sessions -> data/samples/live_turns.json
  5. windows         exports + strangers + live turns -> data/features_windows.csv
  6. identity        train on the windows (prints held-out accuracy)
  7. state           per-user deep-focus / high-load cut-offs into the baselines

Compare the printed numbers with the previous run. If they moved the wrong
way: uv run python -m pipeline.snapshot restore latest
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUTS = ["keystrokes (1).json", "data/samples/all_new_page.json"]
STRANGERS = "data/samples/strangers.json"
LIVE_TURNS = "data/samples/live_turns.json"


def run(step: str, args: list[str]) -> None:
    print(f"\n== {step}: {' '.join(args)}")
    r = subprocess.run([sys.executable, "-m", *args], cwd=ROOT)
    if r.returncode != 0:
        print(f"{step} failed (exit {r.returncode}); the snapshot from step 1 is intact", file=sys.stderr)
        sys.exit(r.returncode)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="KeySign: snapshot, then rebuild features, baselines, identity and state")
    p.add_argument("--input", action="append", default=[], help="extra capture export(s) to include")
    p.add_argument("--label", default="pre-rebuild")
    p.add_argument("--no-harvest", action="store_true", help="skip harvesting live turns from data/sessions")
    a = p.parse_args(argv)
    inputs = [i for i in INPUTS + a.input if (ROOT / i).exists()]
    if not inputs:
        print("no capture exports found", file=sys.stderr); return 1
    run("1 snapshot", ["pipeline.snapshot", "save", "--label", a.label])
    run("2 features", ["pipeline.features", *inputs, "-o", "data/features.csv"])
    run("3 baselines", ["pipeline.baseline", "build", "data/features.csv", "-o", "data/baselines"])
    if not a.no_harvest:
        run("4 harvest", ["backend.sessions", "harvest", "-o", LIVE_TURNS])
    extra = [f for f in (STRANGERS, LIVE_TURNS) if (ROOT / f).exists()]
    run("5 windows", ["pipeline.features", *inputs, *extra, "--windows", "-o", "data/features_windows.csv"])
    run("6 identity", ["pipeline.identity", "train", "data/features_windows.csv"])
    run("7 state", ["pipeline.state", "calibrate", "data/features_windows.csv"])
    print("\ndone. The backend picks up the new files on its own. Undo: uv run python -m pipeline.snapshot restore latest")
    return 0


if __name__ == "__main__":
    sys.exit(main())
