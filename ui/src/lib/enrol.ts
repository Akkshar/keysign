/**
 * Calibration: turning ten typed sentences into a working profile on this machine.
 * The backend builds the baseline and the load cut-offs, then retrains the identity model
 * in the background (backend/enrol.py). Timings only; the letters are never sent.
 */
import { BACKEND_HTTP } from './keysign';

export interface EnrolSummary {
  user: string;
  calm_samples: number;
  stress_samples: number;
  hold_mean_ms: number;
  flight_mean_ms: number;
  speed_kps: number;
  spread: number;                        // how tightly the calm samples sit around the baseline, in sigma
  stress_hold_mean_ms?: number;
  stress_hold_change_pct?: number;
  stress_speed_kps?: number;
  state?: { focus_below: number; load_above: number } | null;
  identity?: { state: string; message: string };
  // A profile gets a baseline immediately; a class in the identity model is earned with
  // more typing, because a thin class costs the people already enrolled real accuracy.
  in_identity_model?: boolean;
  samples_for_identity?: { have: number; need: number };
}

export interface EnrolRequest {
  user: string;
  email?: string;
  samples: { condition: 'calm' | 'stress'; prompt: string; events: { type: 'down' | 'up'; key: string; code: string; t: number }[] }[];
}

export async function enrol(req: EnrolRequest): Promise<EnrolSummary> {
  const r = await fetch(`${BACKEND_HTTP}/api/enrol`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || 'The profile could not be built.');
  return d as EnrolSummary;
}

/** Hold the machine's alerts off while someone is typing the calibration sentences. */
export async function setCalibrating(on: boolean): Promise<void> {
  try {
    await fetch(`${BACKEND_HTTP}/api/enrol/mode`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on }),
    });
  } catch { /* no backend: there is nothing to hold off */ }
}

export interface EnrolStatus { state: 'idle' | 'building' | 'training' | 'ready' | 'error'; message: string; user?: string | null; calibrating?: boolean }

export async function fetchEnrolStatus(): Promise<EnrolStatus | null> {
  try {
    const r = await fetch(`${BACKEND_HTTP}/api/enrol/status`);
    return r.ok ? r.json() : null;
  } catch { return null; }
}
