"""
Nothing in this suite may open the machine's camera or grab its screen.

A tick can raise a real alert, and an alert now reaches for both. The threads that do it
outlive the test that started them, so a per-test monkeypatch is not enough: one of them
came back after its patch was undone, opened the real webcam and held the camera lock long
enough to fail an unrelated test. These stay replaced for the whole session; the originals
are kept for the one test that drives the camera lock with a fake cv2.
"""
from __future__ import annotations

import pytest

from backend import actions, faces

REAL_GRAB_WEBCAM_BURST = actions.grab_webcam_burst
REAL_GRAB_SCREEN = faces.grab_screen


# the one test that drives the camera lock reaches for this, rather than importing this
# module again under a second name (pytest loads conftest outside the package)
actions.real_grab_webcam_burst = REAL_GRAB_WEBCAM_BURST


@pytest.fixture(autouse=True, scope="session")
def no_real_camera_or_screen():
    actions.grab_webcam_burst = lambda *a, **k: []
    faces.grab_screen = lambda *a, **k: None
    yield
    actions.grab_webcam_burst = REAL_GRAB_WEBCAM_BURST
    faces.grab_screen = REAL_GRAB_SCREEN
