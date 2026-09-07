"""
Owner face check for intruder alerts, and the screen snapshot.

When an intruder alert fires the dashboard opens the webcam for one frame
and posts it. This module decides whether that face is the enrolled owner
of the session (the declared user):

    enrol(user, jpeg)  -> crops the largest face, stores it under data/faces/<user>/
    verify(user, jpeg) -> {"face": bool, "match": bool | None, "distance": float | None, "threshold": float}

Detection is OpenCV's Haar cascade; recognition is LBPH (local binary
pattern histograms) trained on the owner's enrolled crops. It is a rough
check, good enough to tell the owner from a stranger under the same
lighting; a distance below THRESHOLD is a match. With no enrolled face the
answer is "unknown" (match None) and the photo goes with the alert.

The screen snapshot uses Pillow's ImageGrab on the machine the backend
runs on, which is the machine the keyboard is attached to. Set
KEYSIGN_SCREEN_SNAPSHOT=0 to switch it off.
"""
from __future__ import annotations

import io
import logging
import os
import time
from pathlib import Path

import numpy as np

log = logging.getLogger("keysign.faces")

ROOT = Path(__file__).resolve().parent.parent
FACE_DIR = ROOT / "data" / "faces"
CROP = 160                      # enrolled crops are CROP x CROP grayscale
THRESHOLD = 70.0                # fallback only. Measured: the owner's own crops score 26-34 against each
                                # other, a different person at the same desk 67-69, so 70 let intruders
                                # through. The per-user threshold is 1.6 x the owner's own p90 leave-one-out
                                # distance, clamped to THRESHOLD_RANGE (Akkshar: ~53).
THRESHOLD_RANGE = (40.0, 60.0)
THRESHOLD_FACTOR = 1.6
MAX_SAMPLES = 20

_cascade = None
_models: dict[str, tuple[float, object, int, float]] = {}      # user -> (dir mtime, recognizer, n, threshold)


def _slug(s: str) -> str:
    return "".join(c.lower() if c.isalnum() else "_" for c in s).strip("_")


def user_dir(user: str) -> Path:
    return FACE_DIR / _slug(user)


def _cv2():
    import cv2  # imported lazily: the backend must start even if OpenCV is missing
    return cv2


CASCADE = ROOT / "backend" / "assets" / "haarcascade_frontalface_default.xml"   # bundled: OpenCV 5 wheels ship none


def _detector():
    global _cascade
    if _cascade is None:
        cv2 = _cv2()
        path = CASCADE if CASCADE.exists() else Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
        c = cv2.CascadeClassifier(str(path))
        if c.empty():
            raise RuntimeError(f"face cascade not found at {path}")
        _cascade = c
    return _cascade


def _gray(jpeg: bytes):
    cv2 = _cv2()
    arr = np.frombuffer(jpeg, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("not an image")
    return img


MIN_FACE_FRACTION = 0.24        # a face smaller than this share of the frame height is a bystander, not the
                                # typist (measured: the owner at the keyboard is 30-46% of a 480 px frame, a
                                # person two desks back 22%; that person was once scored instead of the owner)


def largest_face(gray, min_fraction: float = MIN_FACE_FRACTION):
    """(x, y, w, h) of the largest frontal face that is big enough to be at the keyboard, or None."""
    cv2 = _cv2()
    h_frame = gray.shape[0]
    faces = _detector().detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(60, 60))
    if len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    if h < min_fraction * h_frame:
        return None
    return int(x), int(y), int(w), int(h)


def _crop(gray, box):
    cv2 = _cv2()
    x, y, w, h = box
    face = gray[y:y + h, x:x + w]
    face = cv2.resize(face, (CROP, CROP))
    return cv2.equalizeHist(face)


def n_samples(user: str) -> int:
    d = user_dir(user)
    return len(list(d.glob("*.png"))) if d.exists() else 0


def enrol(user: str, jpeg: bytes) -> dict:
    """Store the largest face in this frame as an enrolment sample for `user`."""
    cv2 = _cv2()
    gray = _gray(jpeg)
    box = largest_face(gray)
    if box is None:
        return {"ok": False, "face": False, "n_samples": n_samples(user), "reason": "no face in frame"}
    d = user_dir(user)
    d.mkdir(parents=True, exist_ok=True)
    existing = sorted(d.glob("*.png"))
    if len(existing) >= MAX_SAMPLES:
        existing[0].unlink()
    path = d / f"{int(time.time() * 1000)}.png"
    cv2.imwrite(str(path), _crop(gray, box))
    _models.pop(user, None)
    return {"ok": True, "face": True, "n_samples": n_samples(user)}


def clear(user: str) -> int:
    d = user_dir(user)
    n = 0
    if d.exists():
        for p in d.glob("*.png"):
            p.unlink(); n += 1
    _models.pop(user, None)
    return n


