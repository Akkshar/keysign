"""
Run the KeySign backend:  uv run python -m backend  [--port 8000] [--no-reload]

Wraps uvicorn so nobody has to type the reload flags (PowerShell expands
"*/tests/*" into file names if you pass it on the command line).
"""
from __future__ import annotations

import argparse
import logging
import threading

import uvicorn


def warm_faces() -> None:
    """
    Load the face models in the background so the first alert does not pay ~220 ms of
    model loading on top of the webcam's own cold open (backend/faces.warm).
    """
    def go():
        from backend import faces
        logging.getLogger("keysign").info("face engine warm: %s", faces.warm())
    threading.Thread(target=go, daemon=True, name="keysign-face-warm").start()


def main() -> None:
    p = argparse.ArgumentParser(description="KeySign backend")
    p.add_argument("--port", type=int, default=8000)
    p.add_argument("--host", default="127.0.0.1", help="127.0.0.1 keeps it on this machine only")
    p.add_argument("--no-reload", action="store_true", help="don't restart on code changes (use for the demo)")
    a = p.parse_args()
    warm_faces()
    uvicorn.run(
        "backend.app:app", host=a.host, port=a.port,
        reload=not a.no_reload, reload_dirs=["backend", "pipeline"], reload_excludes=["*/tests/*", "*/__pycache__/*"],
        log_level="info",
    )


if __name__ == "__main__":
    main()
