import React, { useEffect, useState } from 'react';
import { useBiometrics } from '../context/BiometricsContext';
import { mockStateTimelineEvents } from '../data/mockState';
import { AnimatedCounter } from '../components/common/AnimatedCounter';
import { Reveal, Swap } from '../components/motion/Reveal';
import { CardSpotlight } from '../components/motion/CardSpotlight';
import { ZBars } from '../components/state/ZBars';

/**
 * State: what state the typist is in. The load meter, label, explanation,
 * advice and drivers all come from the State head on the latest tick; the
 * timeline is the real sequence of label changes this session.
 */

const titleCase = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Load per tick for this page session. Module-level so it survives switching
// views; only this view reads it.
const LOAD_HISTORY: { ts: number; load: number }[] = [];
const HISTORY_MAX = 240;

const STYLE: Record<string, { text: string; bar: string; fallback: string }> = {
  'deep focus': {
    text: 'text-primary', bar: 'bg-primary',
    fallback: 'Steady rhythm and few corrections. Typing looks like the calm baseline.',
  },
  engaged: {
    text: 'text-secondary', bar: 'bg-secondary',
    fallback: 'Normal working rhythm. Nothing stands out from the baseline.',
  },
  'high load': {
    text: 'text-tertiary', bar: 'bg-tertiary',
    fallback: 'Faster, more corrections, more pauses and key overlap than the baseline.',
  },
};

