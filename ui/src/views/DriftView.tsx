import { PrivacyBadge } from '../components/common/PrivacyBadge';
import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useBiometrics } from '../context/BiometricsContext';
import { Reveal, Swap } from '../components/motion/Reveal';
import { CardSpotlight } from '../components/motion/CardSpotlight';
import { AnimatedCounter } from '../components/common/AnimatedCounter';

/**
 * Drift: is a person's baseline moving over weeks and months?
 * Real longitudinal data from public/drift.json (built by pipeline/drift.py):
 * Monkeytype typists over up to three years, the 51-person CMU benchmark
 * across 8 sessions, and our own team's days. Nothing here is live; it is the
 * roadmap head. Screening signal, never a diagnosis.
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

type Metric = 'wpm' | 'acc' | 'consistency';
const METRIC_LABEL: Record<Metric, string> = { wpm: 'Speed', acc: 'Accuracy', consistency: 'Consistency' };
const METRIC_UNIT: Record<Metric, string> = { wpm: 'wpm', acc: '%', consistency: '' };

const zTone = (z: number | null | undefined) => z == null ? 'text-on-surface-variant' : Math.abs(z) >= 3 ? 'text-error' : Math.abs(z) >= 2 ? 'text-tertiary' : 'text-secondary';
const reading = (z: number | null | undefined) => z == null ? 'Too short to read' : Math.abs(z) >= 3 ? 'Baseline moved' : Math.abs(z) >= 2 ? 'Drifting' : 'Stable';

/** A number that animates when the selection changes; an en dash when there is none. */
const Num: React.FC<{ value: number | null | undefined; decimals?: number; signed?: boolean; suffix?: string; className?: string }> = ({ value, decimals = 0, signed = false, suffix = '', className = '' }) =>
  value == null
    ? <span className={`font-telemetry ${className}`}>–</span>
    : <AnimatedCounter value={value} decimals={decimals} prefix={signed && value > 0 ? '+' : ''} suffix={suffix} className={className} />;

