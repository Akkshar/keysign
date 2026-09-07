import React from 'react';
import { useBiometrics } from '../context/BiometricsContext';
import { Interactive3DTypewriter } from '../components/3d/Interactive3DTypewriter';
import { LiveTypingWell } from '../components/telemetry/LiveTypingWell';
import { WaveformVisualizer } from '../components/telemetry/WaveformVisualizer';
import { IntervalTape } from '../components/instrumentation/IntervalTape';
import { MonkeyTypeArena } from '../components/lab/MonkeyTypeArena';
import { WaterfallChart, STATUS_TONE } from '../components/telemetry/WaterfallChart';
import { AnimatedCounter } from '../components/common/AnimatedCounter';
import { Reveal, Swap } from '../components/motion/Reveal';
import { StressPreset } from '../types/biometrics';

/**
 * The live lab: where the three-minute demo happens.
 *
 * Laid out the way the new design lays this page out, two columns with the typing
 * buffer and its readouts on the left and the typewriter rig on the right, and dressed
 * in the same card the rest of that design uses (see `panel` below) so the page stops
 * alternating between two visual languages half way down.
 *
 * What is deliberately not taken from the designers' version of this file: it is the one
 * file in the pack still written in the pre-restyle slate and indigo, and every number on
 * it is invented. Its "Clinical Simulation Presets" fabricate 145-215ms holds under a
 * button labelled Parkinsonian Tremor, its stability reads a fixed 92%, and its timing
 * ledger ships five rows of made-up keystrokes. Everything here is measured: the
 * keystrokes come from this page, and the window figures come from the backend's ticks.
 */

/** One card, matching the design's paper panel. Used by every block on this page. */
const PANEL = 'rounded-xl border border-stone-200 dark:border-stone-800 bg-[#fdfcf9] dark:bg-[#151513] shadow-sm';

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

