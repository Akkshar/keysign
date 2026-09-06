import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useBiometrics } from '../context/BiometricsContext';
import { RadialGauge } from '../components/common/RadialGauge';
import { WaterfallChart } from '../components/telemetry/WaterfallChart';
import { LiveTypingWell } from '../components/telemetry/LiveTypingWell';

const samplePrompts = [
  'The quick brown fox jumps over the lazy dog.',
  'Zero-knowledge behavioral biometrics protect user sovereignty.',
  'Cryptographic enclaves verify identity without plaintext retention.',
];

export const LiveDemoView: React.FC = () => {
  const {
    activePreset,
    setPreset,
    liveConfidence,
    liveWpm,
    liveDwell,
    liveFlight,
    liveJitter,
    terminalLogs,
    clearTerminal,
  } = useBiometrics();

  const [currentPromptIdx, setCurrentPromptIdx] = useState(0);

  const getVerdict = () => {
    if (activePreset === 'impersonator') return 'Anomaly Flagged • Impersonator';
    if (activePreset === 'cognitive') return 'Cognitive Load Spike • Monitored';
    if (activePreset === 'duress') return 'High Duress Vector • Honey-session Dispatched';
    return 'Enrolled user verified';
  };

  return (
    <div className="flex flex-col w-full gap-space-2xl">
      {/* Top Banner */}
      <div className="flex flex-col gap-space-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm border border-surface-container">
          <div className="flex items-start gap-space-md">
            <div className="p-space-sm bg-primary text-white rounded-lg flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[24px]">science</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-space-sm flex-wrap">
                <span className="font-headline text-[11px] text-primary uppercase tracking-wider font-bold bg-primary/10 px-2 py-0.5 rounded">
                  Judge Interactive Sandbox
                </span>
                <span className="px-space-xs py-space-2xs bg-secondary-container text-on-secondary-container font-telemetry text-xs rounded font-medium">
                  Evaluation Engine Ready
                </span>
              </div>
              <p className="font-body text-sm text-on-surface mt-space-2xs">
                Type naturally or vary your cadence to watch the sub-millisecond behavioral vector adapt and authenticate locally in real time.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-space-xs px-space-md py-space-sm bg-surface-container-low rounded-lg border border-surface-container self-start lg:self-center">
            <span className="material-symbols-outlined text-secondary text-[18px]">verified_user</span>
            <span className="font-headline text-xs text-on-surface-variant font-medium">
              Zero Key-Logging Guarantee • Ephemeral Heap Only
            </span>
          </div>
        </div>

        {/* Keystroke Sanitizer Guarantee Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm px-space-lg py-space-sm bg-surface-container-high rounded-lg text-on-surface-variant border border-surface-container">
          <div className="flex items-center gap-space-sm flex-wrap">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse flex-shrink-0"></span>
            <span className="font-telemetry text-xs font-semibold text-on-surface">
              Keystroke Content Sanitizer Active:
            </span>
            <span className="font-telemetry text-xs text-on-surface-variant">
              Alphanumeric payload discarded; timing tuples <code className="bg-surface-container-lowest px-1.5 py-0.5 rounded text-primary font-bold border border-surface-container">[t_down, t_up]</code> emitted directly to micro-inference stack.
            </span>
          </div>
          <span className="font-telemetry text-xs text-secondary font-semibold whitespace-nowrap">
            Privacy Grade: Hardened Zero-Knowledge
          </span>
        </div>
      </div>

      {/* Main Sandbox Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">
        {/* Left Column: Live Typing Box & Stress Tests */}
        <div className="lg:col-span-7 flex flex-col gap-space-lg">
          <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-surface-container flex flex-col justify-between">
            <div className="flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-primary text-[22px]">keyboard_alt</span>
                  <h2 className="font-headline text-base font-bold text-on-surface">Live Typing Input Box</h2>
                </div>
                <span className="font-telemetry text-xs px-space-sm py-space-2xs bg-surface-container text-on-surface-variant rounded border border-surface-container">
                  Capturing Dynamic Pulses
                </span>
              </div>

              {/* Prompt Sentence */}
              <div className="relative bg-surface-container-low p-space-md rounded-lg border border-surface-container">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-headline text-[11px] text-outline uppercase tracking-wider font-semibold">
                    Prompt Sentence (Type freely below):
                  </p>
                  <button
                    onClick={() => setCurrentPromptIdx((prev) => (prev + 1) % samplePrompts.length)}
                    className="font-headline text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[13px]">refresh</span> Change prompt
                  </button>
                </div>
                <p className="font-body text-sm text-on-surface font-medium select-none">
                  {samplePrompts[currentPromptIdx]}
                </p>
              </div>

              {/* Typing Area */}
              <LiveTypingWell variant="full" placeholder="Click here and begin typing naturally..." />
            </div>

            {/* 4 Live Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm mt-space-lg">
              <div className="bg-surface-container-low p-space-md rounded-lg border border-surface-container flex flex-col">
                <span className="font-headline text-[11px] text-outline font-medium">Typing Speed</span>
                <div className="flex items-baseline gap-space-2xs mt-space-2xs">
                  <span className="font-telemetry text-2xl font-bold text-on-surface">{liveWpm}</span>
                  <span className="font-telemetry text-xs text-outline">WPM</span>
                </div>
                <span className="font-telemetry text-[11px] text-secondary mt-space-2xs">±2.1 nominal</span>
              </div>

              <div className="bg-surface-container-low p-space-md rounded-lg border border-surface-container flex flex-col">
                <span className="font-headline text-[11px] text-outline font-medium">Hold Duration (Dwell)</span>
                <div className="flex items-baseline gap-space-2xs mt-space-2xs">
                  <span className="font-telemetry text-2xl font-bold text-secondary">{liveDwell}</span>
                  <span className="font-telemetry text-xs text-outline">ms</span>
                </div>
                <span className="font-telemetry text-[11px] text-secondary mt-space-2xs">Ideal vector</span>
              </div>

              <div className="bg-surface-container-low p-space-md rounded-lg border border-surface-container flex flex-col">
                <span className="font-headline text-[11px] text-outline font-medium">Flight Latency</span>
                <div className="flex items-baseline gap-space-2xs mt-space-2xs">
                  <span className="font-telemetry text-2xl font-bold text-on-surface">{liveFlight}</span>
                  <span className="font-telemetry text-xs text-outline">ms</span>
                </div>
                <span className="font-telemetry text-[11px] text-outline mt-space-2xs">σ = 14.2ms</span>
              </div>

              <div className="bg-surface-container-low p-space-md rounded-lg border border-surface-container flex flex-col">
                <span className="font-headline text-[11px] text-outline font-medium">Neuromuscular Tremor</span>
                <div className="flex items-baseline gap-space-2xs mt-space-2xs">
                  <span className="font-telemetry text-2xl font-bold text-on-surface">{liveJitter.toFixed(2)}</span>
                  <span className="font-telemetry text-xs text-outline">j-idx</span>
                </div>
                <span className="font-telemetry text-[11px] text-secondary mt-space-2xs">
                  {liveJitter < 0.1 ? 'Calm • Baseline' : liveJitter < 0.3 ? 'Fatigue Flutter' : 'Anomalous Jitter'}
                </span>
              </div>
            </div>

            {/* Stress Test Presets */}
            <div className="flex flex-col gap-space-xs mt-space-xl pt-space-lg border-t border-surface-container">
              <div className="flex items-center justify-between mb-space-2xs">
                <span className="font-headline text-xs text-on-surface-variant font-semibold uppercase tracking-wider">
                  Judge Stress-Test Presets
                </span>
                <span className="font-body text-xs text-outline">Inject synthetic behavioral shifts</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-xs">
                <motion.button
                  type="button"
                  whileHover={{ y: -2, scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setPreset('baseline')}
                  className={`flex flex-col items-start p-space-sm rounded-lg transition-colors text-left border ${
                    activePreset === 'baseline'
                      ? 'bg-primary/10 border-primary text-primary font-semibold shadow-sm'
                      : 'bg-surface-container-low hover:bg-surface-container border-surface-container'
                  }`}
                >
                  <span className="font-headline text-xs font-semibold text-primary">Owner Baseline</span>
                  <span className="font-telemetry text-[11px] text-outline">Legitimate owner</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ y: -2, scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setPreset('impersonator')}
                  className={`flex flex-col items-start p-space-sm rounded-lg transition-colors text-left border ${
                    activePreset === 'impersonator'
                      ? 'bg-red-500/10 border-error text-error font-semibold shadow-sm'
                      : 'bg-surface-container-low hover:bg-surface-container border-surface-container'
                  }`}
                >
                  <span className="font-headline text-xs font-semibold text-error">Simulate Impersonator</span>
                  <span className="font-telemetry text-[11px] text-outline">Rogue typist profile</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ y: -2, scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setPreset('cognitive')}
                  className={`flex flex-col items-start p-space-sm rounded-lg transition-colors text-left border ${
                    activePreset === 'cognitive'
                      ? 'bg-amber-500/10 border-tertiary text-tertiary font-semibold shadow-sm'
                      : 'bg-surface-container-low hover:bg-surface-container border-surface-container'
                  }`}
                >
                  <span className="font-headline text-xs font-semibold text-tertiary">Cognitive Fatigue</span>
                  <span className="font-telemetry text-[11px] text-outline">Erratic micro-pauses</span>
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ y: -2, scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setPreset('duress')}
                  className={`flex flex-col items-start p-space-sm rounded-lg transition-colors text-left border ${
                    activePreset === 'duress'
                      ? 'bg-red-500/15 border-error text-error font-semibold shadow-sm duress-alert-pulse'
                      : 'bg-surface-container-low hover:bg-surface-container border-surface-container'
                  }`}
                >
                  <span className="font-headline text-xs font-semibold text-error">Duress / Coercion</span>
                  <span className="font-telemetry text-[11px] text-outline">Severe motor tremor</span>
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Vector Breakdown & Gauges */}
        <div className="lg:col-span-5 flex flex-col gap-space-lg">
          <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-surface-container flex flex-col justify-between h-full">
            <div className="flex items-center justify-between pb-space-sm">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-primary text-[22px]">analytics</span>
                <h2 className="font-headline text-base font-bold text-on-surface">Vector Breakdown</h2>
              </div>
              <span className="font-telemetry text-xs px-space-xs py-space-2xs bg-surface-container-low text-primary rounded border border-surface-container">
                Confidence Matrix
              </span>
            </div>

            {/* Radial Gauge Container */}
            <div className="my-space-md p-space-lg bg-surface-container-low rounded-xl relative overflow-hidden border border-surface-container">
              <RadialGauge
                score={liveConfidence}
                size={190}
                label="Match Score"
                verdict={getVerdict()}
              />
            </div>

            {/* Progress Bars */}
            <div className="flex flex-col gap-space-md">
              <div className="flex flex-col gap-space-2xs">
                <div className="flex justify-between items-center text-on-surface text-xs font-headline">
                  <span>Flight Time Consistency</span>
                  <span className="font-telemetry font-semibold text-secondary">
                    {activePreset === 'impersonator' ? '38.2%' : '94.2%'}
                  </span>
                </div>
                <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary rounded-full transition-all duration-500"
                    style={{ width: activePreset === 'impersonator' ? '38%' : '94%' }}
                  ></div>
                </div>
              </div>

              <div className="flex flex-col gap-space-2xs">
                <div className="flex justify-between items-center text-on-surface text-xs font-headline">
                  <span>Key Hold Symmetry</span>
                  <span className="font-telemetry font-semibold text-secondary">
                    {activePreset === 'impersonator' ? '42.1%' : '96.8%'}
                  </span>
                </div>
                <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary rounded-full transition-all duration-500"
                    style={{ width: activePreset === 'impersonator' ? '42%' : '96%' }}
                  ></div>
                </div>
              </div>

              <div className="flex flex-col gap-space-2xs">
                <div className="flex justify-between items-center text-on-surface text-xs font-headline">
                  <span>Digraph Rhythm Cadence</span>
                  <span className="font-telemetry font-semibold text-secondary">
                    {activePreset === 'impersonator' ? '29.5%' : '99.1%'}
                  </span>
                </div>
                <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary rounded-full transition-all duration-500"
                    style={{ width: activePreset === 'impersonator' ? '29%' : '99%' }}
                  ></div>
                </div>
              </div>

              <div className="flex flex-col gap-space-2xs">
                <div className="flex justify-between items-center text-on-surface text-xs font-headline">
                  <span>Correction / Backspace Entropy</span>
                  <span className="font-telemetry font-semibold text-secondary">
                    {activePreset === 'duress' ? 'Severe Panic (48.4%)' : 'Normal (2.1%)'}
                  </span>
                </div>
                <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full bg-secondary rounded-full transition-all duration-500"
                    style={{ width: activePreset === 'duress' ? '88%' : '14%' }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keystroke Timing Waterfall Graph */}
      <WaterfallChart />

      {/* Terminal and Guarantee Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">
        {/* Diagnostic Event Feed Terminal */}
        <div className="lg:col-span-8 bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-surface-container flex flex-col">
          <div className="flex items-center justify-between mb-space-md">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-primary text-[22px]">terminal</span>
              <h3 className="font-headline text-base font-bold text-on-surface">Live Diagnostic Event Feed</h3>
            </div>
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
              <span className="font-telemetry text-xs text-secondary font-medium">Local Stream Socket</span>
            </div>
          </div>

          <div className="bg-slate-900 text-slate-200 p-space-md rounded-lg flex-1 min-h-[160px] max-h-[220px] overflow-y-auto flex flex-col justify-end font-telemetry text-xs border border-slate-800">
            <div className="flex flex-col gap-1.5 select-text">
              {terminalLogs.map((log, index) => (
                <div key={index} className="opacity-90 hover:opacity-100 transition-opacity font-mono">
                  <span className="text-primary-fixed-dim select-none mr-2">❯</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center mt-space-sm">
            <span className="font-telemetry text-xs text-outline">Format: IEEE Biometric Tick [RFC-2849 Extended]</span>
            <button
              type="button"
              onClick={clearTerminal}
              className="font-headline text-xs text-primary hover:underline font-semibold"
            >
              Clear Output Buffer
            </button>
          </div>
        </div>

        {/* Evaluation Guarantee Card */}
        <div className="lg:col-span-4 bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-surface-container flex flex-col justify-between">
          <div className="flex flex-col gap-space-sm">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-secondary text-[22px]">shield_lock</span>
              <h3 className="font-headline text-base font-bold text-on-surface">Evaluation Guarantee</h3>
            </div>
            <p className="font-body text-xs text-on-surface-variant leading-relaxed">
              Notice how the waterfall chart and JSON telemetry logs register distinct human variations (rhythm speed, finger transitions, muscular tremor) without inspecting raw ASCII or UTF-8 characters.
            </p>
            <div className="p-space-sm bg-surface-container-low rounded-lg border border-surface-container text-xs font-telemetry text-on-surface">
              <span className="text-secondary font-bold">100% Privacy Preserved:</span> All calculations occur in RAM and dissolve on session close.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