/** Weekly series in grey, 6-week rolling baseline in ink, the two compared windows shaded. */
const Sparkline: React.FC<{ points: WeekPoint[]; metric: Metric }> = ({ points, metric }) => {
  const W = 900, H = 220, P = 28;
  const raw = points.map((p) => p[metric]);
  const roll = points.map((p) => (metric === 'wpm' ? p.wpm_roll : metric === 'acc' ? p.acc_roll : null));
  const vals = raw.concat(roll.filter((v): v is number => v != null));
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const n = points.length;
  const x = (i: number) => P + (i / Math.max(1, n - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / Math.max(1e-6, hi - lo)) * (H - 2 * P);
  const path = (arr: (number | null)[]) => arr.map((v, i) => (v == null ? null : `${i === 0 || arr[i - 1] == null ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(' ');
  const win = Math.min(8, Math.floor(n / 2));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56 text-on-surface" role="img" aria-label={`Weekly ${METRIC_LABEL[metric].toLowerCase()} with a rolling baseline`}>
      {n >= 4 && (
        <>
          <rect x={x(0)} y={P} width={x(win - 1) - x(0)} height={H - 2 * P} fill="currentColor" fillOpacity="0.045" />
          <rect x={x(n - win)} y={P} width={x(n - 1) - x(n - win)} height={H - 2 * P} fill="currentColor" fillOpacity="0.045" />
          <text x={x(0) + 4} y={P + 12} fontSize="10" fill="currentColor" fillOpacity="0.55">first {win} weeks</text>
          <text x={x(n - 1) - 4} y={P + 12} fontSize="10" textAnchor="end" fill="currentColor" fillOpacity="0.55">last {win} weeks</text>
        </>
      )}
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={P} x2={W - P} y1={P + f * (H - 2 * P)} y2={P + f * (H - 2 * P)} stroke="currentColor" strokeOpacity="0.08" />)}
      <path d={path(raw)} fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />
      {roll.some((v) => v != null) && <path d={path(roll)} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      <text x={P} y={H - 8} fontSize="11" fill="currentColor" fillOpacity="0.6">{points[0]?.week}</text>
      <text x={W - P} y={H - 8} fontSize="11" textAnchor="end" fill="currentColor" fillOpacity="0.6">{points[n - 1]?.week}</text>
      <text x={W - P} y={P - 8} fontSize="11" textAnchor="end" fill="currentColor" fillOpacity="0.6">{hi.toFixed(0)} {METRIC_UNIT[metric]}</text>
      <text x={P} y={H - P + 14} fontSize="11" fill="currentColor" fillOpacity="0.6">{lo.toFixed(0)} {METRIC_UNIT[metric]}</text>
    </svg>
  );
};

export const DriftView: React.FC = () => {
  const { live } = useBiometrics();
  const [data, setData] = useState<DriftData | null>(null);
  const [who, setWho] = useState(0);
  const [metric, setMetric] = useState<Metric>('wpm');
  useEffect(() => {
    fetch('/drift.json').then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => setData(null));
  }, []);

  const users = data?.monkeytype ?? [];
  const u = users[who] ?? null;
  const dz = u?.drift[metric];
  const lastWeeks = useMemo(() => (u ? u.points.slice(-8) : []), [u]);
  const tests = useMemo(() => (u ? u.points.reduce((s, p) => s + p.tests, 0) : 0), [u]);
  const cmu = data?.cmu;
  const mine = data?.team?.find((t) => t.user === live.declaredUser) ?? data?.team?.[0];

  const selectClass = 'font-body text-sm bg-surface-container-lowest border border-surface-container rounded-lg px-space-md py-space-sm text-on-surface';

  return (
    <Reveal className="flex flex-col w-full gap-space-2xl">
      {/* Framing */}
      <div className="flex flex-col gap-space-sm max-w-3xl">
        <span className="font-telemetry text-xs uppercase tracking-wider text-on-surface-variant">Roadmap · public longitudinal data</span>
        <h1 className="font-display text-3xl lg:text-4xl font-medium tracking-tight text-on-surface leading-tight">
          Does a person's baseline move over months?
        </h1>
        <p className="font-body text-base text-on-surface-variant">
          {data?.framing ?? 'Screening signal, never a diagnosis.'}
          {' '}We have days of our own data, not years, so this view uses {users.length || 'public'} Monkeytype typists over up to three years and the {cmu?.subjects ?? 51}-person CMU benchmark to show what drift looks like.
        </p>
        <PrivacyBadge variant="pill" className="mt-2 self-start" />
      </div>

      {!data && (
        <div className="bg-surface-container-lowest rounded-2xl p-space-xl border border-surface-container font-body text-sm text-on-surface-variant">
          No drift data. Run <code className="font-telemetry">uv run python -m pipeline.drift</code> and copy <code className="font-telemetry">dashboard/public/drift.json</code> to <code className="font-telemetry">ui/public/</code>.
        </div>
      )}

      {u && (
        <CardSpotlight color="rgba(19, 27, 46, 0.06)">
          <div className="bg-surface-container-lowest border border-surface-container rounded-2xl p-space-2xl flex flex-col gap-space-xl">
            {/* Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-md">
              <label className="flex items-center gap-space-sm font-body text-sm text-on-surface-variant">
                Typist
                <select value={who} onChange={(e) => setWho(Number(e.target.value))} className={selectClass}>
                  {users.map((x, i) => <option key={x.user} value={i}>{x.user} · {x.weeks} active weeks over {x.span_days} days</option>)}
                </select>
              </label>
              <div className="flex items-center gap-space-lg font-body text-sm" role="tablist" aria-label="Metric">
                {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={metric === m}
                    onClick={() => setMetric(m)}
                    className={`pb-space-2xs border-b-2 transition-colors ${metric === m ? 'border-on-surface text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
                  >
                    {METRIC_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>

            {/* The numbers */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-lg">
              <div className="flex flex-col gap-space-2xs">
                <span className="font-body text-sm text-on-surface-variant">Drift score</span>
                <Num value={dz?.z} decimals={1} signed suffix="σ" className={`text-3xl ${zTone(dz?.z)}`} />
                <span className="font-body text-xs text-on-surface-variant">last 8 weeks against the first 8, in this person's own spread</span>
              </div>
              <div className="flex flex-col gap-space-2xs">
                <span className="font-body text-sm text-on-surface-variant">Change</span>
                <Num value={dz?.delta} decimals={1} signed suffix={METRIC_UNIT[metric] ? ` ${METRIC_UNIT[metric]}` : ''} className="text-3xl text-on-surface" />
                <span className="font-body text-xs text-on-surface-variant">
                  trend <Num value={dz?.slope_per_month} decimals={2} signed className="text-xs" /> per month over {u.weeks} active weeks
                </span>
              </div>
              <div className="flex flex-col gap-space-2xs">
                <span className="font-body text-sm text-on-surface-variant">History</span>
                <Num value={u.span_days} suffix=" days" className="text-3xl text-on-surface" />
                <span className="font-body text-xs text-on-surface-variant"><Num value={tests} className="text-xs" /> typing tests, weekly medians</span>
              </div>
              <div className="flex flex-col gap-space-2xs">
                <span className="font-body text-sm text-on-surface-variant">Reading</span>
                <AnimatePresence mode="wait" initial={false}>
                  <Swap value={`${u.user}-${metric}-${reading(dz?.z)}`} className={`font-serif text-3xl font-medium tracking-tight ${zTone(dz?.z)}`}>
                    {reading(dz?.z)}
                  </Swap>
                </AnimatePresence>
                <span className="font-body text-xs text-on-surface-variant">a screening signal, never a diagnosis</span>
              </div>
            </div>

            {/* The chart */}
            <div className="flex flex-col gap-space-sm">
              <Sparkline points={u.points} metric={metric} />
              <p className="font-body text-xs text-on-surface-variant">
                Thin line: weekly median. Bold line: 6-week rolling personal baseline. Shaded: the two windows the drift score compares.
              </p>
            </div>

            {/* Last eight weeks */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-space-sm">
              {lastWeeks.map((w) => (
                <div key={w.week} className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-space-2xs">
                  <span className="font-body text-xs text-on-surface-variant">{w.week}</span>
                  <span className="font-telemetry text-sm text-on-surface">{w.wpm.toFixed(0)} wpm</span>
                  <span className="font-telemetry text-xs text-on-surface-variant">{w.acc.toFixed(1)}% · {w.tests} tests</span>
                </div>
              ))}
            </div>
          </div>
        </CardSpotlight>
      )}

      {/* CMU benchmark + our own record */}
      {cmu && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
          <div className="bg-surface-container-lowest rounded-2xl p-space-xl border border-surface-container flex flex-col gap-space-md">
            <div className="flex flex-col gap-space-2xs">
              <h2 className="font-serif text-xl font-medium text-on-surface">CMU benchmark</h2>
              <p className="font-body text-sm text-on-surface-variant">{cmu.subjects} people typed the same password on eight different days. Mean per session, in ms.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-telemetry text-sm">
                <thead>
                  <tr className="font-body text-xs text-on-surface-variant border-b border-surface-container">
                    <th className="py-space-xs pr-space-md font-medium">Session</th>
                    {cmu.sessions.map((s) => <th key={s} className="py-space-xs pr-space-md font-medium text-right">{s}</th>)}
                  </tr>
                </thead>
                <tbody className="text-on-surface">
                  <tr className="border-b border-surface-container">
                    <td className="py-space-xs pr-space-md font-body text-on-surface-variant">Flight</td>
                    {cmu.flight_mean.map((v, i) => <td key={i} className="py-space-xs pr-space-md text-right">{v.toFixed(0)}</td>)}
                  </tr>
                  <tr>
                    <td className="py-space-xs pr-space-md font-body text-on-surface-variant">Hold</td>
                    {cmu.hold_mean.map((v, i) => <td key={i} className="py-space-xs pr-space-md text-right">{v.toFixed(0)}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="font-body text-sm text-on-surface-variant">
              The median typist is {Math.abs(cmu.flight_change_pct_median)}% {cmu.flight_change_pct_median < 0 ? 'faster' : 'slower'} by the last session.
              {cmu.identity_holdout && <> An identity model scores {Math.round(cmu.identity_holdout.random_split * 100)}% on a random split but {Math.round(cmu.identity_holdout.train_s1_4_test_s5_8 * 100)}% when trained on early sessions and tested on later ones. Baselines move, so KeySign re-learns them.</>}
            </p>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-space-xl border border-surface-container flex flex-col gap-space-md">
            <div className="flex flex-col gap-space-2xs">
              <h2 className="font-serif text-xl font-medium text-on-surface">Our own record{mine ? ` · ${mine.user}` : ''}</h2>
              <p className="font-body text-sm text-on-surface-variant">Calm samples grouped by day. This is where a personal drift chart starts.</p>
            </div>
            {mine ? (
              <table className="w-full text-left font-telemetry text-sm">
                <thead>
                  <tr className="font-body text-xs text-on-surface-variant border-b border-surface-container">
                    <th className="py-space-xs pr-space-md font-medium">Day</th>
                    <th className="py-space-xs pr-space-md font-medium text-right">Samples</th>
                    <th className="py-space-xs pr-space-md font-medium text-right">Hold</th>
                    <th className="py-space-xs pr-space-md font-medium text-right">Flight</th>
                    <th className="py-space-xs font-medium text-right">Speed</th>
                  </tr>
                </thead>
                <tbody className="text-on-surface divide-y divide-surface-container">
                  {mine.days.map((d) => (
                    <tr key={d.day}>
                      <td className="py-space-xs pr-space-md">{d.day}</td>
                      <td className="py-space-xs pr-space-md text-right">{d.n}</td>
                      <td className="py-space-xs pr-space-md text-right">{d.hold_mean.toFixed(0)} ms</td>
                      <td className="py-space-xs pr-space-md text-right">{d.flight_mean.toFixed(0)} ms</td>
                      <td className="py-space-xs text-right">{d.speed_kps.toFixed(1)} k/s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="font-body text-sm text-on-surface-variant">No team data in drift.json yet.</p>}
          </div>
        </div>
      )}
    </Reveal>
  );
};
