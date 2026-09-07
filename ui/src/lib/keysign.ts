/**
 * KeySign backend client for the UI.
 *
 * Two sockets, both localhost:
 *   /ws/dashboard  -> ticks (features, baseline distance, every head's output)
 *   /ws/capture    <- keystroke timings typed anywhere in this window
 *
 * Nothing but key names, key codes and timestamps leaves the page, and only
 * to the backend on this machine. See backend/app.py for the message shapes.
 */

export const BACKEND_HTTP = (import.meta as any).env?.VITE_KEYSIGN_HTTP || 'http://localhost:8000';
export const DASHBOARD_WS = (import.meta as any).env?.VITE_KEYSIGN_WS || 'ws://localhost:8000/ws/dashboard';
export const CAPTURE_WS = (import.meta as any).env?.VITE_KEYSIGN_CAPTURE_WS || 'ws://localhost:8000/ws/capture';

export interface IdentityOut {
  user: string | null;
  closest?: string | null;         // nearest enrolled teammate (user may be a known non-user class)
  confidence?: number;
  distance?: number | null;
  unknown?: boolean | null;
  warming_up?: boolean;            // too few keys in the window to vote yet
  matches_declared?: boolean;
  probs?: Record<string, number>;
  reason?: string;
  error?: string;
}
export interface StateOut {
  load: number | null;
  raw?: number;
  label: string;
  advice?: 'defer' | 'ok' | 'unknown';
  drivers?: [string, number][];
  source?: 'model' | 'rule';
  explanation?: string;
  reason?: string;
  error?: string;
}
export interface ThreatOut {
  level: 'none' | 'ok' | 'warn' | 'alert';
  kind?: 'intruder' | 'duress' | null;
  distance?: number;
  sustained_ticks?: number;
  identity_mismatch?: boolean;
  drivers?: [string, number][];
  alerts_total?: number;
  last_alert?: { ts: number; kind: string; sent: boolean; channel: string } | null;
  channel?: string;
  reason?: string;
  error?: string;
}
export interface Tick {
  type: 'tick';
  session: string;
  user: string;
  ts: number;
  window_s: number;
  n_events: number;
  n_keys: number;
  features: Record<string, number> | null;
  baseline: { user: string; n_samples: number } | null;
  distance: number | null;
  z: Record<string, number> | null;
  top: [string, number][] | null;
  heads: { identity?: IdentityOut; state?: StateOut; threat?: ThreatOut; [k: string]: any };
  status: string;
}
export interface BaselineInfo { user: string; n_samples: number; condition: string; created_at: string }
export interface BaselineDoc { user: string; n_samples: number; features: string[]; center: number[]; scale: number[] }

export type FeedMessage =
  | { type: 'hello'; sessions: { session: string; user: string }[]; baselines: BaselineInfo[]; heads: string[] }
  | { type: 'session_end'; session: string }
  | { type: 'reset'; session: string; user: string }
  | Tick;

/** Auto-reconnecting subscription to the tick stream. */
export function subscribeFeed(onMessage: (m: FeedMessage) => void, onStatus: (connected: boolean) => void, url = DASHBOARD_WS) {
  let ws: WebSocket | null = null;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const connect = () => {
    try { ws = new WebSocket(url); } catch { onStatus(false); timer = setTimeout(connect, 2000); return; }
    ws.onopen = () => onStatus(true);
    ws.onclose = () => { onStatus(false); if (!closed) timer = setTimeout(connect, 1500); };
    ws.onerror = () => ws && ws.close();
    ws.onmessage = (ev) => { try { onMessage(JSON.parse(ev.data)); } catch { /* ignore */ } };
  };
  connect();
  return () => { closed = true; if (timer) clearTimeout(timer); ws && ws.close(); };
}

/**
 * Streams keystroke timings from this window to the backend. Same message
 * shapes as capture/index.html's Live mode. Batches every 250 ms.
 */
