/**
 * Webcam snapshot for intruder alerts.
 *
 * Opt-in (Settings). When enabled, the dashboard keeps a low-resolution
 * camera stream open and, the moment the backend raises an INTRUDER alert,
 * grabs one JPEG frame and posts it to the local backend, which stores it
 * next to the alert log and forwards it with the silent phone push.
 * Duress alerts never take a photo: the person at the keyboard is the victim.
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
