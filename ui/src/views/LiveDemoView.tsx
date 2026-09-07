import React, { useState } from 'react';
import { useBiometrics } from '../context/BiometricsContext';
import { RadialGauge } from '../components/common/RadialGauge';
import { WaterfallChart } from '../components/telemetry/WaterfallChart';
import { LiveTypingWell } from '../components/telemetry/LiveTypingWell';
import { Reveal, Swap } from '../components/motion/Reveal';
import { AnimatedCounter } from '../components/common/AnimatedCounter';
import { StressPreset } from '../types/biometrics';
import { BikeCadenceGraph } from '../components/instrumentation/BikeCadenceGraph';

/**
 * Judge presets. Without a backend the four buttons put the dashboard into a
 * known state for a slide; with a backend connected, real ticks override them
 * (see BiometricsContext.setPreset). The typing well and the waterfall are
 * local per-keystroke timing either way.
 */

const samplePrompts = [
  'The quick brown fox jumps over the lazy dog.',
  'Everyone types with a rhythm that is theirs alone.',
  'Type normally, then let someone else take the chair.',
];

const presets: { id: StressPreset; label: string; note: string; tone: string }[] = [
  { id: 'baseline', label: 'Baseline', note: 'The enrolled person, calm', tone: 'border-primary text-primary' },
  { id: 'impersonator', label: 'Impersonator', note: 'Someone else at the keys', tone: 'border-error text-error' },
  { id: 'cognitive', label: 'Cognitive load', note: 'Same person, working hard', tone: 'border-tertiary text-tertiary' },
  { id: 'duress', label: 'Duress', note: 'Same person, under pressure', tone: 'border-error text-error' },
];

const verdictFor = (p: StressPreset) =>
  p === 'impersonator' ? 'Unknown typist' :
  p === 'cognitive' ? 'High load' :
  p === 'duress' ? 'Duress · silent alert' :
  'Matches baseline';

export const LiveDemoView: React.FC = () => {
  const { activePreset, setPreset, liveConfidence, liveWpm, liveDwell, liveFlight, liveJitter, terminalLogs, clearTerminal, live } =
    useBiometrics();
  const [promptIdx, setPromptIdx] = useState(0);

  return (
    <Reveal className="flex flex-col w-full gap-8 pb-12">
      <div className="space-y-2">
        <span className="text-xs font-telemetry tracking-wider uppercase text-on-surface-variant font-semibold">
          {live.connected ? 'Live · backend connected, presets are overridden by ticks' : 'Presets · for slides when no backend is running'}
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-on-surface">Demo presets</h1>
        <p className="font-body text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
          Pick a scenario to put the dashboard into that state, then type in the well to see the local timing move.
          With the backend running, ignore the buttons: the numbers come from real ticks.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 space-y-5">
          <div className="bg-surface-container-low rounded-xl p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">Prompt, if you want one</span>
              <button
                type="button"
                onClick={() => setPromptIdx((i) => (i + 1) % samplePrompts.length)}
                className="text-xs text-primary hover:underline"
              >
                Another
              </button>
            </div>
            <p className="font-body text-sm text-on-surface">{samplePrompts[promptIdx]}</p>
          </div>

          <LiveTypingWell variant="full" placeholder="Type here." />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Speed', value: liveWpm, unit: 'wpm', decimals: 0 },
              { label: 'Hold', value: liveDwell, unit: 'ms', decimals: 0 },
              { label: 'Flight', value: liveFlight, unit: 'ms', decimals: 0 },
              { label: 'Rhythm jitter', value: liveJitter, unit: '', decimals: 2 },
            ].map((m) => (
              <div key={m.label} className="bg-surface-container-low rounded-xl p-3">
                <span className="text-[11px] text-on-surface-variant">{m.label}</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <AnimatedCounter value={m.value} decimals={m.decimals} className="text-2xl font-medium text-on-surface" />
                  {m.unit && <span className="font-telemetry text-xs text-on-surface-variant">{m.unit}</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-5 border-t border-outline-variant/40 space-y-3">
            <span className="text-xs text-on-surface-variant">Scenario</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {presets.map((p) => {
                const active = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id)}
                    aria-pressed={active}
                    className={`flex flex-col items-start p-3 rounded-xl text-left border transition-colors ${
                      active ? `bg-surface-container-low ${p.tone}` : 'bg-surface-container-low border-outline-variant/60 text-on-surface hover:border-outline'
                    }`}
                  >
                    <span className="text-sm font-medium">{p.label}</span>
                    <span className="text-[11px] text-on-surface-variant">{p.note}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 flex flex-col items-center justify-center gap-4">
          <RadialGauge score={liveConfidence} size={190} label="Match" verdict={verdictFor(activePreset)} />
          <p className="text-xs text-on-surface-variant text-center max-w-xs">
            <Swap value={activePreset}>{verdictFor(activePreset)}</Swap>
            {' '}· the number is the identity head's confidence when a backend is connected, otherwise the preset's.
          </p>
        </section>
      </div>

      <WaterfallChart />

      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-medium text-on-surface">Event feed</h2>
          <button type="button" onClick={clearTerminal} className="text-xs text-primary hover:underline">
            Clear
          </button>
        </div>
        <div className="bg-slate-900 text-slate-200 p-4 rounded-xl min-h-[160px] max-h-[220px] overflow-y-auto font-telemetry text-xs">
          <div className="flex flex-col gap-1.5 select-text">
            {terminalLogs.map((log, i) => (
              <div key={i} className="opacity-90">
                <span className="text-slate-500 select-none mr-2">›</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-on-surface-variant">
          One line per tick from the local backend, newest last: keys in the window, declared and predicted user,
          confidence, baseline distance, load and threat level.
        </p>
      </section>

      {/* A toy, and labelled as one: steer the bike along a cadence curve with the arrow keys.
          It illustrates what rhythm looks like; it is not reading anybody's typing. */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-serif text-2xl font-medium text-on-surface">Cadence, to play with</h2>
          <p className="text-sm text-on-surface-variant">
            Arrow keys or A and D. An illustration of rhythm, drawn from nothing: no keystroke on this
            panel is measured, and none of it reaches the backend.
          </p>
        </div>
        <BikeCadenceGraph />
      </section>
    </Reveal>
  );
};