def _recognizer(imgs):
    cv2 = _cv2()
    rec = cv2.face.LBPHFaceRecognizer_create(radius=1, neighbors=8, grid_x=8, grid_y=8)
    rec.train(imgs, np.zeros(len(imgs), dtype=np.int32))
    return rec


def own_threshold(imgs) -> float:
    """Leave-one-out: how far the owner's own crops sit from each other, scaled and clamped."""
    if len(imgs) < 3:
        return THRESHOLD
    dists = [_recognizer([im for j, im in enumerate(imgs) if j != i]).predict(imgs[i])[1] for i in range(len(imgs))]
    return float(np.clip(THRESHOLD_FACTOR * np.quantile(dists, 0.9), *THRESHOLD_RANGE))


def _model(user: str):
    """LBPH recognizer trained on the user's crops plus that user's threshold, cached by folder mtime."""
    cv2 = _cv2()
    d = user_dir(user)
    if not d.exists():
        return None, 0, THRESHOLD
    files = sorted(d.glob("*.png"))
    if not files:
        return None, 0, THRESHOLD
    mtime = max(p.stat().st_mtime for p in files)
    hit = _models.get(user)
    if hit and hit[0] == mtime:
        return hit[1], hit[2], hit[3]
    imgs = [cv2.imread(str(p), cv2.IMREAD_GRAYSCALE) for p in files]
    imgs = [i for i in imgs if i is not None]
    rec, thr = _recognizer(imgs), own_threshold(imgs)
    _models[user] = (mtime, rec, len(imgs), thr)
    return rec, len(imgs), thr


def threshold_for(user: str) -> float:
    return _model(user)[2]


def verify(user: str, jpeg: bytes, threshold: float | None = None) -> dict:
    """
    Is the largest face in this frame the enrolled owner `user`?
    match True/False when there is a face and an enrolment; None when either is missing.
    The threshold is the owner's own (own_threshold) unless given.
    """
    rec, n, thr = _model(user)
    if threshold is not None:
        thr = threshold
    try:
        gray = _gray(jpeg)
    except Exception as e:
        return {"face": False, "match": None, "distance": None, "threshold": thr, "enrolled": n, "reason": str(e)}
    box = largest_face(gray)
    if box is None:
        return {"face": False, "match": None, "distance": None, "threshold": thr, "enrolled": n, "reason": "no face in frame"}
    if rec is None:
        return {"face": True, "match": None, "distance": None, "threshold": thr, "enrolled": 0, "reason": "owner face not enrolled"}
    _, dist = rec.predict(_crop(gray, box))
    return {"face": True, "match": bool(dist < thr), "distance": round(float(dist), 1), "threshold": round(thr, 1), "enrolled": n}


def verify_frames(user: str, frames: list[bytes]) -> tuple[dict, bytes | None]:
    """
    Several frames a few hundred ms apart; the typist looks down at the keys most of
    the time and up now and then, so take the frame the owner model likes best (lowest
    distance) among those with a face. Returns (verdict, that frame). With no face in
    any frame: the no-face verdict and the last frame.
    """
    best, best_frame = None, None
    for jpeg in frames:
        v = verify(user, jpeg)
        if v.get("face") and (best is None or (v.get("distance") is not None and best.get("distance") is not None and v["distance"] < best["distance"])
                              or (best is not None and best.get("distance") is None and v.get("distance") is not None)):
            best, best_frame = v, jpeg
        elif best is None and v.get("face"):
            best, best_frame = v, jpeg
    if best is None:
        return (verify(user, frames[-1]) if frames else {"face": False, "match": None, "distance": None, "threshold": THRESHOLD, "enrolled": n_samples(user), "reason": "no frames"}), (frames[-1] if frames else None)
    best["frames"] = len(frames)
    return best, best_frame


# ---------------------------------------------------------------------------
# Screen snapshot (the backend runs on the machine with the keyboard)
# ---------------------------------------------------------------------------

def screen_enabled() -> bool:
    return os.environ.get("KEYSIGN_SCREEN_SNAPSHOT", "1") != "0"


def grab_screen(max_width: int = 1280, quality: int = 70) -> bytes | None:
    """JPEG of the whole display, downscaled. None if disabled or it fails (headless, permissions)."""
    if not screen_enabled():
        return None
    try:
        from PIL import ImageGrab
        im = ImageGrab.grab()
        if im.width > max_width:
            im = im.resize((max_width, int(im.height * max_width / im.width)))
        buf = io.BytesIO()
        im.convert("RGB").save(buf, format="JPEG", quality=quality)
        return buf.getvalue()
    except Exception as e:
        log.warning("screen snapshot failed: %s", e)
        return None
