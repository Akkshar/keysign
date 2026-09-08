"""
Get a new machine from a fresh clone to a working KeySign.

    uv run python -m agent --setup

data/ is personal and is not in the repository, so a clone arrives with no baselines, no
identity model and no face models. This checks what is missing, fetches what it can, and
prints the one thing to do next rather than leaving somebody to read the source.

It changes nothing that already exists: models are only downloaded when absent, and it
never touches anybody's samples, baselines or settings.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

OK, MISSING, WARN = "  ok  ", "  --  ", "  !   "


def _line(state: str, what: str, detail: str = "") -> None:
    print(f"[{state}] {what}" + (f"  {detail}" if detail else ""))


def _ui_built() -> tuple[bool, str]:
    index = ROOT / "ui" / "dist" / "index.html"
    if not index.exists():
        return False, "run: npm --prefix ui install && npm --prefix ui run build"
    assets = list((ROOT / "ui" / "dist" / "assets").glob("index-*.js"))
    if not assets:
        return False, "dist/index.html exists but no bundle; rebuild"
    return True, f"{len(assets)} bundle(s)"


def _face_models() -> tuple[bool, str]:
    try:
        from backend import faces
    except Exception as e:                                  # OpenCV missing, say so plainly
        return False, f"cannot import backend.faces ({e})"
    present = [p for p in (faces.YUNET, faces.SFACE) if p.exists()]
    if len(present) == 2:
        mb = sum(p.stat().st_size for p in present) / 1e6
        return True, f"{faces.method()}, {mb:.0f} MB in backend/assets"
    return False, "not downloaded"


def _profiles() -> tuple[int, list[str]]:
    try:
        from backend.app import list_baselines
    except Exception:
        return 0, []
    names = [b["user"] for b in list_baselines()]
    return len(names), names


def _enrolled_faces() -> list[str]:
    d = ROOT / "data" / "faces"
    if not d.is_dir():
        return []
    return sorted(p.name for p in d.iterdir() if p.is_dir() and any(p.iterdir()))


def run(fetch: bool = True) -> int:
    print("KeySign setup\n")

    _line(OK if sys.version_info >= (3, 10) else WARN, "python", f"{sys.version.split()[0]}")

    built, detail = _ui_built()
    _line(OK if built else MISSING, "dashboard build", detail)

    have_models, detail = _face_models()
    if not have_models and fetch:
        print("      fetching the face models (39 MB, one time)...")
        try:
            from backend import faces
            faces.fetch_models()
            have_models, detail = _face_models()
        except Exception as e:
            detail = f"download failed: {e}. Retry: uv run python -m backend.faces fetch"
    _line(OK if have_models else MISSING, "face models", detail)

    n, names = _profiles()
    _line(OK if n else MISSING, "profiles on this machine",
          ", ".join(names) if n else "nobody has calibrated yet")

    faces_for = _enrolled_faces()
    _line(OK if faces_for else MISSING, "faces enrolled",
          ", ".join(faces_for) if faces_for else "the camera check needs at least the owner's face")

    identity = ROOT / "data" / "models" / "identity.joblib"
    if identity.exists():
        _line(OK, "identity model", "can tell enrolled people apart")
    elif n >= 2:
        _line(MISSING, "identity model", "run: uv run python -m pipeline.rebuild")
    else:
        _line(WARN, "identity model",
              "needs two people enrolled; with one profile KeySign still measures against "
              "your baseline, it just cannot put another name to the typing")

    print("\nNext:")
    if not built:
        print("  1. npm --prefix ui install && npm --prefix ui run build")
        print("  2. uv run python -m agent")
    elif n == 0:
        print("  1. uv run python -m agent")
        print("  2. the window opens on calibration: ten sentences, about three minutes")
        print("  3. Settings -> add your face, if you want the camera to be a second factor")
    else:
        print("  uv run python -m agent")
        if not faces_for:
            print("  then Settings -> add your face, so an alert can tell you from somebody else")
    return 0 if built else 1


if __name__ == "__main__":                                  # pragma: no cover - manual entry point
    raise SystemExit(run())
