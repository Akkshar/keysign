import React, { useEffect, useMemo, useState } from 'react';
import { PrivacyBadge } from '../components/common/PrivacyBadge';
import { useBiometrics } from '../context/BiometricsContext';

/**
 * Drift: is a person's baseline moving over weeks and months?
 * Real longitudinal data from public/drift.json (built by pipeline/drift.py):
 * 22 Monkeytype typists over up to three years, the 51-person CMU benchmark
 * across 8 sessions, and our own team's days. Screening signal, never a diagnosis.
 */

interface DriftScore { z: number | null; delta: number | null; slope_per_month: number | null; n: number }
interface WeekPoint { week: string; wpm: number; acc: number; consistency: number; tests: number; wpm_roll: number | null; acc_roll: number | null }
interface MtUser { user: string; weeks: number; span_days: number; points: WeekPoint[]; drift: { wpm: DriftScore; acc: DriftScore; consistency: DriftScore } }
interface DriftData {
  generated_at: string;
  framing: string;
  monkeytype?: MtUser[];
  cmu?: { sessions: number[]; hold_mean: number[]; flight_mean: number[]; speed_kps: number[]; subjects: number;
          flight_change_pct_median: number; hold_change_pct_median: number;
          identity_holdout?: { random_split: number; train_s1_4_test_s5_8: number } };
  team?: { user: string; days: { day: string; n: number; hold_mean: number; flight_mean: number; speed_kps: number }[] }[];
}

const sign = (v: number | null | undefined, dp = 1, unit = '') => v == null ? '–' : `${v > 0 ? '+' : ''}${v.toFixed(dp)}${unit}`;
const zTone = (z: number | null | undefined) => z == null ? 'text-on-surface-variant' : Math.abs(z) >= 3 ? 'text-error' : Math.abs(z) >= 2 ? 'text-tertiary' : 'text-secondary';

