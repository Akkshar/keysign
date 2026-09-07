"""
Owner face check for threat alerts, and the screen snapshot.

When the Threat head raises an alert (intruder OR duress) the machine takes a
short webcam burst and this module answers one question: is the person in
front of the keyboard the enrolled owner of the session (the declared user)?

    enrol(user, jpeg)  -> stores the largest face under data/faces/<user>/ (aligned crop + embedding)
    verify(user, jpeg) -> {"face": bool, "match": True | False | None, "similarity": float, ...}

Two engines, picked at run time:

- SFace (default when the ONNX models are in backend/assets/): YuNet detects
  the face and its five landmarks, the crop is aligned, SFace turns it into a
  128-d embedding and the answer is the best cosine similarity against the
  owner's enrolled embeddings. Measured on this machine's alert frames
  (2026-09-07, owner enrolled from 15 frontal frames): the owner glancing
  sideways scored 0.53, the owner frontal 0.79, the owner half looking down
  0.42, and every other person 0.14-0.26. Hence two cut-offs: >= SIM_MATCH is
  the owner, < SIM_REJECT is somebody else, in between the camera abstains
  (face turned away, half out of frame) and the typing decides.
  Fetch the models with:  uv run python -m backend.faces fetch
- LBPH (fallback, no models): OpenCV's Haar cascade + local binary pattern
  histograms on grayscale crops. Rough; it accepted a different person at
  distance 67-69 and rejected the owner at 76 (its per-owner threshold was 52),
  which is why SFace is the default.

Both keep everything on disk under data/faces/ (gitignored). With no enrolled
face the answer is "unknown" (match None).

The screen snapshot uses Pillow's ImageGrab on the machine the backend runs
on, which is the machine the keyboard is attached to. Set
KEYSIGN_SCREEN_SNAPSHOT=0 to switch it off.
"""
from __future__ import annotations

import argparse
import io
import logging
import os
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np

log = logging.getLogger("keysign.faces")

ROOT = Path(__file__).resolve().parent.parent
FACE_DIR = ROOT / "data" / "faces"
ASSETS = ROOT / "backend" / "assets"
CASCADE = ASSETS / "haarcascade_frontalface_default.xml"       # bundled: OpenCV 5 wheels ship none
YUNET = ASSETS / "face_detection_yunet_2023mar.onnx"
SFACE = ASSETS / "face_recognition_sface_2021dec.onnx"
MODEL_URLS = {
    YUNET: "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    SFACE: "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
}

# ---- SFace cut-offs (cosine similarity, higher = more like the owner) ----
SIM_MATCH = 0.40                # >= this: the owner (SFace's published operating point is 0.363)
SIM_REJECT = 0.25               # < this: somebody else. Between: the camera abstains.

# ---- LBPH fallback ----
CROP = 160                      # LBPH crops are CROP x CROP grayscale
THRESHOLD = 70.0                # LBPH distance fallback when the owner has < 3 crops
THRESHOLD_RANGE = (40.0, 60.0)  # per-owner LBPH threshold: 1.6 x own p90 leave-one-out distance, clamped
THRESHOLD_FACTOR = 1.6
MAX_SAMPLES = 20
MIN_FACE_FRACTION = 0.24        # a face smaller than this share of the frame height is a bystander, not the
                                # typist (measured: the owner at the keyboard is 30-46% of a 480 px frame, a
                                # person two desks back 22%; that person was once scored instead of the owner)
ALIGNED = 112                   # SFace's aligned crop size

_cascade = None
_yunet = None
_sface = None
_sface_broken = False
_models: dict[str, tuple[float, object, int, float]] = {}      # LBPH: user -> (dir mtime, recognizer, n, threshold)
_embeds: dict[str, tuple[float, np.ndarray]] = {}              # SFace: user -> (dir mtime, n x 128 embeddings)


def _slug(s: str) -> str:
    return "".join(c.lower() if c.isalnum() else "_" for c in s).strip("_")


def user_dir(user: str) -> Path:
    return FACE_DIR / _slug(user)


def _cv2():
    import cv2  # imported lazily: the backend must start even if OpenCV is missing
    return cv2


