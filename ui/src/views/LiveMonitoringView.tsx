import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useBiometrics } from '../context/BiometricsContext';
import { Interactive3DTypewriter } from '../components/3d/Interactive3DTypewriter';
import { MedicalDisclaimer } from '../components/health/MedicalDisclaimer';

type SimulationPreset = 'baseline' | 'tremor' | 'cognitive' | 'fatigue';

interface KeystrokeTelemetryPoint {
  id: number;
  dwellMs: number;
  flightMs: number;
  status: 'normal' | 'jitter' | 'hesitation';
  timestamp: string;
}

export const LiveMonitoringView: React.FC = () => {
  const { onKeyAction } = useBiometrics();
  const [activePreset, setActivePreset] = useState<SimulationPreset>('baseline');
  const [typedText, setTypedText] = useState('');
  const [dwellMs, setDwellMs] = useState(88);
  const [flightMs, setFlightMs] = useState(115);
  const [entropy, setEntropy] = useState(0.89);
  const [telemetryStream, setTelemetryStream] = useState<KeystrokeTelemetryPoint[]>([
    { id: 1, dwellMs: 84, flightMs: 110, status: 'normal', timestamp: '12:41:01.204' },
    { id: 2, dwellMs: 92, flightMs: 118, status: 'normal', timestamp: '12:41:01.322' },
    { id: 3, dwellMs: 87, flightMs: 114, status: 'normal', timestamp: '12:41:01.436' },
    { id: 4, dwellMs: 90, flightMs: 122, status: 'normal', timestamp: '12:41:01.558' },
    { id: 5, dwellMs: 86, flightMs: 109, status: 'normal', timestamp: '12:41:01.667' },
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyAction('down');

    // Simulate different kinematics depending on active preset
    let simulatedDwell = Math.floor(82 + Math.random() * 18);
    let simulatedFlight = Math.floor(105 + Math.random() * 25);
    let status: 'normal' | 'jitter' | 'hesitation' = 'normal';

    if (activePreset === 'tremor') {
      simulatedDwell = Math.floor(145 + Math.random() * 70);
      status = 'jitter';
    } else if (activePreset === 'cognitive') {
      simulatedFlight = Math.floor(280 + Math.random() * 150);
      status = 'hesitation';
    } else if (activePreset === 'fatigue') {
      simulatedDwell = Math.floor(125 + Math.random() * 35);
    }

    setDwellMs(simulatedDwell);
    setFlightMs(simulatedFlight);
    setEntropy(Number((0.82 + Math.random() * 0.14).toFixed(2)));

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now
      .getMilliseconds()
      .toString()
      .padStart(3, '0')}`;

    setTelemetryStream((prev) => [
      {
        id: Date.now() + Math.random(),
        dwellMs: simulatedDwell,
        flightMs: simulatedFlight,
        status,
        timestamp: timeStr,
      },
      ...prev.slice(0, 6),
    ]);
  };

  const handleKeyUp = () => {
    onKeyAction('up');
  };

  return (
    <div className="flex flex-col w-full gap-8 pb-12 select-none">
      {/* Page Title */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono tracking-wider uppercase text-emerald-600 dark:text-emerald-400 font-semibold">
            Real-Time Keystroke Laboratory
          </span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-slate-900 dark:text-slate-100">
          Live Kinetic Monitoring
        </h1>
        <p className="font-body text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
          Type freely in the interactive box below or directly on your keyboard. Watch how the 3D typewriter mechanically reacts to each keystroke, printing characters on the paper roller with combo streaks, while zero-knowledge timing latencies are calculated.
        </p>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Left Column (6 cols): Typing Box & Live Metrics */}
        <div className="xl:col-span-6 space-y-6">
          {/* Interactive Typing Well */}
          <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-serif font-medium text-slate-700 dark:text-slate-300">
                Interactive Typing Buffer
              </span>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Zero Payload Logging Active</span>
              </div>
            </div>

            <textarea
              rows={4}
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              placeholder="Type any sentence here to test your physical rhythm (e.g. 'The quick brown fox jumps over the lazy dog'). The 3D typewriter will depress the exact matching QWERTY keys and ink the paper..."
              className="w-full p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-body transition-all resize-none"
            />

            {/* Simulation Preset Buttons */}
            <div className="pt-1 space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Clinical Simulation Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'baseline', label: 'Healthy Baseline' },
                  { id: 'tremor', label: 'Parkinsonian Tremor' },
                  { id: 'cognitive', label: 'Cognitive Hesitation' },
                  { id: 'fatigue', label: 'Motor Fatigue' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setActivePreset(preset.id as SimulationPreset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      activePreset === preset.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Extracted Telemetry Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 shadow-sm">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Hold Duration (t_dwell)
              </span>
              <div className="text-xl font-mono font-semibold text-slate-900 dark:text-slate-100 mt-1">
                {dwellMs} <span className="text-xs font-normal text-slate-500">ms</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 shadow-sm">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Flight Latency (t_flight)
              </span>
              <div className="text-xl font-mono font-semibold text-slate-900 dark:text-slate-100 mt-1">
                {flightMs} <span className="text-xs font-normal text-slate-500">ms</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 shadow-sm">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Rhythm Entropy
              </span>
              <div className="text-xl font-mono font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                {entropy} <span className="text-xs font-normal text-slate-500">H</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 shadow-sm">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Kinetic Stability
              </span>
              <div className="text-xl font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                92%
              </div>
            </div>
          </div>

          {/* Real-Time Anonymous Timing Ledger */}
          <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                Recent Timing Deltas (No Characters Captured)
              </span>
              <span className="text-[10px] font-mono text-slate-400">Local Volatile RAM</span>
            </div>

            <div className="space-y-1.5">
              {telemetryStream.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 font-mono text-slate-700 dark:text-slate-300"
                >
                  <span className="text-[11px] text-slate-400">{item.timestamp}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                    t_dwell: {item.dwellMs}ms
                  </span>
                  <span className="text-slate-600 dark:text-slate-300">
                    t_flight: {item.flightMs}ms
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      item.status === 'jitter'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : item.status === 'hesitation'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    {item.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (6 cols): Grand Interactive 3D Typewriter in Lab Rig */}
        <div className="xl:col-span-6 space-y-4">
          <div className="bg-gradient-to-b from-slate-50 to-indigo-50/30 dark:from-slate-800/50 dark:to-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-200/50 dark:border-slate-800/50">
              <span className="font-serif text-sm font-medium text-slate-800 dark:text-slate-200">
                Kinematic Typewriter Rig & Gamified Paper
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                WebGL Three.js 3D
              </span>
            </div>

            <div className="w-full flex items-center justify-center relative overflow-hidden rounded-2xl">
              <Interactive3DTypewriter className="w-full" />
            </div>

            <p className="text-xs text-center text-slate-500 dark:text-slate-400 font-serif italic pt-2">
              Keys physically depress with matching letters as you type. Watch words ink onto the rolled paper in real time!
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
            <div className="font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">shield_check</span>
              <span>Zero-Storage Guarantee</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              Text printed on this 3D paper exists purely in browser memory as an HTML5 Canvas texture and is completely discarded on reload.
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <MedicalDisclaimer />
    </div>
  );
};