export const LiveMonitoringView: React.FC = () => {
  const { live, liveDwell, liveFlight, liveWpm, recentPulses, isTyping, terminalLogs, activePreset, setPreset } =
    useBiometrics();
  const distance = live.tick?.distance ?? null;

  const connection = !live.connected
    ? { text: 'Start the backend: uv run python -m backend', dot: 'bg-error dark:bg-error-dark' }
    : live.streaming
    ? { text: 'Backend connected · scoring on this machine', dot: 'bg-secondary dark:bg-secondary-dark' }
    : { text: 'Backend connected · waiting for keystrokes', dot: 'bg-tertiary dark:bg-tertiary-dark' };

  const numbers = [
    { label: 'Hold', value: liveDwell || null, unit: 'ms', decimals: 0, hint: 'how long a key is held' },
    { label: 'Gap', value: liveFlight || null, unit: 'ms', decimals: 0, hint: 'release to next press' },
    { label: 'Speed', value: liveWpm || null, unit: 'wpm', decimals: 0, hint: 'over the last window' },
    {
      label: 'Distance',
      value: distance,
      unit: 'σ',
      decimals: 2,
      hint: `from ${live.declaredUser || 'the declared user'}'s calm baseline`,
    },
  ];

  const recent = recentPulses.slice(-8).reverse();
  const logs = terminalLogs.slice(-5);

  return (
    <Reveal className="flex flex-col w-full gap-8 pb-12">
      <div className="space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-stone-900 dark:text-stone-100">
          The live lab
        </h1>
        <p className="font-body text-sm sm:text-base text-stone-600 dark:text-stone-400 max-w-2xl leading-relaxed">
          Type anywhere on this page. Every keystroke's timing goes to the backend on this machine, which
          scores it against the declared user's baseline and runs the heads. The words are never sent.
        </p>
        <p className="font-body text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2 pt-1">
          <span className={`w-1.5 h-1.5 rounded-full ${connection.dot}`} />
          <Swap value={connection.text}>{connection.text}</Swap>
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: the buffer, its four readouts, the ledger, and what the backend replied */}
        <div className="xl:col-span-7 space-y-6">
          <div className={`${PANEL} p-6 space-y-5`}>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-serif text-lg font-medium text-stone-900 dark:text-stone-100">Type here</h2>
              <span className="font-mono text-[11px] text-stone-500 dark:text-stone-400">
                or anywhere on the page
              </span>
            </div>

            <LiveTypingWell
              variant="full"
              rows={4}
              placeholder="Any sentence works. The rhythm is what is measured, not the words."
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {numbers.map((n) => (
                <div
                  key={n.label}
                  className="p-4 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/50 hover-subtle-glow"
                >
                  <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    {n.label}
                  </span>
                  <div className="font-telemetry text-2xl font-medium text-stone-900 dark:text-stone-100 mt-1 leading-none">
                    {n.value == null ? (
                      <span className="text-stone-400 dark:text-stone-600">–</span>
                    ) : (
                      <AnimatedCounter value={n.value} decimals={n.decimals} />
                    )}
                    <span className="text-xs font-normal text-stone-500 dark:text-stone-400 ml-1">{n.unit}</span>
                  </div>
                  <span className="font-body text-[10px] text-stone-500 dark:text-stone-400 block mt-1.5">
                    {n.hint}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={`${PANEL} p-5 space-y-3`}>
            <div className="flex items-baseline justify-between">
              <h3 className="font-serif text-base font-medium text-stone-900 dark:text-stone-100">Last keystrokes</h3>
              <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
                timings only, no characters
              </span>
            </div>
            <div className="font-telemetry text-xs">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 px-3 pb-1.5 text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500 border-b border-stone-200 dark:border-stone-800">
                <span>Time</span>
                <span className="text-right">Hold</span>
                <span className="text-right">Gap</span>
                <span className="text-right">Verdict</span>
              </div>
              {recent.length === 0 && (
                <p className="font-body text-xs text-stone-500 dark:text-stone-400 px-3 py-4">
                  Nothing yet. Every key you press adds a row.
                </p>
              )}
              {recent.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 items-center px-3 py-1.5 border-b border-stone-200/60 dark:border-stone-800/60 last:border-0 text-stone-800 dark:text-stone-200"
                >
                  <span className="text-stone-500 dark:text-stone-400">{stamp(p.timestamp)}</span>
                  <span className="text-right">{p.dwellMs} ms</span>
                  <span className="text-right">{p.flightMs} ms</span>
                  <span className={`text-right ${STATUS_TONE[p.status].text}`}>{STATUS_TONE[p.status].label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`${PANEL} p-5 space-y-2`}>
            <h3 className="font-serif text-base font-medium text-stone-900 dark:text-stone-100">
              What the backend saw
            </h3>
            <pre className="font-telemetry text-[11px] leading-relaxed text-stone-600 dark:text-stone-400 whitespace-pre-wrap break-all bg-stone-50/70 dark:bg-stone-900/50 rounded-lg p-3 border border-stone-200 dark:border-stone-800 m-0">
              {logs.length ? logs.join('\n') : 'No ticks yet.'}
            </pre>
          </div>
        </div>

        {/* Right: the typewriter rig, as the design frames it */}
        <div className="xl:col-span-5 space-y-6">
          <div className={`${PANEL} p-5 space-y-3`}>
            <div className="flex items-center justify-between pb-3 border-b border-stone-200/80 dark:border-stone-800/80">
              <span className="font-serif text-sm font-medium text-stone-800 dark:text-stone-200">
                The typewriter
              </span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400">
                strikes the key you press
              </span>
            </div>
            <div className="relative w-full h-[420px] rounded-lg overflow-hidden bg-stone-50/70 dark:bg-stone-900/40 [&>div>div:first-child]:!h-[420px]">
              <Interactive3DTypewriter className="w-full" />
            </div>
            <p className="font-serif italic text-xs text-center text-stone-500 dark:text-stone-400 pt-1">
              The paper is a canvas texture in this tab. It is gone on reload, and it never leaves the page.
            </p>
          </div>

          <details className={`group ${PANEL}`}>
            <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3 font-body text-sm text-stone-800 dark:text-stone-200">
              <span>
                Illustrative presets
                <span className="text-stone-500 dark:text-stone-400"> (fake numbers, for slides)</span>
              </span>
              <span className="material-symbols-outlined text-[18px] text-stone-400 transition-transform group-open:rotate-180">
                expand_more
              </span>
            </summary>
            <div className="px-5 pb-5 space-y-3">
              <p className="font-body text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                These set the gauges to made-up values so a slide can show each verdict. They are ignored
                while the backend is connected; the real ticks win.
              </p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id)}
                    disabled={live.connected}
                    className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors cursor-pointer border disabled:cursor-not-allowed disabled:opacity-50 ${
                      activePreset === p.id
                        ? 'bg-stone-900 text-stone-100 border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100 font-semibold'
                        : 'text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-800 hover:text-stone-900 dark:hover:text-stone-200'
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

      {/* The same keystrokes as physical intervals, then as a trace. Each gets its own row:
          side by side, the trace's readouts wrapped a word to a line. */}
      <IntervalTape pulses={recentPulses} liveDwell={liveDwell} liveFlight={liveFlight} isTyping={isTyping} />
      <WaveformVisualizer />

      {/* Somewhere to put your hands during a demo. Every key here reaches the backend the
          same way any other application's does. */}
      <MonkeyTypeArena defaultMode="testing" />

      <WaterfallChart />
    </Reveal>
  );
};