# ---------------------------------------------------------------------------
# Engines
# ---------------------------------------------------------------------------

def sface_available() -> bool:
    return YUNET.exists() and SFACE.exists() and not _sface_broken


def method() -> str:
    return "sface" if sface_available() else "lbph"


def fetch_models(force: bool = False) -> list[Path]:
    """Download the YuNet + SFace ONNX models (about 39 MB) into backend/assets/. Idempotent."""
    got = []
    for path, url in MODEL_URLS.items():
        if path.exists() and not force:
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".part")
        with urllib.request.urlopen(url, timeout=120) as r, open(tmp, "wb") as fh:
            while chunk := r.read(1 << 16):
                fh.write(chunk)
        tmp.replace(path)
        got.append(path)
    return got


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


def _yunet_det():
    global _yunet
    if _yunet is None:
        cv2 = _cv2()
        _yunet = cv2.FaceDetectorYN.create(str(YUNET), "", (320, 320), 0.7, 0.3, 50)
    return _yunet


def _sface_rec():
    global _sface
    if _sface is None:
        cv2 = _cv2()
        _sface = cv2.FaceRecognizerSF.create(str(SFACE), "")
    return _sface


def _decode(jpeg: bytes, gray: bool):
    cv2 = _cv2()
    arr = np.frombuffer(jpeg, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE if gray else cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("not an image")
    return img


def _gray(jpeg: bytes):
    return _decode(jpeg, gray=True)


# ---- detection ----
def largest_face(gray, min_fraction: float = MIN_FACE_FRACTION):
    """Haar: (x, y, w, h) of the largest frontal face big enough to be at the keyboard, or None."""
    h_frame = gray.shape[0]
    faces = _detector().detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(60, 60))
    if len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    if h < min_fraction * h_frame:
        return None
    return int(x), int(y), int(w), int(h)


def yunet_face(img, min_fraction: float = MIN_FACE_FRACTION):
    """YuNet: the full detection row (box + 5 landmarks + score) of the largest face at the keyboard, or None."""
    det = _yunet_det()
    h, w = img.shape[:2]
    det.setInputSize((w, h))
    _, faces = det.detect(img)
    if faces is None or len(faces) == 0:
        return None
    f = max(faces, key=lambda r: float(r[2]) * float(r[3]))
    # a tight crop (an enrolment sample) is all face; only frames bigger than a crop get the bystander rule
    if h > 2 * ALIGNED and float(f[3]) < min_fraction * h:
        return None
    return f


def embed(img, face_row=None) -> np.ndarray | None:
    """SFace 128-d embedding of the largest face in a BGR image (or of `face_row`); None with no face."""
    row = yunet_face(img) if face_row is None else face_row
    if row is None:
        return None
    rec = _sface_rec()
    return np.asarray(rec.feature(rec.alignCrop(img, row)), dtype=np.float32).reshape(-1)


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def _crop(gray, box):
    cv2 = _cv2()
    x, y, w, h = box
    face = gray[y:y + h, x:x + w]
    face = cv2.resize(face, (CROP, CROP))
    return cv2.equalizeHist(face)


# ---------------------------------------------------------------------------
# Enrolment store: data/faces/<user>/<ms>.png (+ <ms>.npy for SFace)
# ---------------------------------------------------------------------------

def n_samples(user: str) -> int:
    d = user_dir(user)
    return len(list(d.glob("*.png"))) if d.exists() else 0


