import React, { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useLiveFeed, WS_URL } from './useLiveFeed.js';

const FEATURE_CARDS = [
  ['hold_mean', 'hold', 'ms', 1], ['flight_mean', 'flight', 'ms', 1], ['rp_mean', 'release→press', 'ms', 1],
  ['speed_kps', 'speed', 'k/s', 2], ['error_rate', 'errors', '%', 1, 100], ['rhythm_cv', 'rhythm cv', '', 2],
  ['pause_ratio', 'pauses', '%', 0, 100], ['rp_negative_ratio', 'overlap', '%', 0, 100],
];

const fmtTime = (t) => new Date(t * 1000).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
const levelClass = (d) => d == null ? 'muted' : d >= 3 ? 'alert' : d >= 2 ? 'warn' : 'ok';

export default function App() {
  const { connected, meta, sessions } = useLiveFeed();
  const ids = Object.keys(sessions);
  const [picked, setPicked] = useState(null);
  const active = picked && sessions[picked] ? picked : ids[ids.length - 1];
  const s = active ? sessions[active] : null;
  const tick = s?.last;

  return (
    <>
      <header>
        <h1>KEYSIGN</h1>
        <span className="sub">live · one pipeline, four heads</span>
        <span className="spacer" />
        {ids.length > 1 && (
          <select value={active} onChange={e => setPicked(e.target.value)}>
            {ids.map(id => <option key={id} value={id}>{sessions[id].user} · {id}</option>)}
          </select>
        )}
        <span className={`conn ${connected ? 'on' : 'off'}`}>{connected ? 'backend connected' : `no backend at ${WS_URL}`}</span>
      </header>

      <main>
        <div className="col">
          <DistancePanel s={s} tick={tick} />
          <FeaturesPanel tick={tick} />
          <TimelinePanel s={s} />
        </div>
        <div className="col">
          <WhoPanel tick={tick} meta={meta} />
          <StatePanel tick={tick} s={s} />
          <ThreatPanel tick={tick} />
          <HeadsPanel tick={tick} />
        </div>
      </main>
      <footer>KeySign · everything above is computed on this machine · no keystrokes leave it</footer>
    </>
  );
}

