import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useBiometrics } from '../../context/BiometricsContext';
import { KeystrokeTuple } from '../../types/biometrics';

/** Ink colour for one keystroke's verdict. Colour is a verdict, never decoration. */
export const STATUS_TONE: Record<KeystrokeTuple['status'], { bar: string; text: string; label: string }> = {
  VERIFIED: { bar: 'bg-primary dark:bg-primary-dark', text: 'text-primary dark:text-primary-dark', label: 'Verified' },
  CAUTION: { bar: 'bg-tertiary dark:bg-tertiary-dark', text: 'text-tertiary dark:text-tertiary-dark', label: 'Caution' },
  ANOMALOUS: { bar: 'bg-error dark:bg-error-dark', text: 'text-error dark:text-error-dark', label: 'Anomalous' },
  DURESS: { bar: 'bg-error dark:bg-error-dark', text: 'text-error dark:text-error-dark', label: 'Duress' },
};

/**
 * The last 20 keystrokes typed in this window: tall bar = how long the key
 * was held, short bar = the gap before it. Real timings, nothing simulated.
 */
export const WaterfallChart: React.FC = () => {
  const { recentPulses } = useBiometrics();
  const reduce = useReducedMotion();
  const pulses = recentPulses.slice(-20);
  const maxDwell = Math.max(180, ...pulses.map((p) => p.dwellMs));
  const maxFlight = Math.max(250, ...pulses.map((p) => p.flightMs));
  const seen = new Set(pulses.map((p) => p.status));

  return (
    <div className="bg-surface-container-lowest p-space-xl rounded-2xl border border-outline-variant/40">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-space-sm mb-space-lg">
        <div>
          <h3 className="font-serif text-lg font-medium text-on-surface">Hold and gap, key by key</h3>
          <p className="font-body text-xs text-on-surface-variant">
            Your last 20 keystrokes. Tall bar: how long the key was held. Short bar: the gap before it.
          </p>
        </div>
        <div className="flex items-center gap-space-md flex-wrap font-body text-[11px] text-on-surface-variant">
          {(Object.keys(STATUS_TONE) as KeystrokeTuple['status'][])
            .filter((s) => s === 'VERIFIED' || seen.has(s))
            .map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-sm ${STATUS_TONE[s].bar}`} />
                {STATUS_TONE[s].label}
              </span>
            ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex items-end justify-between gap-2 min-w-[560px] h-40 pt-space-md border-b border-outline-variant/40 px-1">
          {pulses.map((pulse, idx) => {
            const dwellH = Math.max(6, (pulse.dwellMs / maxDwell) * 100);
            const flightH = Math.max(4, (pulse.flightMs / maxFlight) * 70);
            const last = idx === pulses.length - 1;
            const tone = STATUS_TONE[pulse.status];
            return (
              <div key={pulse.id} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-9 z-20 pointer-events-none bg-surface-container-highest px-2 py-1 rounded shadow text-[10px] font-telemetry whitespace-nowrap text-on-surface">
                  {pulse.dwellMs} ms held · {pulse.flightMs} ms gap
                </div>
                <div className="w-full flex items-end justify-center gap-1 h-32">
                  <motion.div
                    initial={false}
                    animate={{ height: `${dwellH}%` }}
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 28 }}
                    className={`w-3 rounded-t ${tone.bar} ${last ? 'opacity-100' : 'opacity-70'}`}
                  />
                  <motion.div
                    initial={false}
                    animate={{ height: `${flightH}%` }}
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 28 }}
                    className={`w-2 rounded-t ${tone.bar} ${last ? 'opacity-50' : 'opacity-30'}`}
                  />
                </div>
                <span className="font-telemetry text-[9px] text-on-surface-variant">{pulse.dwellMs}</span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between pt-space-xs font-body text-[11px] text-on-surface-variant">
          <span>Earlier</span>
          <span>Latest</span>
        </div>
      </div>
    </div>
  );
};
