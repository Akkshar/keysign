"""
KeySign as an app:  uv run python -m agent

One process, four parts:
  - the backend (uvicorn, 127.0.0.1:8000), which also serves the built dashboard (ui/dist);
  - system-wide keystroke capture (agent/capture.py) feeding it;
  - a tray icon: Open KeySign, Pause/Resume capture, Reset window, Quit;
  - a native window (Windows WebView2 via pywebview) showing the dashboard,
    so nobody sees a browser or an address bar.

Build the dashboard first (once, and after UI changes):  npm --prefix ui run build
Options: --no-window (tray only), --no-capture (backend + window only), --port.
"""
from __future__ import annotations

import argparse
import logging
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
log = logging.getLogger("keysign.agent")


def declared_user() -> str:
    """Who the agent's session is measured against: the app setting, else the first linked
    account, else the first baseline on disk."""
    from backend import actions
    from backend.app import list_baselines
    u = actions.settings().get("declared_user") or ""
    if u:
        return u
    try:
        import json
        accounts = json.loads((ROOT / "data" / "accounts.json").read_text(encoding="utf-8"))
        for entry in accounts.values():
            if entry.get("user"):
                return entry["user"]
    except Exception:
        pass
    b = list_baselines()
    return b[0]["user"] if b else ""


def run_backend(port: int) -> threading.Thread:
    import uvicorn
    from backend.app import app
    cfg = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(cfg)
    t = threading.Thread(target=server.run, daemon=True, name="keysign-backend")
    t.start()
    for _ in range(100):                                    # wait until it answers
        try:
            import urllib.request
            urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=0.5).read()
            break
        except Exception:
            time.sleep(0.1)
    return t


def make_icon(size: int = 64):
    """A simple key-on-indigo tray icon drawn in code, so the app needs no asset files."""
    from PIL import Image, ImageDraw
    im = Image.new("RGBA", (size, size), (79, 70, 229, 255))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((10, 26, 54, 42), radius=4, fill=(255, 255, 255, 255))
    d.ellipse((8, 22, 30, 44), fill=(255, 255, 255, 255))
    d.ellipse((14, 28, 24, 38), fill=(79, 70, 229, 255))
    d.rectangle((44, 42, 48, 50), fill=(255, 255, 255, 255))
    return im


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="KeySign desktop agent")
    p.add_argument("--port", type=int, default=8000)
    p.add_argument("--no-window", action="store_true", help="tray only; open the dashboard from the tray")
    p.add_argument("--no-capture", action="store_true", help="do not hook the keyboard (dashboard typing only)")
    p.add_argument("--browser", action="store_true", help="open the dashboard in the default browser instead of the app window")
    a = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")

    dist = ROOT / "ui" / "dist" / "index.html"
    if not dist.exists():
        print("The dashboard is not built. Run:  npm --prefix ui run build", file=sys.stderr)
        return 1

    run_backend(a.port)
    url = f"http://127.0.0.1:{a.port}/"
    log.info("backend up at %s", url)

    capture = None
    if not a.no_capture:
        from agent.capture import Capture
        capture = Capture(f"ws://127.0.0.1:{a.port}/ws/capture", user=declared_user).start()
        from backend import app as backend_app
        backend_app.AGENT_STATUS = capture.status              # /api/agent reads this
        log.info("keyboard capture on, measured against %r", declared_user())

    # ---- tray ----
    import pystray
    windows: list = []

    def open_dashboard(*_):
        if a.browser:
            webbrowser.open(url); return
        if windows:
            try:
                windows[0].show(); return
            except Exception:
                windows.clear()
        import webview
        w = webview.create_window("KeySign", url, width=1380, height=900, min_size=(1024, 700))
        windows.append(w)

    def toggle_pause(*_):
        if capture:
            capture.paused = not capture.paused
            log.info("capture %s (tray)", "paused" if capture.paused else "resumed")

    def reset_window(*_):
        if capture:
            capture.reset()

    def quit_app(icon, *_):
        if capture:
            capture.stop()
        icon.stop()
        try:
            import webview
            for w in windows:
                w.destroy()
        except Exception:
            pass
        import os
        os._exit(0)

    def pause_label(*_):
        return "Resume capture" if (capture and capture.paused) else "Pause capture"

    menu = pystray.Menu(
        pystray.MenuItem("Open KeySign", open_dashboard, default=True),
        pystray.MenuItem(pause_label, toggle_pause, visible=lambda *_: capture is not None),
        pystray.MenuItem("Start a fresh window", reset_window, visible=lambda *_: capture is not None),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit", quit_app),
    )
    icon = pystray.Icon("KeySign", make_icon(), "KeySign · on-device typing signature", menu)
    icon.run_detached()

    # ---- window (main thread) ----
    if a.no_window or a.browser:
        if a.browser:
            webbrowser.open(url)
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            quit_app(icon)
        return 0

    import webview
    w = webview.create_window("KeySign", url, width=1380, height=900, min_size=(1024, 700))
    windows.append(w)

    def on_closing():
        w.hide()                                            # closing the window keeps the agent in the tray
        return False

    w.events.closing += on_closing
    webview.start(private_mode=False)                       # keeps the sign-in between launches
    return 0


if __name__ == "__main__":
    sys.exit(main())