export const StateView: React.FC = () => {
  const { cognitiveState, stateTimeline, live } = useBiometrics();

  const tick = live.tick;
  const st = tick?.heads?.state;
  const hasState = !!(live.connected && tick?.features && st && st.load != null);
  const rawLabel = hasState ? st!.label : '';
  const style = STYLE[rawLabel] || { text: 'text-on-surface-variant', bar: 'bg-outline-variant', fallback: '' };
  const label = !live.connected ? 'No backend' : !tick?.features ? 'No one typing' : !hasState ? 'Warming up' : titleCase(rawLabel);
  const load = hasState ? cognitiveState.cognitiveLoad : 0;
  const advice = hasState ? st!.advice : undefined;
  const explanation = hasState
    ? (st!.explanation || style.fallback)
    : !live.connected ? 'Start the backend and type anywhere in this window.'
    : !tick?.features ? 'Type anywhere in this window. The State head scores the last few seconds of rhythm against your calm baseline.'
    : 'Keep typing. The head needs a few seconds of rhythm before it scores.';
  const drivers = hasState ? (st!.drivers || []).slice(0, 5) : [];
  const user = tick?.user || live.declaredUser;

  // accumulate the real load series
  const [history, setHistory] = useState(() => LOAD_HISTORY.slice());
  useEffect(() => {
    if (!hasState || !tick) return;
    const last = LOAD_HISTORY[LOAD_HISTORY.length - 1];
    if (last && last.ts === tick.ts) return;
    LOAD_HISTORY.push({ ts: tick.ts, load: Math.round((st!.load as number) * 100) });
    if (LOAD_HISTORY.length > HISTORY_MAX) LOAD_HISTORY.splice(0, LOAD_HISTORY.length - HISTORY_MAX);
    setHistory(LOAD_HISTORY.slice());
  }, [tick, hasState, st]);

  const W = 600, H = 96;
  const path = history.length > 1
    ? history.map((p, i) => `${i === 0 ? 'M' : 'L'} ${((i / (history.length - 1)) * W).toFixed(1)} ${(H - (p.load / 100) * H).toFixed(1)}`).join(' ')
    : '';
  const spanS = history.length > 1 ? Math.round(history[history.length - 1].ts - history[0].ts) : 0;

  const timelineLive = stateTimeline.length > 0;
  const timeline = timelineLive ? stateTimeline.slice(-6) : mockStateTimelineEvents;

  return (
    <Reveal className="flex flex-col w-full gap-space-2xl">
      {/* Headline */}
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-on-surface">What state are they in?</h1>
        <p className="font-body text-sm text-on-surface-variant mt-space-xs max-w-2xl">
          Cognitive load from the rhythm of the last {tick?.window_s ?? 10} seconds, scored against {user ? `${titleCase(user)}'s` : 'the'} calm baseline. Other apps read the same answer from <code className="font-telemetry">GET /api/state</code>.
        </p>
      </div>

      {/* Hero: load meter + verdict */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-xl items-stretch">
        <CardSpotlight className="xl:col-span-8">
          <div className="h-full bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container flex flex-col justify-between gap-space-xl">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-lg">
              <div>
                <span className="font-telemetry text-[11px] uppercase tracking-wider text-outline">State · {live.connected ? 'live' : 'offline'}</span>
                <h2 className={`font-serif font-medium tracking-tight text-5xl sm:text-6xl leading-none mt-space-sm ${style.text}`}>
                  <Swap value={label}>{label}</Swap>
                </h2>
              </div>
              <div className="text-left md:text-right">
                <span className="font-body text-xs text-on-surface-variant">Load</span>
                <div className="flex items-baseline gap-space-xs md:justify-end">
                  <AnimatedCounter value={load} decimals={0} className="text-4xl text-on-surface" />
                  <span className="font-telemetry text-sm text-on-surface-variant">/ 100</span>
                </div>
              </div>
            </div>

            <div className="w-full h-2 rounded-full bg-surface-container-low overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${style.bar}`} style={{ width: `${load}%` }} />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md border-t border-surface-container pt-space-lg">
              <p className="font-body text-sm text-on-surface-variant max-w-xl">{explanation}</p>
              {advice && advice !== 'unknown' && (
                <div className={`flex items-center gap-space-xs flex-shrink-0 font-body text-sm font-medium ${advice === 'defer' ? 'text-tertiary' : 'text-secondary'}`}>
                  <span className="material-symbols-outlined text-[18px]">{advice === 'defer' ? 'notifications_paused' : 'notifications'}</span>
                  <Swap value={advice}>{advice === 'defer' ? 'Hold notifications' : 'OK to interrupt'}</Swap>
                </div>
              )}
            </div>
          </div>
        </CardSpotlight>

        <CardSpotlight className="xl:col-span-4">
          <div className="h-full bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container">
            <span className="font-telemetry text-[11px] uppercase tracking-wider text-outline">Live</span>
            <h3 className="font-body text-sm font-medium text-on-surface mt-0.5">What drives it</h3>
            <p className="font-body text-xs text-on-surface-variant mt-0.5 mb-space-lg">Features pushing the score, in standard deviations from the baseline.</p>
            <ZBars items={drivers} barClass="bg-tertiary" emptyText="Drivers appear once the head scores." />
          </div>
        </CardSpotlight>
      </div>

      {/* Load over this session (real) */}
      <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-sm mb-space-md">
          <div>
            <span className="font-telemetry text-[11px] uppercase tracking-wider text-outline">Live</span>
            <h3 className="font-body text-sm font-medium text-on-surface mt-0.5">Load this session</h3>
          </div>
          <div className="flex items-center gap-space-lg font-body text-xs text-on-surface-variant">
            <span>{history.length} ticks{spanS ? ` over ${spanS >= 60 ? `${Math.round(spanS / 60)} min` : `${spanS} s`}` : ''}</span>
            {hasState && cognitiveState.flowDurationMins > 0 && (
              <span>
                In focus <AnimatedCounter value={cognitiveState.flowDurationMins} decimals={1} suffix=" min" className="text-on-surface" />
              </span>
            )}
          </div>
        </div>
        <div className="relative rounded-lg bg-surface-container-low p-space-sm">
          <svg className="w-full h-24 block" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <line x1="0" x2={W} y1={H * 0.5} y2={H * 0.5} stroke="var(--outline-variant)" strokeDasharray="3,3" strokeWidth="1" />
            {path && <path d={path} fill="none" stroke="#d97706" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
          </svg>
          {history.length < 2 && (
            <p className="absolute inset-0 flex items-center justify-center font-body text-xs text-on-surface-variant">Draws as ticks arrive.</p>
          )}
          <div className="flex justify-between font-telemetry text-[10px] text-outline mt-1 px-1">
            <span>0</span>
            <span>50 · high load above</span>
            <span>100</span>
          </div>
        </div>
      </div>

      {/* Timeline of label changes */}
      <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container">
        <span className="font-telemetry text-[11px] uppercase tracking-wider text-outline">{timelineLive ? 'Live' : 'Illustrative'}</span>
        <h3 className="font-body text-sm font-medium text-on-surface mt-0.5">Changes of state</h3>
        <p className="font-body text-xs text-on-surface-variant mt-0.5 mb-space-lg">
          {timelineLive ? 'Each time the State head changed its label this session.' : 'Example sequence. Real changes replace it once the State head emits a label.'}
        </p>
        <ol className="flex flex-col gap-space-md">
          {timeline.map((evt) => (
            <li key={evt.num} className="flex items-start gap-space-md">
              <span className={`w-6 h-6 rounded-full ${evt.color} flex items-center justify-center font-telemetry text-xs flex-shrink-0 mt-0.5`}>{evt.num}</span>
              <div>
                <div className="flex items-baseline gap-space-sm">
                  <span className="font-telemetry text-xs text-on-surface-variant">{evt.time}</span>
                  <span className={`font-body text-sm font-medium ${evt.textColor}`}>{evt.title}</span>
                </div>
                <p className="font-body text-xs text-on-surface-variant mt-0.5">{evt.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Reveal>
  );
};
