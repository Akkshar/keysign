import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useBiometrics } from '../../context/BiometricsContext';

/**
 * The signature: the last ~40 real inter-key intervals as a tiny bar strip.
 * Each bar is one keystroke: height = flight time (release to next press),
 * ink = dwell (how long the key was held). It beats while you type and goes
 * still when you stop. Real timings from this window, nothing simulated.
 */
export const RhythmStrip: React.FC<{ bars?: number; height?: number; className?: string }> = ({
  bars = 40,
  height = 22,
  className = '',
}) => {
  const { recentPulses, isTyping } = useBiometrics();
  const reduce = useReducedMotion();
  const recent = recentPulses.slice(-bars);
  const maxFlight = Math.max(160, ...recent.map((p) => p.flightMs));
  return (
    <div
      className={`flex items-end gap-[2px] ${className}`}
      style={{ height }}
      aria-label="Your last keystrokes: bar height is the gap between keys, ink is how long each key was held"
      title="Your rhythm: bar height = gap between keys, ink = key hold time"
    >
      {recent.map((p, i) => {
        const h = Math.max(2, Math.min(1, p.flightMs / maxFlight) * height);
        const ink = Math.min(1, Math.max(0.25, p.dwellMs / 160));
        const last = i === recent.length - 1;
        return (
          <motion.span
            key={p.id}
            initial={reduce ? false : { height: 2, opacity: 0.3 }}
            animate={{ height: h, opacity: isTyping || last ? 0.35 + ink * 0.65 : 0.25 + ink * 0.45 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className={`w-[3px] rounded-sm ${
              p.status === 'DURESS' || p.status === 'ANOMALOUS' ? 'bg-error' : p.status === 'CAUTION' ? 'bg-tertiary' : 'bg-primary dark:bg-primary-dark'
            } ${last && isTyping ? 'shadow-[0_0_8px_rgba(99,102,241,0.7)]' : ''}`}
          />
        );
      })}
    </div>
  );
};
