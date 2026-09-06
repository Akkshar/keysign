import React from 'react';
import { motion } from 'framer-motion';
import { useBiometrics } from '../../context/BiometricsContext';

export const WaterfallChart: React.FC = () => {
  const { recentPulses } = useBiometrics();

  return (
    <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm border border-surface-container mb-space-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-lg">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-primary text-[22px]">waterfall_chart</span>
          <div>
            <h3 className="font-headline text-base font-semibold text-on-surface">
              Keystroke Timing Waterfall Graph
            </h3>
            <p className="font-body text-xs text-on-surface-variant">
              Last 20 Key Pulses: Visualizing hold duration (bars) &amp; flight gaps. Content is entirely masked.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-space-md flex-wrap">
          <div className="flex items-center gap-space-2xs">
            <span className="w-3 h-3 bg-primary rounded"></span>
            <span className="font-telemetry text-xs text-on-surface-variant">Dwell Interval (ms)</span>
          </div>
          <div className="flex items-center gap-space-2xs">
            <span className="w-3 h-3 bg-secondary rounded"></span>
            <span className="font-telemetry text-xs text-on-surface-variant">Flight Latency (ms)</span>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-low p-space-lg rounded-xl overflow-x-auto border border-surface-container">
        <div className="flex items-end justify-between gap-2 min-w-[650px] h-44 pt-space-lg pb-space-xs border-b border-surface-container px-2">
          {recentPulses.map((pulse, idx) => {
            // Normalize heights
            const dwellHeight = Math.min(Math.max((pulse.dwellMs / 180) * 100, 15), 100);
            const flightHeight = Math.min(Math.max((pulse.flightMs / 250) * 80, 10), 80);
            const isLatest = idx === recentPulses.length - 1;

            return (
              <div key={pulse.id + '-' + idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                {/* Tooltip on hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 pointer-events-none bg-surface-container-highest px-2 py-1 rounded shadow text-[10px] font-telemetry whitespace-nowrap text-on-surface">
                  Dwell: {pulse.dwellMs}ms | Flight: {pulse.flightMs}ms
                </div>

                <div className="w-full flex items-end justify-center gap-1 h-36 relative">
                  {/* Active ping ring on latest pulse */}
                  {isLatest && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-secondary animate-ping" />
                  )}

                  {/* Dwell bar */}
                  <motion.div
                    initial={{ height: '0%' }}
                    animate={{ height: `${dwellHeight}%` }}
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                    className={`w-3.5 rounded-t ${
                      pulse.status === 'DURESS'
                        ? 'bg-error'
                        : pulse.status === 'ANOMALOUS'
                        ? 'bg-tertiary'
                        : isLatest
                        ? 'bg-primary shadow-[0_0_8px_rgba(29,78,216,0.4)]'
                        : 'bg-primary/80 group-hover:bg-primary'
                    }`}
                  />
                  {/* Flight bar */}
                  <motion.div
                    initial={{ height: '0%' }}
                    animate={{ height: `${flightHeight}%` }}
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                    className={`w-2.5 rounded-t ${
                      pulse.status === 'DURESS'
                        ? 'bg-error/60'
                        : pulse.status === 'ANOMALOUS'
                        ? 'bg-tertiary/60'
                        : 'bg-secondary/70 group-hover:bg-secondary'
                    }`}
                  />
                </div>
                <span className="font-telemetry text-[9px] text-on-surface-variant">
                  {pulse.dwellMs}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-space-sm text-outline font-telemetry text-xs">
          <span>← Earlier Pulses [t-20]</span>
          <span className="text-secondary font-medium">Relative Microsecond Stream • Local Memory</span>
          <span>Latest Pulse [t-0] →</span>
        </div>
      </div>
    </div>
  );
};
