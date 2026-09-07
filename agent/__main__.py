"""
KeySign as an app:  uv run python -m agent

One process, four parts:
  - the backend (uvicorn, 127.0.0.1:8000), which also serves the built dashboard (ui/dist);
  - system-wide keystroke capture (agent/capture.py) feeding it;
  - a tray icon: Open KeySign, Pause/Resume capture, Reset window, Quit; alerts
    appear as tray notifications in the corner (data/settings.json: toast_on_alert);
  - a native window (Windows WebView2 via pywebview) showing the dashboard,
    so nobody sees a browser or an address bar.

Build the dashboard first (once, and after UI changes):  npm --prefix ui run build
Options: --no-window (tray only), --no-capture (backend + window only), --port.
Stop it: tray -> Quit, Ctrl+C in its console, or  uv run python -m agent --quit
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
    p.add_argument("--quit", action="store_true", help="stop a running agent (asks it over http://localhost:<port>)")
    a = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")

    if a.quit:
        import urllib.request
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{a.port}/api/agent/quit", method="POST")
            print(urllib.request.urlopen(req, timeout=3).read().decode())
            return 0
        except Exception as e:
            print(f"no agent answered on port {a.port}: {e}", file=sys.stderr)
            return 1

    dist = ROOT / "ui" / "dist" / "index.html"
    if not dist.exists():
        print("The dashboard is not built. Run:  npm --prefix ui run build", file=sys.stderr)
        return 1

    from backend.__main__ import warm_faces
    warm_faces()                                            # face models ready before the first alert
    run_backend(a.port)
    # localhost, not 127.0.0.1: Firebase authorises "localhost". The ?v= is this build's
    # timestamp: the window keeps its own HTTP cache between runs, and without a fresh
    # address it can serve a dashboard from an older build (measured 2026-09-07).
    # app=1 says "this is the desktop window" from the first paint. Waiting for pywebview to
    # inject window.pywebview is a race, and losing it sends Google's sign-in down the pop-up
    # path, which pywebview hands to the system browser where it can never come back.
    url = f"http://localhost:{a.port}/?v={int(dist.stat().st_mtime)}&app=1"
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

    def reload_window(*_):
        """Load the dashboard again, e.g. after `npm --prefix ui run build`."""
        for w in list(windows):
            try:
                w.load_url(url)
            except Exception as e:
                log.warning("could not reload the window: %s", e)

    def quit_app(icon=None, *_):
        log.info("KeySign agent stopping")
        if capture:
            capture.stop()
        try:
            icon.stop()
        except Exception:
            pass
        try:
            for w in windows:
                w.destroy()
        except Exception:
            pass
        import os
        os._exit(0)

    # Ctrl+C in the console, POST /api/agent/quit, and `python -m agent --quit` all end here.
    import signal
    from backend import actions as _actions
    _actions.QUIT_HOOK = lambda: quit_app(icon_ref[0] if icon_ref else None)
    icon_ref: list = []
    signal.signal(signal.SIGINT, lambda *_: quit_app(icon_ref[0] if icon_ref else None))

    def pause_label(*_):
        return "Resume capture" if (capture and capture.paused) else "Pause capture"

    menu = pystray.Menu(
        pystray.MenuItem("Open KeySign", open_dashboard, default=True),
        pystray.MenuItem(pause_label, toggle_pause, visible=lambda *_: capture is not None),
        pystray.MenuItem("Start a fresh window", reset_window, visible=lambda *_: capture is not None),
        pystray.MenuItem("Reload the dashboard", reload_window, visible=lambda *_: bool(windows)),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit", quit_app),
    )
    icon = pystray.Icon("KeySign", make_icon(), "KeySign · on-device typing signature", menu)
    icon_ref.append(icon)

    # Alerts reach the owner as a tray notification in the corner (backend/actions.py decides
    # which ones), never as a window in front of what they are typing.
    def toast(title: str, message: str) -> None:
        try:
            icon.notify(message, title)
        except Exception as e:
            log.warning("tray notification failed: %s", e)
    _actions.TOAST_HOOK = toast
    try:
        icon.run_detached()
        log.info("tray icon up. On Windows 11 new icons sit behind the ^ chevron by the clock until you drag them out; "
                 "the menu has Open KeySign / Pause capture / Quit. Stop from a terminal with: uv run python -m agent --quit")
    except Exception as e:
        log.warning("tray icon failed (%s); the app still runs. Stop it with: uv run python -m agent --quit", e)

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
