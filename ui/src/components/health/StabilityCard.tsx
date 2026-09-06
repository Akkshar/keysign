import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useBiometrics } from '../../context/BiometricsContext';
import { AnimatedCounter } from '../common/AnimatedCounter';
import { RhythmStrip } from '../common/RhythmStrip';
import { CardSpotlight } from '../motion/CardSpotlight';
import { Swap } from '../motion/Reveal';

interface StabilityCardProps {
  className?: string;
}

/**
 * How closely the current typing matches the declared user's calm baseline.
 * Score = 100 - 20 * (sigma distance from the backend tick), clamped.
 */
export const StabilityCard: React.FC<StabilityCardProps> = ({ className = '' }) => {
  const { liveConfidence, live } = useBiometrics();
  const reduce = useReducedMotion();

  const d = live.tick?.distance ?? null; // sigma distance from the declared user's calm baseline
  const score = d != null
    ? Math.round(Math.min(100, Math.max(0, 100 - d * 20)))
    : Math.round(liveConfidence > 0 ? liveConfidence * 0.92 : 92);
  const who = live.declaredUser || 'the declared user';

  const verdict = d == null
    ? {
        label: 'No sample yet',
        text: `Waiting for typing. The ring shows how closely the rhythm matches ${who}'s calm baseline.`,
        ink: 'text-outline-variant',
        dot: 'bg-outline-variant',
      }
    : score >= 70
    ? {
        label: 'Stable',
        text: `Consistent with ${who}'s baseline, ${d.toFixed(1)} sigma away.`,
        ink: 'text-secondary dark:text-secondary-dark',
        dot: 'bg-secondary dark:bg-secondary-dark',
      }
    : score >= 40
    ? {
        label: 'Drifting',
        text: `Drifting from ${who}'s baseline, ${d.toFixed(1)} sigma away. Could be load, fatigue or a different keyboard.`,
        ink: 'text-tertiary dark:text-tertiary-dark',
        dot: 'bg-tertiary dark:bg-tertiary-dark',
      }
    : {
        label: 'Off baseline',
        text: `Does not match ${who}'s baseline, ${d.toFixed(1)} sigma away. Either a different person or a very different state.`,
        ink: 'text-error dark:text-error-dark',
        dot: 'bg-error dark:bg-error-dark',
      };

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <CardSpotlight className={className}>
      <section
        className="bg-surface-container-lowest rounded-2xl p-6 lg:p-7 border border-outline-variant/40 h-full flex flex-col gap-6"
        data-purpose="primary-stability-card"
      >
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24 shrink-0 flex items-center justify-center" data-purpose="circular-score-gauge">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle className="text-surface-container-high" cx="50" cy="50" fill="transparent" r={radius} stroke="currentColor" strokeWidth="8" />
              <motion.circle
                className={verdict.ink}
                cx="50"
                cy="50"
                fill="transparent"
                r={radius}
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={false}
                animate={{ strokeDashoffset: offset }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 50, damping: 14 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <AnimatedCounter value={score} className="text-2xl font-medium text-on-surface leading-none" />
              <span className="text-[10px] text-on-surface-variant mt-0.5">/ 100</span>
            </div>
          </div>

          <div className="space-y-1.5 min-w-0">
            <h2 className="font-serif text-lg font-medium text-on-surface leading-snug">Typing stability</h2>
            <p className="font-body text-xs text-on-surface-variant leading-relaxed">{verdict.text}</p>
            <div className="flex items-center gap-1.5 pt-1">
              <span className={`w-2 h-2 rounded-full ${verdict.dot}`} />
              <Swap value={verdict.label} className="text-xs font-medium text-on-surface">
                {verdict.label}
              </Swap>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <RhythmStrip bars={40} height={48} className="w-full [&>span]:flex-1" />
          <p className="font-body text-[11px] text-on-surface-variant">
            Your last 40 keystrokes. Height is the gap between keys, ink is how long each was held.
          </p>
        </div>
      </section>
    </CardSpotlight>
  );
};
