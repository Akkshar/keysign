"""
Snapshot and restore everything a rebuild overwrites, so adding data is an
experiment, not a bet. Baselines, models, samples and feature tables are
gitignored (personal data), so this is the only undo.

    uv run python -m pipeline.snapshot save --label before-utkarsh-samples
    uv run python -m pipeline.snapshot list
    uv run python -m pipeline.snapshot restore 2026-09-07_1130_before-utkarsh-samples
    uv run python -m pipeline.snapshot restore latest

`restore` first saves an automatic snapshot of the current state (label
`pre-restore`), so a restore can itself be undone. The backend re-reads
baselines and models when the files change; no restart needed.

    uv run python -m pipeline.rebuild

runs the whole rebuild sequence (snapshot first) and prints the numbers to
compare against the previous run.
"""
from __future__ import annotations

import argparse
import shutil
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
BACKUP_DIR = DATA / "backups"

# What a rebuild writes. Folders are copied whole; files are matched by glob.
FOLDERS = ["baselines", "models", "faces"]
FILES = ["samples/*.json", "features.csv", "features_windows.csv"]


def _stamp(label: str | None) -> str:
    safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in (label or "")).strip("-")
    return time.strftime("%Y-%m-%d_%H%M") + (f"_{safe}" if safe else "")


def save(label: str | None = None, data: Path | str = DATA, backup_dir: Path | str | None = None) -> Path:
    data = Path(data)
    dest = Path(backup_dir or (data / "backups")) / _stamp(label)
    dest.mkdir(parents=True, exist_ok=False)
    n = 0
    for folder in FOLDERS:
        src = data / folder
        if src.exists():
            shutil.copytree(src, dest / folder)
            n += sum(1 for _ in (dest / folder).rglob("*") if _.is_file())
    for pattern in FILES:
        for src in data.glob(pattern):
            rel = src.relative_to(data)
            (dest / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest / rel)
            n += 1
    (dest / "MANIFEST.txt").write_text(f"saved {time.strftime('%Y-%m-%d %H:%M:%S')}\n{n} files\n", encoding="utf-8")
    return dest


def list_snapshots(data: Path | str = DATA, backup_dir: Path | str | None = None) -> list[Path]:
    d = Path(backup_dir or (Path(data) / "backups"))
    return sorted(p for p in d.iterdir() if p.is_dir()) if d.exists() else []


def restore(name: str, data: Path | str = DATA, backup_dir: Path | str | None = None, keep_current: bool = True) -> Path:
    data = Path(data)
    snaps = list_snapshots(data, backup_dir)
    if not snaps:
        raise FileNotFoundError("no snapshots yet")
    src = snaps[-1] if name == "latest" else next((p for p in snaps if p.name == name), None)
    if src is None:
        raise FileNotFoundError(f"no snapshot named {name!r}; try: {', '.join(p.name for p in snaps[-5:])}")
    if keep_current:
        save("pre-restore", data, backup_dir)
    for folder in FOLDERS:
        if (src / folder).exists():
            if (data / folder).exists():
                shutil.rmtree(data / folder)
            shutil.copytree(src / folder, data / folder)
    for pattern in FILES:
        for cur in data.glob(pattern):                 # drop files the snapshot doesn't have
            if not (src / cur.relative_to(data)).exists():
                cur.unlink()
        for f in src.glob(pattern):
            rel = f.relative_to(src)
            (data / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, data / rel)
    return src


def _main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="KeySign data snapshots")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("save"); s.add_argument("--label", default=None)
    sub.add_parser("list")
    r = sub.add_parser("restore"); r.add_argument("name", help="snapshot folder name, or 'latest'")
    a = p.parse_args(argv)
    if a.cmd == "save":
        dest = save(a.label)
        print(f"saved {dest.relative_to(ROOT)}  ({(dest / 'MANIFEST.txt').read_text().splitlines()[1]})")
    elif a.cmd == "list":
        snaps = list_snapshots()
        if not snaps:
            print("no snapshots yet (uv run python -m pipeline.snapshot save)")
        for q in snaps:
            files = (q / "MANIFEST.txt").read_text().splitlines()[1] if (q / "MANIFEST.txt").exists() else "?"
            print(f"{q.name:40s} {files}")
    else:
        try:
            src = restore(a.name)
        except FileNotFoundError as e:
            print(e, file=sys.stderr); return 1
        print(f"restored {src.name}; the current state was saved first as a 'pre-restore' snapshot")
    return 0


if __name__ == "__main__":
    sys.exit(_main())
