"""Snapshot / restore round trip on a fake data folder."""
from pathlib import Path

from pipeline.snapshot import list_snapshots, restore, save


def make_data(root: Path, tag: str) -> Path:
    d = root / "data"
    (d / "baselines").mkdir(parents=True, exist_ok=True)
    (d / "models").mkdir(exist_ok=True)
    (d / "samples").mkdir(exist_ok=True)
    (d / "baselines" / "ann.json").write_text(f'{{"user": "ann", "v": "{tag}"}}')
    (d / "models" / "identity.joblib").write_bytes(tag.encode())
    (d / "samples" / "all.json").write_text(f'[{{"tag": "{tag}"}}]')
    (d / "features.csv").write_text(f"user,x\nann,{tag}\n")
    (d / "sessions").mkdir(exist_ok=True)                       # recordings are NOT part of a snapshot
    (d / "sessions" / "s.jsonl").write_text("{}")
    return d


def test_save_list_restore(tmp_path):
    d = make_data(tmp_path, "one")
    snap = save("before", d)
    assert snap.parent == d / "backups" and snap.name.endswith("_before")
    assert (snap / "baselines" / "ann.json").exists() and (snap / "features.csv").exists()
    assert not (snap / "sessions").exists()
    assert [p.name for p in list_snapshots(d)] == [snap.name]
    # a rebuild overwrites everything and adds a file
    make_data(tmp_path, "two")
    (d / "features_windows.csv").write_text("new\n")
    assert "two" in (d / "baselines" / "ann.json").read_text()
    src = restore("latest", d)
    assert src == snap
    assert "one" in (d / "baselines" / "ann.json").read_text()
    assert (d / "models" / "identity.joblib").read_bytes() == b"one"
    assert "one" in (d / "features.csv").read_text()
    assert not (d / "features_windows.csv").exists()            # not in the snapshot -> removed
    assert (d / "sessions" / "s.jsonl").exists()                # untouched
    # the state before the restore was kept, so the restore can be undone
    names = [p.name for p in list_snapshots(d)]
    assert len(names) == 2 and names[-1].endswith("_pre-restore")
    restore(names[-1], d, keep_current=False)
    assert "two" in (d / "baselines" / "ann.json").read_text() and (d / "features_windows.csv").exists()


def test_restore_unknown_name(tmp_path):
    d = make_data(tmp_path, "one")
    save(None, d)
    import pytest
    with pytest.raises(FileNotFoundError):
        restore("nope", d)