/** Tiny inline SVG line chart: raw weekly series in grey, rolling baseline in colour. */
const Sparkline: React.FC<{ points: WeekPoint[]; metric: 'wpm' | 'acc' | 'consistency' }> = ({ points, metric }) => {
  const W = 900, H = 200, P = 24;
  const raw = points.map((p) => p[metric]);
  const roll = points.map((p) => (metric === 'wpm' ? p.wpm_roll : metric === 'acc' ? p.acc_roll : null));
  const vals = raw.concat(roll.filter((v): v is number => v != null));
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const x = (i: number) => P + (i / Math.max(1, points.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / Math.max(1e-6, hi - lo)) * (H - 2 * P);
  const path = (arr: (number | null)[]) => arr.map((v, i) => (v == null ? null : `${i === 0 || arr[i - 1] == null ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48">
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={P} x2={W - P} y1={P + f * (H - 2 * P)} y2={P + f * (H - 2 * P)} stroke="currentColor" strokeOpacity="0.08" />)}
      <path d={path(raw)} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      {roll.some((v) => v != null) && <path d={path(roll)} fill="none" stroke="#059669" strokeWidth="3" strokeLinejoin="round" />}
      <text x={P} y={H - 6} fontSize="11" fill="currentColor" fillOpacity="0.6">{points[0]?.week}</text>
      <text x={W - P} y={H - 6} fontSize="11" textAnchor="end" fill="currentColor" fillOpacity="0.6">{points[points.length - 1]?.week}</text>
      <text x={W - P} y={P - 6} fontSize="11" textAnchor="end" fill="currentColor" fillOpacity="0.6">max {hi.toFixed(0)}</text>
      <text x={P} y={P - 6} fontSize="11" fill="currentColor" fillOpacity="0.6">min {lo.toFixed(0)}</text>
    </svg>
  );
};

export const DriftView: React.FC = () => {
  const { live } = useBiometrics();
  const [data, setData] = useState<DriftData | null>(null);
  const [who, setWho] = useState(0);
  const [metric, setMetric] = useState<'wpm' | 'acc' | 'consistency'>('wpm');
  useEffect(() => {
    fetch('/drift.json').then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => setData(null));
  }, []);

  const users = data?.monkeytype ?? [];
  const u = users[who] ?? null;
  const dz = u?.drift[metric];
  const lastWeeks = useMemo(() => (u ? u.points.slice(-8) : []), [u]);
  const cmu = data?.cmu;
  const mine = data?.team?.find((t) => t.user === live.declaredUser) ?? data?.team?.[0];

  return (
    <div className="flex flex-col w-full gap-space-2xl">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md p-space-md bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container">
        <div className="flex items-center gap-space-md">
          <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary flex-shrink-0 border border-surface-container">
            <span className="material-symbols-outlined text-[24px]">trending_up</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-space-xs flex-wrap">
              <span className="font-headline text-sm font-bold text-on-surface">Area 04 • Baseline Drift</span>
              <span className="font-telemetry text-[11px] bg-primary/10 text-primary px-space-xs py-space-2xs rounded font-semibold">
                Roadmap · public longitudinal data
              </span>
            </div>
            <p className="font-body text-xs text-on-surface-variant">
              We have days of our own data, not years. This view uses 22 public typists over up to three years and the 51-person CMU benchmark to show what drift looks like.
            </p>
          </div>
        </div>
        <PrivacyBadge variant="pill" />
      </div>

      <div>
        <div className="flex items-center gap-space-xs mb-space-xs">
          <span className="font-telemetry text-xs text-primary uppercase tracking-wider font-semibold">Longitudinal Analysis</span>
          <span className="font-telemetry text-xs text-outline-variant">/</span>
          <span className="font-telemetry text-xs text-on-surface-variant">Personal baseline vs. latest weeks</span>
        </div>
        <h1 className="font-headline text-2xl lg:text-3xl text-on-surface font-bold tracking-tight">Drift — Long-Term Typing Changes</h1>
        <p className="font-body text-sm text-on-surface-variant max-w-3xl mt-space-2xs">
          {data?.framing ?? 'Screening signal, never a diagnosis.'}
        </p>
      </div>

      {!data && (
        <div className="bg-surface-container-lowest rounded-xl p-space-xl border border-surface-container text-sm text-on-surface-variant">
          No drift data. Run <code className="font-telemetry">uv run python -m pipeline.drift</code> and copy <code className="font-telemetry">dashboard/public/drift.json</code> to <code className="font-telemetry">ui/public/</code>.
        </div>
      )}

      {u && (
        <>
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-space-sm">
            <select value={who} onChange={(e) => setWho(Number(e.target.value))}
              className="font-telemetry text-xs bg-surface-container-lowest border border-surface-container rounded-lg px-space-sm py-space-xs text-on-surface">
              {users.map((x, i) => <option key={x.user} value={i}>{x.user} · {x.weeks} active weeks over {x.span_days} days</option>)}
            </select>
            <select value={metric} onChange={(e) => setMetric(e.target.value as any)}
              className="font-telemetry text-xs bg-surface-container-lowest border border-surface-container rounded-lg px-space-sm py-space-xs text-on-surface">
              <option value="wpm">speed (wpm)</option><option value="acc">accuracy (%)</option><option value="consistency">consistency</option>
            </select>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg">
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between">
              <span className="font-headline text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold mb-space-md">Drift score</span>
              <div className="flex items-baseline gap-space-xs mb-space-xs">
                <span className={`font-telemetry text-3xl font-bold ${zTone(dz?.z)}`}>{sign(dz?.z, 1, 'σ')}</span>
                <span className="font-telemetry text-xs text-outline">latest 8 weeks vs first 8</span>
              </div>
              <p className="font-body text-xs text-on-surface-variant mt-space-sm">In this person's own units: their first two months' spread is the ruler.</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between">
              <span className="font-headline text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold mb-space-md">Change</span>
              <div className="flex items-baseline gap-space-xs mb-space-xs">
                <span className="font-telemetry text-3xl font-bold text-primary">{sign(dz?.delta, 1)}</span>
                <span className="font-telemetry text-xs text-outline">{metric === 'wpm' ? 'wpm' : metric === 'acc' ? '% accuracy' : 'consistency'}</span>
              </div>
              <p className="font-body text-xs text-on-surface-variant mt-space-sm">Trend {sign(dz?.slope_per_month, 2)} per month over {u.weeks} active weeks.</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between">
              <span className="font-headline text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold mb-space-md">History</span>
              <div className="flex items-baseline gap-space-xs mb-space-xs">
                <span className="font-telemetry text-3xl font-bold text-on-surface">{u.span_days}</span>
                <span className="font-telemetry text-xs text-outline">days</span>
              </div>
              <p className="font-body text-xs text-on-surface-variant mt-space-sm">{u.points.reduce((s, p) => s + p.tests, 0).toLocaleString()} typing tests, weekly medians.</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between">
              <span className="font-headline text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold mb-space-md">Reading</span>
              <div className="flex items-baseline gap-space-xs mb-space-xs">
                <span className="font-headline text-lg font-bold text-on-surface">
                  {dz?.z == null ? 'Too short' : Math.abs(dz.z) >= 3 ? 'Baseline moved' : Math.abs(dz.z) >= 2 ? 'Drifting' : 'Stable'}
                </span>
              </div>
              <p className="font-body text-[11px] text-on-surface-variant mt-space-sm leading-tight">Screening indicator only — not a clinical diagnosis.</p>
            </div>
          </div>

          {/* Weekly series */}
          <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container flex flex-col gap-space-lg text-on-surface">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
              <div>
                <h3 className="font-headline text-base font-bold text-on-surface">{u.user} · weekly {metric}</h3>
                <p className="font-body text-xs text-on-surface-variant">Grey: weekly median. Green: 6-week rolling personal baseline.</p>
              </div>
            </div>
            <Sparkline points={u.points} metric={metric} />
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-space-sm">
              {lastWeeks.map((w) => (
                <div key={w.week} className="bg-surface-container-low p-space-sm rounded-lg border border-surface-container flex flex-col gap-1">
                  <span className="font-headline text-[11px] font-bold text-on-surface">{w.week}</span>
                  <span className="font-telemetry text-xs text-primary">{w.wpm.toFixed(0)} wpm</span>
                  <span className="font-telemetry text-xs text-secondary">{w.acc.toFixed(1)}% acc</span>
                  <span className="font-telemetry text-[10px] text-outline">{w.tests} tests</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* CMU benchmark + our own record */}
      {cmu && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
          <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container flex flex-col gap-space-sm">
            <h3 className="font-headline text-base font-bold text-on-surface">CMU benchmark · {cmu.subjects} people · 8 sessions</h3>
            <p className="font-body text-xs text-on-surface-variant">Same password typed on different days. Mean per session across all subjects.</p>
            <div className="grid grid-cols-8 gap-1 mt-space-sm">
              {cmu.sessions.map((s, i) => (
                <div key={s} className="bg-surface-container-low rounded-lg p-2 text-center border border-surface-container">
                  <div className="font-headline text-[10px] text-outline">s{s}</div>
                  <div className="font-telemetry text-xs text-tertiary font-semibold">{cmu.flight_mean[i].toFixed(0)}</div>
                  <div className="font-telemetry text-xs text-secondary">{cmu.hold_mean[i].toFixed(0)}</div>
                </div>
              ))}
            </div>
            <p className="font-body text-xs text-on-surface-variant mt-space-xs">
              <span className="text-tertiary font-semibold">flight</span> / <span className="text-secondary font-semibold">hold</span> in ms. The median typist gets <b>{Math.abs(cmu.flight_change_pct_median)}% {cmu.flight_change_pct_median < 0 ? 'faster' : 'slower'}</b> by the last session.
              {cmu.identity_holdout && <> An identity model scores <b>{Math.round(cmu.identity_holdout.random_split * 100)}%</b> on a random split but <b>{Math.round(cmu.identity_holdout.train_s1_4_test_s5_8 * 100)}%</b> when trained on early sessions and tested on later ones: baselines move, so KeySign re-learns them continuously.</>}
            </p>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container flex flex-col gap-space-sm">
            <h3 className="font-headline text-base font-bold text-on-surface">Our own record{mine ? ` · ${mine.user}` : ''}</h3>
            <p className="font-body text-xs text-on-surface-variant">Calm samples grouped by day. This is where a personal drift chart starts.</p>
            {mine ? (
              <div className="flex flex-col gap-space-xs mt-space-sm">
                {mine.days.map((d) => (
                  <div key={d.day} className="flex items-center justify-between bg-surface-container-low rounded-lg px-space-md py-space-xs border border-surface-container font-telemetry text-xs">
                    <span className="text-on-surface font-semibold">{d.day}</span>
                    <span className="text-outline">{d.n} samples</span>
                    <span className="text-secondary">hold {d.hold_mean.toFixed(0)} ms</span>
                    <span className="text-tertiary">flight {d.flight_mean.toFixed(0)} ms</span>
                    <span className="text-primary">{d.speed_kps.toFixed(1)} k/s</span>
                  </div>
                ))}
              </div>
            ) : <p className="font-body text-xs text-outline">No team data in drift.json yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
};
