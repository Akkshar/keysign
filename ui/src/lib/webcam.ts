/**
 * Webcam snapshot for threat alerts.
 *
 * Opt-in (Settings). The camera is NOT kept open: when the backend raises an
 * alert of either kind the dashboard opens it, takes one JPEG frame, closes
 * it and posts the frame to the local backend. The backend checks the face
 * against the owner's enrolled face (backend/faces.py, SFace) and grabs the
 * screen; the images leave the machine (phone push) only when the final call
 * is an intruder. A duress frame never leaves the machine: the person at the
 * keyboard is the victim.
 */
import { BACKEND_HTTP } from './keysign';

export class WebcamSnap {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  ready = false;
  error: string | null = null;

  async enable(): Promise<boolean> {
    if (this.ready) return true;
    if (!navigator.mediaDevices?.getUserMedia) { this.error = 'No camera API in this browser'; return false; }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.srcObject = this.stream;
      v.style.position = 'fixed'; v.style.width = '1px'; v.style.height = '1px'; v.style.opacity = '0'; v.style.pointerEvents = 'none';
      document.body.appendChild(v);
      await v.play();
      this.video = v; this.ready = true; this.error = null;
      return true;
    } catch (e: any) {
      this.error = e?.name === 'NotAllowedError' ? 'Camera permission denied' : String(e?.message || e);
      this.disable();
      return false;
    }
  }

  disable() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video?.remove();
    this.video = null;
    this.ready = false;
  }

  /** One JPEG frame, or null if the camera is not ready. */
  async capture(quality = 0.8): Promise<Blob | null> {
    const v = this.video;
    if (!v || !this.ready || v.videoWidth === 0) return null;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', quality));
  }

  /** Open, wait for exposure to settle, take one frame, close. ~0.5-1.5 s. */
  async snap(settleMs = 350): Promise<Blob | null> {
    const wasReady = this.ready;
    if (!wasReady && !(await this.enable())) return null;
    await new Promise((r) => setTimeout(r, settleMs));
    for (let i = 0; i < 20 && (this.video?.videoWidth ?? 0) === 0; i++) await new Promise((r) => setTimeout(r, 50));
    const blob = await this.capture();
    if (!wasReady) this.disable();
    return blob;
  }
}

/** Owner face enrolment: the backend crops and stores the largest face. */
export async function postFaceSample(user: string, blob: Blob): Promise<{ ok: boolean; face?: boolean; n_samples?: number; reason?: string }> {
  const r = await fetch(`${BACKEND_HTTP}/api/faces/${encodeURIComponent(user)}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
  return r.json();
}
export async function fetchFaceStatus(user: string): Promise<{ n_samples: number; threshold: number }> {
  const r = await fetch(`${BACKEND_HTTP}/api/faces/${encodeURIComponent(user)}`);
  if (!r.ok) return { n_samples: 0, threshold: 0 };
  return r.json();
}
export async function clearFaceSamples(user: string): Promise<void> {
  await fetch(`${BACKEND_HTTP}/api/faces/${encodeURIComponent(user)}`, { method: 'DELETE' });
}

/** Store the frame with the alert it belongs to. The backend forwards it with the push. */
export async function postAlertPhoto(ts: number, session: string, blob: Blob): Promise<{ ok: boolean; photo?: string }> {
  const r = await fetch(`${BACKEND_HTTP}/api/alerts/photo?ts=${encodeURIComponent(ts)}&session=${encodeURIComponent(session)}`, {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob,
  });
  if (!r.ok) return { ok: false };
  return r.json();
}

export const alertPhotoUrl = (name: string) => `${BACKEND_HTTP}/api/alerts/photo/${encodeURIComponent(name)}`;

/** Enrol from the backend's own camera, the same path the intruder check uses in background mode. */
export async function enrolFaceFromMachineCamera(user: string, frames = 8): Promise<{ ok: boolean; stored?: number; without_face?: number; n_samples?: number; threshold?: number; error?: string }> {
  const r = await fetch(`${BACKEND_HTTP}/api/faces/${encodeURIComponent(user)}/grab?frames=${frames}`, { method: 'POST' });
  return r.json();
}