def enrol(user: str, jpeg: bytes) -> dict:
    """Store the largest face in this frame as an enrolment sample for `user`."""
    cv2 = _cv2()
    d = user_dir(user)
    stamp = int(time.time() * 1000)
    if sface_available():
        img = _decode(jpeg, gray=False)
        row = yunet_face(img)
        if row is None:
            return {"ok": False, "face": False, "n_samples": n_samples(user), "reason": "no face in frame", "method": "sface"}
        rec = _sface_rec()
        aligned = rec.alignCrop(img, row)
        vec = np.asarray(rec.feature(aligned), dtype=np.float32).reshape(-1)
        d.mkdir(parents=True, exist_ok=True)
        _trim(d)
        cv2.imwrite(str(d / f"{stamp}.png"), aligned)
        np.save(d / f"{stamp}.npy", vec)
        _embeds.pop(user, None); _models.pop(user, None)
        return {"ok": True, "face": True, "n_samples": n_samples(user), "method": "sface"}
    gray = _gray(jpeg)
    box = largest_face(gray)
    if box is None:
        return {"ok": False, "face": False, "n_samples": n_samples(user), "reason": "no face in frame", "method": "lbph"}
    d.mkdir(parents=True, exist_ok=True)
    _trim(d)
    cv2.imwrite(str(d / f"{stamp}.png"), _crop(gray, box))
    _models.pop(user, None); _embeds.pop(user, None)
    return {"ok": True, "face": True, "n_samples": n_samples(user), "method": "lbph"}


def _trim(d: Path) -> None:
    existing = sorted(d.glob("*.png"))
    while len(existing) >= MAX_SAMPLES:
        p = existing.pop(0)
        p.unlink()
        p.with_suffix(".npy").unlink(missing_ok=True)


def clear(user: str) -> int:
    d = user_dir(user)
    n = 0
    if d.exists():
        for p in d.glob("*.png"):
            p.unlink(); n += 1
        for p in d.glob("*.npy"):
            p.unlink()
    _models.pop(user, None); _embeds.pop(user, None)
    return n


def _dir_mtime(files: list[Path]) -> float:
    return max(p.stat().st_mtime for p in files)


def _embeddings(user: str) -> np.ndarray:
    """The owner's enrolled SFace embeddings (n x 128), cached by folder mtime. Crops stored by the
    LBPH engine (grayscale, no .npy) are embedded on first use and the .npy written next to them."""
    cv2 = _cv2()
    d = user_dir(user)
    files = sorted(d.glob("*.png")) if d.exists() else []
    if not files:
        return np.zeros((0, 128), dtype=np.float32)
    mtime = _dir_mtime(files)
    hit = _embeds.get(user)
    if hit and hit[0] == mtime:
        return hit[1]
    vecs = []
    for p in files:
        npy = p.with_suffix(".npy")
        if npy.exists():
            vecs.append(np.load(npy).reshape(-1)); continue
        img = cv2.imread(str(p), cv2.IMREAD_COLOR)
        v = embed(img) if img is not None else None
        if v is not None:
            np.save(npy, v)
            vecs.append(v)
    out = np.vstack(vecs) if vecs else np.zeros((0, 128), dtype=np.float32)
    _embeds[user] = (_dir_mtime(sorted(d.glob("*.png"))), out)
    return out


# ---- LBPH model ----
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
    files = sorted(d.glob("*.png")) if d.exists() else []
    if not files:
        return None, 0, THRESHOLD
    mtime = _dir_mtime(files)
    hit = _models.get(user)
    if hit and hit[0] == mtime:
        return hit[1], hit[2], hit[3]
    imgs = [cv2.imread(str(p), cv2.IMREAD_GRAYSCALE) for p in files]
    imgs = [cv2.equalizeHist(cv2.resize(i, (CROP, CROP))) for i in imgs if i is not None]
    rec, thr = _recognizer(imgs), own_threshold(imgs)
    _models[user] = (mtime, rec, len(imgs), thr)
    return rec, len(imgs), thr


def threshold_for(user: str) -> float:
    return SIM_MATCH if sface_available() else _model(user)[2]


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

def verify(user: str, jpeg: bytes, threshold: float | None = None) -> dict:
    """
    Is the largest face in this frame the enrolled owner `user`?
    match True/False when the camera is sure, None when it is not (no face, no
    enrolment, or a face it cannot place). `score` is always "higher = more like
    the owner", whichever engine answered, so verify_frames can rank frames.
    """
    global _sface_broken
    if sface_available():
        try:
            return _verify_sface(user, jpeg)
        except Exception as e:                        # a broken DNN build: fall back for the rest of the run
            log.warning("SFace failed (%s); falling back to LBPH", e)
            _sface_broken = True
    return _verify_lbph(user, jpeg, threshold)


