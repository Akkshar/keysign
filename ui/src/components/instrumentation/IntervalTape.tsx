import React from 'react';
import { KeystrokeTuple } from '../../types/biometrics';

interface IntervalTapeProps {
  pulses: KeystrokeTuple[];
  liveDwell: number;
  liveFlight: number;
  isTyping: boolean;
  className?: string;
}

export const IntervalTape: React.FC<IntervalTapeProps> = ({
  pulses,
  liveDwell,
  liveFlight,
  isTyping,
  className = '',
}) => {
  // Take last 28 pulses for the physical tape ribbon
  const visiblePulses = pulses.slice(-28);

  return (
    <div
      className={`w-full max-w-4xl mx-auto flex flex-col gap-2 select-none ${className}`}
      data-purpose="scientific-interval-tape"
    >
      {/* Top Tape Calibration Header */}
      <div className="flex items-center justify-between text-[11px] font-mono tracking-wider text-stone-500 dark:text-stone-400 px-1">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500" />
          <span className="uppercase font-semibold tracking-widest text-stone-700 dark:text-stone-300">
            Chronometer Interval Stream
          </span>
          <span className="text-stone-400 dark:text-stone-600">•</span>
          <span className="text-stone-500">10ms / tick div</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="tabular-nums">
            <span className="text-stone-400 mr-1">HOLD</span>
            <strong className="text-stone-800 dark:text-stone-200 font-semibold">{liveDwell || 82}ms</strong>
          </span>
          <span className="text-stone-300 dark:text-stone-700">|</span>
          <span className="tabular-nums">
            <span className="text-stone-400 mr-1">FLIGHT</span>
            <strong className="text-stone-800 dark:text-stone-200 font-semibold">{liveFlight || 114}ms</strong>
          </span>
          {isTyping && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/50">
              <span className="w-1 h-1 rounded-full bg-amber-600 animate-ping" />
              SENSING
            </span>
          )}
        </div>
      </div>

      {/* The Physical Paper Ticker Ribbon */}
      <div className="relative w-full h-20 rounded-md bg-[#fdfcf9] dark:bg-[#181816] border border-stone-300/80 dark:border-stone-800 shadow-[inset_0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex items-center px-4">
        {/* Subtle Horizontal Reference Grid Lines */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between py-2 px-3 opacity-30">
          <div className="w-full border-b border-dashed border-stone-400 dark:border-stone-600 text-[8px] font-mono text-stone-400 dark:text-stone-500 leading-none">
            150ms
          </div>
          <div className="w-full border-b border-dashed border-stone-400 dark:border-stone-600 text-[8px] font-mono text-stone-400 dark:text-stone-500 leading-none">
            100ms
          </div>
          <div className="w-full border-b border-stone-400 dark:border-stone-600 text-[8px] font-mono text-stone-400 dark:text-stone-500 leading-none">
            50ms baseline
          </div>
        </div>

        {/* Live Keystroke Ticks on Paper Tape */}
        <div className="relative z-10 w-full h-full flex items-end justify-end gap-1.5 sm:gap-2.5 pb-2.5 overflow-hidden">
          {visiblePulses.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs font-mono text-stone-400 dark:text-stone-500 italic">
              Awaiting physical keystrokes to chart interval dispersion...
            </div>
          ) : (
            visiblePulses.map((pulse, index) => {
              // Scale height linearly based on dwell time (range 30ms - 180ms -> 12px - 54px)
              const clampedDwell = Math.min(Math.max(pulse.dwellMs, 30), 180);
              const heightPx = Math.round(12 + ((clampedDwell - 30) / 150) * 44);

              const isRecent = index === visiblePulses.length - 1;
              const isCaution = pulse.dwellMs > 135 || pulse.flightMs > 240;

              return (
                <div
                  key={pulse.id}
                  className="flex flex-col items-center gap-1 shrink-0 group transition-all duration-150"
                  title={`Dwell: ${pulse.dwellMs}ms | Flight: ${pulse.flightMs}ms`}
                >
                  {/* Subtle hover tooltip readout */}
                  <span className="opacity-0 group-hover:opacity-100 text-[9px] font-mono text-stone-600 dark:text-stone-300 transition-opacity absolute -top-1 pointer-events-none">
                    {pulse.dwellMs}ms
                  </span>

                  {/* Vertical Scientific Mark (Ink Stroke on Paper) */}
                  <div
                    style={{ height: `${heightPx}px` }}
                    className={`w-[2px] sm:w-[2.5px] rounded-sm transition-all duration-150 ${
                      isCaution
                        ? 'bg-amber-600 dark:bg-amber-500'
                        : isRecent
                        ? 'bg-stone-900 dark:bg-stone-100 ring-2 ring-stone-900/20'
                        : 'bg-stone-700/80 dark:bg-stone-400/80'
                    }`}
                  />

                  {/* Baseline Chrono Dot */}
                  <span
                    className={`w-1 h-1 rounded-full ${
                      isCaution
                        ? 'bg-amber-600 dark:bg-amber-400'
                        : isRecent
                        ? 'bg-stone-900 dark:bg-stone-100'
                        : 'bg-stone-300 dark:bg-stone-600'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Subtle Paper Edge Shadow / Tape Stamp */}
        <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#fdfcf9] dark:from-[#181816] to-transparent pointer-events-none" />
      </div>

      {/* Under-tape Technical Footnote */}
      <div className="flex items-center justify-between text-[10px] font-mono text-stone-400 dark:text-stone-500 px-1">
        <span>Vertical stroke height: key hold duration (dwell). Spacing: inter-key flight latency.</span>
        <span className="hidden sm:inline">Zero semantic content retained</span>
      </div>
    </div>
  );
};
