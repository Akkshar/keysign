import React from 'react';
import { useBiometrics } from '../../context/BiometricsContext';
import { AnimatedCounter } from '../common/AnimatedCounter';

const W = 960;
const H = 200;
const PAD = 12;

/** Turn a series into an SVG polyline, scaled to the chart box. */
function toPath(values: number[], max: number) {
  if (values.length < 2) return '';
  const step = (W - PAD * 2) / (values.length - 1);
  return values
    .map((v, i) => {
      const x = PAD + i * step;
      const y = H - PAD - (Math.min(v, max) / max) * (H - PAD * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * Two lines over your last 20 keystrokes: how long each key was held (hold)
 * and the gap before it (flight). Drawn from the real timings in this window.
 */
export const WaveformVisualizer: React.FC = () => {
  const { recentPulses, liveDwell, liveFlight } = useBiometrics();
  const pulses = recentPulses.slice(-20);
  const dwell = pulses.map((p) => p.dwellMs);
  const flight = pulses.map((p) => p.flightMs);
  const max = Math.max(250, ...dwell, ...flight);

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-space-xl flex flex-col gap-space-lg">
      <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-space-md">
        <div>
          <h2 className="font-serif text-lg font-medium text-on-surface">Hold and gap over time</h2>
          <p className="font-body text-xs text-on-surface-variant">Your last 20 keystrokes, in milliseconds.</p>
        </div>
        <div className="flex items-center gap-space-md font-body text-[11px] text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full bg-primary dark:bg-primary-dark" />
            Hold
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full bg-secondary dark:bg-secondary-dark" />
            Gap
          </span>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-xl p-space-md border border-outline-variant/30">
        <svg className="w-full h-48" fill="none" preserveAspectRatio="none" viewBox={`0 0 ${W} ${H}`}>
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              className="text-outline-variant/40"
              stroke="currentColor"
              strokeDasharray="4 4"
              strokeWidth="1"
              x1={PAD}
              x2={W - PAD}
              y1={H - PAD - f * (H - PAD * 2)}
              y2={H - PAD - f * (H - PAD * 2)}
            />
          ))}
          <path className="text-secondary dark:text-secondary-dark" d={toPath(flight, max)} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path className="text-primary dark:text-primary-dark" d={toPath(dwell, max)} stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-space-sm">
        <div className="bg-surface-container-low p-space-md rounded-xl border border-outline-variant/30">
          <span className="font-body text-[11px] text-on-surface-variant">Hold, last window</span>
          <div className="font-telemetry text-lg font-medium text-on-surface">
            <AnimatedCounter value={liveDwell} /> <span className="text-xs text-on-surface-variant font-normal">ms</span>
          </div>
        </div>
        <div className="bg-surface-container-low p-space-md rounded-xl border border-outline-variant/30">
          <span className="font-body text-[11px] text-on-surface-variant">Gap, last window</span>
          <div className="font-telemetry text-lg font-medium text-on-surface">
            <AnimatedCounter value={liveFlight} /> <span className="text-xs text-on-surface-variant font-normal">ms</span>
          </div>
        </div>
      </div>
    </div>
  );
};