def _verify_sface(user: str, jpeg: bytes) -> dict:
    n = int(_embeddings(user).shape[0])
    base = {"method": "sface", "threshold": SIM_MATCH, "reject_below": SIM_REJECT, "enrolled": n, "distance": None}
    try:
        img = _decode(jpeg, gray=False)
    except Exception as e:
        return {**base, "face": False, "match": None, "similarity": None, "score": None, "reason": str(e)}
    row = yunet_face(img)
    if row is None:
        return {**base, "face": False, "match": None, "similarity": None, "score": None, "reason": "no face in frame"}
    if n == 0:
        return {**base, "face": True, "match": None, "similarity": None, "score": None, "reason": "owner face not enrolled"}
    vec = embed(img, row)
    refs = _embeddings(user)
    sim = max(cosine(vec, r) for r in refs)
    match = True if sim >= SIM_MATCH else False if sim < SIM_REJECT else None
    out = {**base, "face": True, "match": match, "similarity": round(sim, 3), "score": round(sim, 3)}
    if match is None:
        out["reason"] = "face turned away or unclear: the camera abstains"
    return out


def _verify_lbph(user: str, jpeg: bytes, threshold: float | None = None) -> dict:
    rec, n, thr = _model(user)
    if threshold is not None:
        thr = threshold
    base = {"method": "lbph", "threshold": thr, "enrolled": n, "similarity": None}
    try:
        gray = _gray(jpeg)
    except Exception as e:
        return {**base, "face": False, "match": None, "distance": None, "score": None, "reason": str(e)}
    box = largest_face(gray)
    if box is None:
        return {**base, "face": False, "match": None, "distance": None, "score": None, "reason": "no face in frame"}
    if rec is None:
        return {**base, "face": True, "match": None, "distance": None, "score": None, "enrolled": 0, "reason": "owner face not enrolled"}
    _, dist = rec.predict(_crop(gray, box))
    return {**base, "face": True, "match": bool(dist < thr), "distance": round(float(dist), 1), "threshold": round(thr, 1),
            "score": round(-float(dist), 1)}


def verify_frames(user: str, frames: list[bytes]) -> tuple[dict, bytes | None]:
    """
    Several frames a few hundred ms apart; the typist looks down at the keys most of
    the time and up now and then, so take the frame the owner model likes best
    (highest score) among those with a face. Returns (verdict, that frame). With no
    face in any frame: the last frame's verdict and the last frame.
    """
    best, best_frame = None, None
    for jpeg in frames:
        v = verify(user, jpeg)
        if not v.get("face"):
            continue
        if best is None or ((v.get("score") is not None) and (best.get("score") is None or v["score"] > best["score"])):
            best, best_frame = v, jpeg
    if best is None:
        if not frames:
            return {"face": False, "match": None, "distance": None, "similarity": None, "score": None,
                    "threshold": threshold_for(user), "enrolled": n_samples(user), "method": method(), "reason": "no frames"}, None
        return verify(user, frames[-1]), frames[-1]
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


# ---------------------------------------------------------------------------
# CLI:  uv run python -m backend.faces fetch
#       uv run python -m backend.faces check "Akkshar Ranjan" data/alert_photos/*.jpg
# ---------------------------------------------------------------------------

def _main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="KeySign owner face check")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("fetch", help="download the YuNet + SFace models into backend/assets/")
    c = sub.add_parser("check", help="score frames against a user's enrolment")
    c.add_argument("user"); c.add_argument("frames", nargs="+")
    a = p.parse_args(argv)
    if a.cmd == "fetch":
        got = fetch_models()
        print(f"{len(got)} file(s) downloaded; engine now: {method()}")
        return 0
    print(f"engine: {method()}, {n_samples(a.user)} enrolled samples for {a.user!r}")
    for f in a.frames:
        v = verify(a.user, Path(f).read_bytes())
        print(f"{Path(f).name:34s} match={v.get('match')!s:5s} sim={v.get('similarity')} dist={v.get('distance')} {v.get('reason', '')}")
    return 0


if __name__ == "__main__":
    sys.exit(_main())
