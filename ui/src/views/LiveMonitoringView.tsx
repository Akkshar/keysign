import React from 'react';
import { useBiometrics } from '../context/BiometricsContext';
import { Interactive3DTypewriter } from '../components/3d/Interactive3DTypewriter';
import { LiveTypingWell } from '../components/telemetry/LiveTypingWell';
import { WaveformVisualizer } from '../components/telemetry/WaveformVisualizer';
import { IntervalTape } from '../components/instrumentation/IntervalTape';
import { MonkeyTypeArena } from '../components/lab/MonkeyTypeArena';
import { WaterfallChart, STATUS_TONE } from '../components/telemetry/WaterfallChart';
import { AnimatedCounter } from '../components/common/AnimatedCounter';
import { CardSpotlight } from '../components/motion/CardSpotlight';
import { Reveal, Swap } from '../components/motion/Reveal';
import { StressPreset } from '../types/biometrics';

const stamp = (t: number) => {
  const d = new Date(t);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
};

const PRESETS: { id: StressPreset; label: string }[] = [
  { id: 'baseline', label: 'Calm baseline' },
  { id: 'cognitive', label: 'High load' },
  { id: 'impersonator', label: 'Someone else' },
  { id: 'duress', label: 'Duress' },
];

/**
 * The live lab: where the three-minute demo happens. Every number on this
 * page comes from the keystrokes typed in this window, scored by the local
 * backend. The presets at the bottom are the one exception and say so.
 */
export const LiveMonitoringView: React.FC = () => {
  const { live, liveDwell, liveFlight, liveWpm, recentPulses, isTyping, terminalLogs, activePreset, setPreset } = useBiometrics();
  const distance = live.tick?.distance ?? null;
  const connection = !live.connected
    ? { text: 'Start the backend: uv run python -m backend', dot: 'bg-error dark:bg-error-dark' }
    : live.streaming
    ? { text: 'Backend connected · scoring on this machine', dot: 'bg-secondary dark:bg-secondary-dark' }
    : { text: 'Backend connected · waiting for keystrokes', dot: 'bg-tertiary dark:bg-tertiary-dark' };

  const numbers = [
    { label: 'Hold', value: liveDwell, unit: 'ms', decimals: 0, hint: 'how long a key is held' },
    { label: 'Gap', value: liveFlight, unit: 'ms', decimals: 0, hint: 'release to next press' },
    { label: 'Speed', value: liveWpm, unit: 'wpm', decimals: 0, hint: 'over the last window' },
    { label: 'Distance', value: distance, unit: 'σ', decimals: 2, hint: `from ${live.declaredUser || 'the declared user'}'s calm baseline` },
  ];

  const recent = recentPulses.slice(-8).reverse();
  const logs = terminalLogs.slice(-5);

  return (
    <Reveal className="flex flex-col w-full gap-8 pb-12">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-on-surface">The live lab</h1>
        <p className="font-body text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
          Type anywhere on this page. Every keystroke's timing goes to the backend on this machine, which
          scores it against the declared user's baseline and runs the heads. The words are never sent.
        </p>
        <p className="font-body text-xs text-on-surface-variant flex items-center gap-2 pt-1">
          <span className={`w-1.5 h-1.5 rounded-full ${connection.dot}`} />
          <Swap value={connection.text}>{connection.text}</Swap>
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Typing well and the four live numbers */}
        <div className="xl:col-span-7 space-y-6">
          <CardSpotlight>
            <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 space-y-5">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-serif text-lg font-medium text-on-surface">Type here</h2>
                <span className="font-body text-xs text-on-surface-variant">Or anywhere on the page</span>
              </div>

              <LiveTypingWell variant="full" rows={4} placeholder="Any sentence works. The rhythm is what is measured, not the words." />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {numbers.map((n) => (
                  <div key={n.label} className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30">
                    <span className="font-body text-[11px] text-on-surface-variant">{n.label}</span>
                    <div className="font-telemetry text-2xl font-medium text-on-surface mt-1 leading-none">
                      {n.value == null ? (
                        <span className="text-on-surface-variant">—</span>
                      ) : (
                        <AnimatedCounter value={n.value} decimals={n.decimals} />
                      )}
                      <span className="text-xs font-normal text-on-surface-variant ml-1">{n.unit}</span>
                    </div>
                    <span className="font-body text-[10px] text-on-surface-variant block mt-1.5">{n.hint}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardSpotlight>

          {/* Per-key timings, real */}
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-serif text-base font-medium text-on-surface">Last keystrokes</h3>
              <span className="font-body text-[11px] text-on-surface-variant">Timings only; the key itself is not shown</span>
            </div>
            <div className="font-telemetry text-xs">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 px-3 pb-1.5 text-[10px] uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/30">
                <span>Time</span>
                <span className="text-right">Hold</span>
                <span className="text-right">Gap</span>
                <span className="text-right">Verdict</span>
              </div>
              {recent.map((p) => (
                <div key={p.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 items-center px-3 py-1.5 border-b border-outline-variant/20 last:border-0 text-on-surface">
                  <span className="text-on-surface-variant">{stamp(p.timestamp)}</span>
                  <span className="text-right">{p.dwellMs} ms</span>
                  <span className="text-right">{p.flightMs} ms</span>
                  <span className={`text-right ${STATUS_TONE[p.status].text}`}>{STATUS_TONE[p.status].label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tick summaries, real */}
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 space-y-2">
            <h3 className="font-serif text-base font-medium text-on-surface">What the backend saw</h3>
            <pre className="font-telemetry text-[11px] leading-relaxed text-on-surface-variant whitespace-pre-wrap break-all bg-surface-container-low rounded-xl p-3 border border-outline-variant/30 m-0">
              {logs.length ? logs.join('\n') : 'No ticks yet.'}
            </pre>
          </div>
        </div>

        {/* The typewriter, capped */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-lg font-medium text-on-surface">The typewriter</h2>
              <span className="font-body text-xs text-on-surface-variant">Strikes the key you press</span>
            </div>
            <div className="relative w-full h-[420px] rounded-xl overflow-hidden bg-surface-container-low [&>div>div:first-child]:!h-[420px]">
              <Interactive3DTypewriter className="w-full" />
            </div>
          </div>

          {/* Fake numbers, kept out of the way */}
          <details className="group bg-surface-container-lowest border border-outline-variant/40 rounded-2xl">
            <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3 font-body text-sm text-on-surface">
              <span>
                Illustrative presets
                <span className="text-on-surface-variant"> (fake numbers, for slides)</span>
              </span>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span>
            </summary>
            <div className="px-5 pb-5 space-y-3">
              <p className="font-body text-xs text-on-surface-variant leading-relaxed">
                These set the gauges to made-up values so a slide can show each verdict. They are ignored
                while the backend is connected; the real ticks win.
              </p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id)}
                    disabled={live.connected}
                    className={`px-3 py-1.5 rounded-lg text-xs font-body font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                      activePreset === p.id
                        ? 'bg-primary text-white'
                        : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* The last keystrokes as physical intervals, then the same numbers as a wave. Each gets
          its own row: side by side, the visualiser's readouts wrapped a word to a line. */}
      <IntervalTape pulses={recentPulses} liveDwell={liveDwell} liveFlight={liveFlight} isTyping={isTyping} />
      <WaveformVisualizer />

      {/* A typing test to type into, so a demo has somewhere to put its hands. Every key here
          reaches the backend the same way any other application's does. */}
      <MonkeyTypeArena defaultMode="testing" />

      <WaterfallChart />
    </Reveal>
  );
};
