"""
Taking a profile to another machine.

Somebody who calibrates here should be able to run KeySign on their own laptop without
typing the ten sentences again. A profile is small and self-contained:

    samples    data/samples/enrolled_<slug>.json    what they typed, as timings
    baseline   data/baselines/<slug>.json           what the heads measure against
    faces      data/faces/<slug>/*.jpg              the camera's reference, if enrolled

`export_profile` writes those into one .keysign file (a zip), `import_profile` reads one
back. Nothing else travels: no settings, no alert history, no photos of alerts, and
nobody else's data. The manifest records who and when so an import can say what it is
before it writes anything.

The face frames are pictures of a person, so exporting them is opt-in.
"""
from __future__ import annotations

import json
import time
import zipfile
from pathlib import Path

from pipeline.baseline import _slug

ROOT = Path(__file__).resolve().parent.parent
SAMPLES_DIR = ROOT / "data" / "samples"
BASELINE_DIR = ROOT / "data" / "baselines"
FACES_DIR = ROOT / "data" / "faces"

MANIFEST = "keysign-profile.json"
FORMAT = 1


def profile_files(user: str, with_faces: bool = True) -> dict[str, Path]:
    """The files that make up one person's profile, by their name inside the archive."""
    slug = _slug(user)
    out: dict[str, Path] = {}
    baseline = BASELINE_DIR / f"{slug}.json"
    if baseline.exists():
        out[f"baselines/{slug}.json"] = baseline
    for p in sorted(SAMPLES_DIR.glob(f"enrolled_{slug}.json")):
        out[f"samples/{p.name}"] = p
    if with_faces:
        for p in sorted((FACES_DIR / slug).glob("*.jpg")) if (FACES_DIR / slug).is_dir() else []:
            out[f"faces/{slug}/{p.name}"] = p
    return out


def export_profile(user: str, out_path: Path | str, with_faces: bool = True) -> dict:
    files = profile_files(user, with_faces=with_faces)
    if not any(k.startswith("baselines/") for k in files):
        raise FileNotFoundError(f"no baseline for {user!r}: calibrate first")
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    manifest = {
        "format": FORMAT,
        "user": user,
        "slug": _slug(user),
        "exported_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "contents": sorted(files),
        "faces": sum(1 for k in files if k.startswith("faces/")),
    }
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(MANIFEST, json.dumps(manifest, indent=1))
        for name, path in files.items():
            z.write(path, name)
    return {**manifest, "path": str(out_path), "bytes": out_path.stat().st_size}


def read_manifest(archive: Path | str) -> dict:
    """What is in an archive, without writing anything."""
    with zipfile.ZipFile(archive) as z:
        try:
            m = json.loads(z.read(MANIFEST))
        except KeyError:
            raise ValueError("not a KeySign profile: no manifest") from None
    if m.get("format") != FORMAT:
        raise ValueError(f"profile format {m.get('format')}, this build reads {FORMAT}")
    return m


def import_profile(archive: Path | str, overwrite: bool = False) -> dict:
    """
    Write a profile onto this machine. Refuses to overwrite an existing baseline unless
    asked, because a profile is somebody's calibration and clobbering it silently would
    cost them the ten sentences.
    """
    m = read_manifest(archive)
    slug = m["slug"]
    target = BASELINE_DIR / f"{slug}.json"
    if target.exists() and not overwrite:
        raise FileExistsError(f"{m['user']!r} already has a baseline here; pass overwrite=True to replace it")
    written: list[str] = []
    with zipfile.ZipFile(archive) as z:
        for name in z.namelist():
            if name == MANIFEST:
                continue
            # never let an archive write outside the three directories it is allowed
            top = name.split("/", 1)[0]
            if top not in ("baselines", "samples", "faces") or ".." in name:
                continue
            dest = ROOT / "data" / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(z.read(name))
            written.append(name)
    return {"user": m["user"], "slug": slug, "written": sorted(written),
            "faces": sum(1 for w in written if w.startswith("faces/"))}


# ---------------------------------------------------------------- CLI
#   uv run python -m backend.profile_io export "Akshaj Munjal" -o akshaj.keysign
#   uv run python -m backend.profile_io import akshaj.keysign
def _main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="Move a KeySign profile between machines")
    sub = p.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("export")
    e.add_argument("user")
    e.add_argument("-o", "--out", required=True)
    e.add_argument("--no-faces", action="store_true", help="leave the webcam frames out")
    i = sub.add_parser("import")
    i.add_argument("archive")
    i.add_argument("--overwrite", action="store_true")
    s = sub.add_parser("show")
    s.add_argument("archive")
    a = p.parse_args(argv)

    if a.cmd == "export":
        r = export_profile(a.user, a.out, with_faces=not a.no_faces)
        print(f"{r['user']} -> {r['path']}  ({r['bytes'] / 1024:.0f} KB, "
              f"{len(r['contents'])} file(s), {r['faces']} face frame(s))")
        print("On the other machine: uv run python -m backend.profile_io import " + Path(a.out).name)
    elif a.cmd == "show":
        m = read_manifest(a.archive)
        print(f"{m['user']}  exported {m['exported_at']}  {len(m['contents'])} file(s), {m['faces']} face frame(s)")
        for c in m["contents"]:
            print(f"  {c}")
    else:
        r = import_profile(a.archive, overwrite=a.overwrite)
        print(f"{r['user']}: {len(r['written'])} file(s) written, {r['faces']} face frame(s)")
        print("The backend picks the baseline up on its own. Restart the agent if it is running.")
    return 0


if __name__ == "__main__":                                  # pragma: no cover
    raise SystemExit(_main())