function DistancePanel({ s, tick }) {
  const d = tick?.distance;
  return (
    <div className="panel">
      <div className="head"><h2>Deviation from personal baseline</h2>
        {tick?.baseline && <span className="tag">{tick.baseline.user} · baseline from {tick.baseline.n_samples} samples</span>}</div>
      {!tick ? <div className="empty">Waiting for typing. Open the capture page, tick <b>Live</b>, and type.</div> :
       tick.features == null ? <div className="empty">{tick.status}</div> :
       d == null ? <div className="empty">Features are live, but <b>{tick.user}</b> has no baseline yet. Record 10+ calm samples and run <span className="mono">pipeline.baseline build</span>.</div> : (
        <>
          <div className={`big ${levelClass(d)}`}>{d.toFixed(2)}<span className="u">σ-distance · 1 = typical · 3+ = off</span></div>
          <div className="meter"><div style={{ width: `${Math.min(100, d / 5 * 100)}%`, background: d >= 3 ? 'var(--danger)' : d >= 2 ? 'var(--warn)' : 'var(--accent)' }} /></div>
          <div className="drivers">{(tick.top || []).map(([f, z]) => <span key={f} className="chip">{f} <b className={z > 0 ? 'warn' : 'ok'}>{z > 0 ? '+' : ''}{z.toFixed(1)}σ</b></span>)}</div>
        </>
      )}
      {s && s.history.length > 1 && (
        <div style={{ height: 140, marginTop: 12 }}>
          <ResponsiveContainer>
            <AreaChart data={s.history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#2a2f3a" vertical={false} />
              <XAxis dataKey="t" tickFormatter={fmtTime} stroke="#8b93a7" fontSize={11} minTickGap={40} />
              <YAxis domain={[0, 5]} stroke="#8b93a7" fontSize={11} />
              <Tooltip labelFormatter={fmtTime} formatter={(v) => v?.toFixed?.(2)} contentStyle={{ background: '#1e222b', border: '1px solid #2a2f3a' }} />
              <ReferenceLine y={2} stroke="#f7b955" strokeDasharray="3 3" />
              <ReferenceLine y={3} stroke="#ff6b6b" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="distance" stroke="#5ee1a1" fill="rgba(94,225,161,.15)" isAnimationActive={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function FeaturesPanel({ tick }) {
  const f = tick?.features, z = tick?.z || {};
  return (
    <div className="panel">
      <h2>Live features <span className="muted">· last {tick?.window_s ?? 10}s · {tick?.n_keys ?? 0} keys</span></h2>
      <div className="stats">
        {FEATURE_CARDS.map(([key, label, unit, dp, mul = 1]) => {
          const v = f ? f[key] * mul : null, zz = z[key];
          return (
            <div className="stat" key={key}>
              <div className="k">{label}</div>
              <div className="v mono">{v == null ? '–' : v.toFixed(dp)}<span className="u">{unit}</span></div>
              {zz != null && <div className={`z mono ${Math.abs(zz) >= 2 ? 'warn' : 'muted'}`}>{zz > 0 ? '+' : ''}{zz.toFixed(1)}σ</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelinePanel({ s }) {
  const data = s?.history || [];
  if (data.length < 2) return null;
  return (
    <div className="panel">
      <h2>Rhythm over time</h2>
      <div style={{ height: 160 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#2a2f3a" vertical={false} />
            <XAxis dataKey="t" tickFormatter={fmtTime} stroke="#8b93a7" fontSize={11} minTickGap={40} />
            <YAxis stroke="#8b93a7" fontSize={11} />
            <Tooltip labelFormatter={fmtTime} formatter={(v) => v?.toFixed?.(1)} contentStyle={{ background: '#1e222b', border: '1px solid #2a2f3a' }} />
            <Line type="monotone" dataKey="hold" name="hold ms" stroke="#5ee1a1" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="flight" name="flight ms" stroke="#f7b955" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="errors" name="errors %" stroke="#ff6b6b" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function WhoPanel({ tick, meta }) {
  const id = tick?.heads?.identity;
  return (
    <div className="panel">
      <h2>Identity</h2>
      {!tick ? <div className="empty">–</div> : id ? (
        <>
          <div className={`big ${id.unknown ? 'alert' : 'ok'}`} style={{ fontSize: 28 }}>{id.unknown ? 'UNKNOWN USER' : id.user}</div>
          <div className="note">confidence {id.confidence != null ? (id.confidence * 100).toFixed(0) + '%' : '–'} · declared: {tick.user}</div>
        </>
      ) : (
        <>
          <div className="big" style={{ fontSize: 28 }}>{tick.user}</div>
          <div className="note">declared by the capture page · identity head not registered yet ({meta.baselines.length} baselines on disk)</div>
        </>
      )}
    </div>
  );
}

function StatePanel({ tick, s }) {
  const st = tick?.heads?.state;
  const load = st?.load;
  const color = load == null ? 'var(--muted)' : load < 0.2 ? 'var(--accent)' : load < 0.5 ? 'var(--warn)' : 'var(--danger)';
  return (
    <div className="panel">
      <h2>State <span className="muted">· cognitive load</span></h2>
      <div className="big" style={{ color }}>{load == null ? '–' : (load * 100).toFixed(0)}<span className="u">{st?.label || ''}</span></div>
      <div className="meter"><div style={{ width: `${(load || 0) * 100}%`, background: color }} /></div>
      {st?.explanation && <div className="note">{st.explanation}</div>}
      {st?.reason && <div className="note">{st.reason}</div>}
    </div>
  );
}

function ThreatPanel({ tick }) {
  const th = tick?.heads?.threat;
  const lvl = th?.level || 'none';
  const cls = lvl === 'alert' ? 'alert' : lvl === 'warn' ? 'warn' : lvl === 'ok' ? 'ok' : 'muted';
  return (
    <div className="panel">
      <h2>Threat <span className="muted">· duress (silent)</span></h2>
      <div className={`big ${cls}`} style={{ fontSize: 28 }}>{lvl.toUpperCase()}</div>
      {th?.drivers && <div className="drivers">{th.drivers.map(([f, z]) => <span key={f} className="chip">{f} {z > 0 ? '+' : ''}{z.toFixed(1)}σ</span>)}</div>}
      {th?.reason && <div className="note">{th.reason}</div>}
    </div>
  );
}

function HeadsPanel({ tick }) {
  const heads = tick?.heads || {};
  const others = Object.keys(heads).filter(k => !['identity', 'state', 'threat'].includes(k));
  if (!others.length) return null;
  return (
    <div className="panel">
      <h2>Other heads</h2>
      {others.map(k => <pre key={k} className="mono" style={{ fontSize: 12, margin: 0 }}>{k}: {JSON.stringify(heads[k])}</pre>)}
    </div>
  );
}
