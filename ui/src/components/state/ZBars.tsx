import React from 'react';
import { AnimatedCounter } from '../common/AnimatedCounter';

/**
 * Signed z-score bars: one row per feature, bar grows left (slower / fewer)
 * or right (faster / more) of a zero line. Used for "what moved" on the
 * Identity view and the drivers on the State view. Values are live.
 */

const NAMES: Record<string, string> = {
  hold_mean: 'key hold',
  hold_std: 'key hold spread',
  hold_median: 'key hold (median)',
  flight_mean: 'gap between keys',
  flight_std: 'gap spread',
  flight_median: 'gap between keys (median)',
  speed_kps: 'typing speed',
  error_rate: 'corrections',
  pause_ratio: 'pauses',
  pause_count: 'pauses',
  rhythm_cv: 'rhythm variance',
  rp_negative_ratio: 'key overlap',
};

export const prettyFeature = (f: string) => NAMES[f] ?? f.replace(/_/g, ' ');

interface ZBarsProps {
  items: [string, number][];
  /** z at which a bar reaches the edge of the track */
  max?: number;
  /** tailwind bg class for the bar */
  barClass?: string;
  emptyText?: string;
}

export const ZBars: React.FC<ZBarsProps> = ({ items, max = 3, barClass = 'bg-primary', emptyText = 'Nothing moved yet' }) => {
  if (!items.length) {
    return <p className="font-body text-xs text-on-surface-variant">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-space-sm">
      {items.map(([f, z]) => {
        const pct = Math.min(Math.abs(z) / max, 1) * 50;
        return (
          <li key={f} className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-space-sm">
            <span className="font-body text-xs text-on-surface-variant truncate" title={f}>{prettyFeature(f)}</span>
            <div className="relative h-2 rounded-full bg-surface-container-low overflow-hidden">
              <span className="absolute inset-y-0 left-1/2 w-px bg-outline-variant" />
              <div
                className={`absolute inset-y-0 rounded-full transition-all duration-500 ${barClass}`}
                style={z >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
              />
            </div>
            <AnimatedCounter value={z} decimals={1} prefix={z > 0 ? '+' : ''} suffix="σ" className="text-xs text-on-surface text-right" />
          </li>
        );
      })}
    </ul>
  );
};
