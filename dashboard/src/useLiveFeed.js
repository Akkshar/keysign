// Subscribes to the backend's /ws/dashboard stream and keeps a rolling history per session.
// Reconnects on its own so the demo survives a backend restart.
import { useEffect, useRef, useState } from 'react';

export const WS_URL = (import.meta.env.VITE_KEYSIGN_WS) || 'ws://localhost:8000/ws/dashboard';
const HISTORY = 120; // ticks kept per session (~1 min at 2 ticks/s)

export function useLiveFeed(url = WS_URL) {
  const [connected, setConnected] = useState(false);
  const [meta, setMeta] = useState({ baselines: [], heads: [] });
  const [sessions, setSessions] = useState({}); // id -> { user, last, history[] }
  const retry = useRef(null);

  useEffect(() => {
    let ws, closed = false;
    const connect = () => {
      ws = new WebSocket(url);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => { setConnected(false); if (!closed) retry.current = setTimeout(connect, 1500); };
      ws.onerror = () => ws.close();
      ws.onmessage = (m) => {
        let d; try { d = JSON.parse(m.data); } catch { return; }
        if (d.type === 'hello') { setMeta({ baselines: d.baselines || [], heads: d.heads || [] }); return; }
        if (d.type === 'session_end') { setSessions(s => { const n = { ...s }; delete n[d.session]; return n; }); return; }
        if (d.type === 'reset') { setSessions(s => ({ ...s, [d.session]: { user: d.user, last: null, history: [] } })); return; }
        if (d.type === 'tick') {
          setSessions(s => {
            const prev = s[d.session] || { user: d.user, last: null, history: [] };
            const point = { t: d.ts, distance: d.distance, load: d.heads?.state?.load ?? null,
                            speed: d.features?.speed_kps ?? null, hold: d.features?.hold_mean ?? null,
                            flight: d.features?.flight_mean ?? null, errors: d.features ? d.features.error_rate * 100 : null };
            const history = d.features ? [...prev.history, point].slice(-HISTORY) : prev.history;
            return { ...s, [d.session]: { user: d.user, last: d, history } };
          });
        }
      };
    };
    connect();
    return () => { closed = true; clearTimeout(retry.current); ws && ws.close(); };
  }, [url]);

  return { connected, meta, sessions };
}
