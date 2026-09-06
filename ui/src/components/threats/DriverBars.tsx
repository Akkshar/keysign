import React from 'react';
import { AnimatedCounter } from '../common/AnimatedCounter';
import { featureLabel } from './featureLabels';

const RANGE = 4; // ±4σ fills the bar

/**
 * The features pulling the window furthest from the calm baseline, as signed
 * z-scores on a centred bar. Beyond ±3σ the bar turns red, ±2σ amber.
 */
export const DriverBars: React.FC<{ drivers: [string, number][] }> = ({ drivers }) => (
  <div className="flex flex-col gap-space-md">
    {drivers.map(([feature, z]) => {
      const mag = Math.min(1, Math.abs(z) / RANGE);
      const tone = Math.abs(z) >= 3 ? 'bg-error' : Math.abs(z) >= 2 ? 'bg-tertiary' : 'bg-on-surface-variant';
      return (
        <div key={feature} className="flex flex-col gap-space-xs">
          <div className="flex items-baseline justify-between">
            <span className="font-body text-sm text-on-surface">{featureLabel(feature)}</span>
            <span className="font-telemetry text-sm text-on-surface-variant">
              <AnimatedCounter value={z} decimals={1} prefix={z > 0 ? '+' : ''} suffix="σ" durationMs={400} />
            </span>
          </div>
          <div className="relative w-full h-1.5 rounded-full bg-surface-container">
            <span className="absolute left-1/2 top-0 bottom-0 w-px bg-outline-variant" />
            <div
              className={`absolute top-0 bottom-0 rounded-full transition-all duration-300 ease-out ${tone}`}
              style={z >= 0
                ? { left: '50%', width: `${mag * 50}%` }
                : { right: '50%', width: `${mag * 50}%` }}
            />
          </div>
        </div>
      );
    })}
  </div>
);
