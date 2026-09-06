import React from 'react';
import { AnimatedCounter } from '../common/AnimatedCounter';

/**
 * One of the Threat head's two clocks: how many consecutive ticks a condition
 * has held, out of the number it needs to fire. The bar is the verdict colour:
 * neutral at zero, amber while counting, red once it has fired.
 */
export const TickClock: React.FC<{ label: string; ticks: number; of: number; fired: boolean }> = ({ label, ticks, of, fired }) => {
  const frac = fired ? 1 : Math.min(1, ticks / of);
  const tone = fired ? 'bg-error' : ticks > 0 ? 'bg-tertiary' : 'bg-outline-variant';
  return (
    <div className="flex flex-col gap-space-xs">
      <div className="flex items-baseline justify-between gap-space-md">
        <span className="font-body text-sm text-on-surface-variant">{label}</span>
        <span className="font-telemetry text-sm text-on-surface">
          <AnimatedCounter value={Math.min(ticks, of)} durationMs={300} /> of {of} ticks
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
        <div className={`h-full rounded-full transition-[width] duration-300 ease-out ${tone}`} style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  );
};
