"""
Moving a profile between machines. A calibration is ten sentences of somebody's time, so
an import must not quietly overwrite one, and an archive must not be able to write outside
the three directories a profile is made of.
"""
import json
import zipfile

import pytest

from backend import profile_io


@pytest.fixture
def machine(tmp_path, monkeypatch):
    for name in ("SAMPLES_DIR", "BASELINE_DIR", "FACES_DIR"):
        d = tmp_path / "data" / name.split("_")[0].lower()
        d.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(profile_io, "ROOT", tmp_path)
    monkeypatch.setattr(profile_io, "SAMPLES_DIR", tmp_path / "data" / "samples")
    monkeypatch.setattr(profile_io, "BASELINE_DIR", tmp_path / "data" / "baselines")
    monkeypatch.setattr(profile_io, "FACES_DIR", tmp_path / "data" / "faces")
    (tmp_path / "data" / "samples").mkdir(parents=True, exist_ok=True)
    (tmp_path / "data" / "baselines").mkdir(parents=True, exist_ok=True)
    (tmp_path / "data" / "faces").mkdir(parents=True, exist_ok=True)
    return tmp_path


def make_profile(root, user="Test Person", faces=2):
    slug = "test_person"
    (root / "data" / "baselines" / f"{slug}.json").write_text(json.dumps({"user": user, "n_samples": 5}))
    (root / "data" / "samples" / f"enrolled_{slug}.json").write_text(json.dumps([{"user": user}]))
    d = root / "data" / "faces" / slug
    d.mkdir(parents=True, exist_ok=True)
    for i in range(faces):
        (d / f"{i}.jpg").write_bytes(b"\xff\xd8jpeg")
    return slug


def test_round_trip(machine, tmp_path):
    make_profile(machine)
    out = tmp_path / "p.keysign"
    r = profile_io.export_profile("Test Person", out)
    assert r["faces"] == 2 and out.exists()

    # a second machine: same layout, nothing in it
    for sub in ("baselines", "samples", "faces"):
        for p in (machine / "data" / sub).rglob("*"):
            if p.is_file():
                p.unlink()
    got = profile_io.import_profile(out)
    assert got["user"] == "Test Person" and got["faces"] == 2
    assert (machine / "data" / "baselines" / "test_person.json").exists()
    assert (machine / "data" / "faces" / "test_person" / "0.jpg").exists()


def test_faces_can_be_left_behind(machine, tmp_path):
    """They are photographs of a person; sending them anywhere should be a decision."""
    make_profile(machine)
    out = tmp_path / "p.keysign"
    r = profile_io.export_profile("Test Person", out, with_faces=False)
    assert r["faces"] == 0
    assert not any(c.startswith("faces/") for c in r["contents"])


def test_import_will_not_clobber_a_calibration(machine, tmp_path):
    make_profile(machine)
    out = tmp_path / "p.keysign"
    profile_io.export_profile("Test Person", out)
    with pytest.raises(FileExistsError):
        profile_io.import_profile(out)
    assert profile_io.import_profile(out, overwrite=True)["user"] == "Test Person"


def test_exporting_somebody_with_no_baseline_says_so(machine, tmp_path):
    with pytest.raises(FileNotFoundError):
        profile_io.export_profile("Nobody", tmp_path / "p.keysign")


def test_an_archive_cannot_write_outside_a_profile(machine, tmp_path):
    """A profile arrives from another machine, so treat its paths as untrusted."""
    out = tmp_path / "evil.keysign"
    with zipfile.ZipFile(out, "w") as z:
        z.writestr(profile_io.MANIFEST, json.dumps(
            {"format": profile_io.FORMAT, "user": "X", "slug": "x", "contents": [], "faces": 0}))
        z.writestr("baselines/x.json", "{}")
        z.writestr("../../escaped.txt", "no")
        z.writestr("settings.json", "no")
    written = profile_io.import_profile(out)["written"]
    assert written == ["baselines/x.json"]
    assert not (machine.parent / "escaped.txt").exists()
    assert not (machine / "data" / "settings.json").exists()


def test_a_file_that_is_not_a_profile_is_rejected(tmp_path):
    p = tmp_path / "notes.zip"
    with zipfile.ZipFile(p, "w") as z:
        z.writestr("hello.txt", "hi")
    with pytest.raises(ValueError):
        profile_io.read_manifest(p)