export class CaptureStream {
  private ws: WebSocket | null = null;
  private queue: { type: 'down' | 'up'; key: string; code: string; t: number }[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  session = Math.random().toString(36).slice(2, 10);
  connected = false;
  onStatus: (connected: boolean) => void = () => {};

  constructor(private user: string, private url = CAPTURE_WS) {}

  start() {
    this.closed = false;
    this.connect();
    return this;
  }

  private connect() {
    try { this.ws = new WebSocket(this.url); } catch { this.scheduleRetry(); return; }
    this.ws.onopen = () => {
      this.connected = true; this.onStatus(true);
      this.send({ type: 'hello', user: this.user || 'unknown', session: this.session });
      this.timer = setInterval(() => this.flush(), 250);
    };
    this.ws.onclose = () => {
      this.connected = false; this.onStatus(false);
      if (this.timer) clearInterval(this.timer); this.timer = null; this.queue = [];
      if (!this.closed) this.scheduleRetry();
    };
    this.ws.onerror = () => this.ws && this.ws.close();
  }

  private scheduleRetry() { this.retry = setTimeout(() => this.connect(), 2000); }

  private send(msg: unknown) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); }

  private flush() {
    if (!this.queue.length || !this.ws || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify({ type: 'events', events: this.queue }));
    this.queue = [];
  }

  /** Call from keydown/keyup listeners. Drops OS auto-repeat. */
  push(e: KeyboardEvent, type: 'down' | 'up') {
    if (!this.connected) return;
    if (type === 'down' && e.repeat) return;
    const ts = typeof e.timeStamp === 'number' && e.timeStamp < 1e12 ? e.timeStamp : performance.now();
    this.queue.push({ type, key: e.key, code: e.code, t: Math.round(ts * 1000) / 1000 });
  }

  setUser(user: string) { this.user = user; this.send({ type: 'user', user: user || 'unknown' }); }
  reset() { this.queue = []; this.send({ type: 'reset' }); }

  stop() {
    this.closed = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.timer) clearInterval(this.timer);
    this.ws && this.ws.close();
  }
}

export async function fetchUsers(): Promise<BaselineInfo[]> {
  const r = await fetch(`${BACKEND_HTTP}/api/users`);
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()).baselines || [];
}

export async function fetchBaseline(user: string): Promise<BaselineDoc | null> {
  const r = await fetch(`${BACKEND_HTTP}/api/baseline/${encodeURIComponent(user)}`);
  if (!r.ok) return null;
  const d = await r.json();
  return d && d.center ? d : null;
}

export async function fetchAlerts(n = 20): Promise<any[]> {
  const r = await fetch(`${BACKEND_HTTP}/api/alerts?n=${n}`);
  if (!r.ok) return [];
  return (await r.json()).alerts || [];
}

/** Keys per second -> words per minute, at the usual 5 characters per word. */
export const kpsToWpm = (kps: number) => Math.round((kps * 60) / 5);


/** Machine-side settings kept by the backend (data/settings.json). */
export interface AppSettings { lock_on_intruder: boolean; photo_on_intruder: boolean; declared_user: string }
export async function fetchSettings(): Promise<AppSettings | null> {
  try { const r = await fetch(`${BACKEND_HTTP}/api/settings`); return r.ok ? r.json() : null; } catch { return null; }
}
export async function updateSettings(changes: Partial<AppSettings>): Promise<AppSettings | null> {
  try {
    const r = await fetch(`${BACKEND_HTTP}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) });
    return r.ok ? r.json() : null;
  } catch { return null; }
}
/** The desktop agent (system-wide capture), if one is running in this backend. */
export interface AgentStatus { running: boolean; session?: string; connected?: boolean; paused?: boolean; auto_paused?: boolean; keys_sent?: number; last_key_at?: number; foreground?: string }
export async function fetchAgent(): Promise<AgentStatus> {
  try { const r = await fetch(`${BACKEND_HTTP}/api/agent`); return r.ok ? r.json() : { running: false }; } catch { return { running: false }; }
}
