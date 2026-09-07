import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useBiometrics } from '../../context/BiometricsContext';

interface StabilityCardProps {
  className?: string;
}

export const StabilityCard: React.FC<StabilityCardProps> = ({ className = '' }) => {
  const { isTyping, liveConfidence } = useBiometrics();
  const [randomHeights, setRandomHeights] = useState<number[]>([]);

  // 28 baseline rhythmic frequency bar heights
  const baseHeights = [
    12, 16, 28, 40, 48, 32, 20, 24, 44, 56, 40, 28, 16, 32,
    48, 64, 52, 36, 20, 28, 44, 56, 32, 20, 12, 24, 36, 16
  ];

  // When keystrokes arrive, dynamically modulate wave heights
  useEffect(() => {
    if (isTyping) {
      const modulated = baseHeights.map((h) => Math.min(Math.max(h + Math.floor(Math.random() * 20) - 8, 8), 64));
      setRandomHeights(modulated);
    } else {
      setRandomHeights(baseHeights);
    }
  }, [isTyping]);

  const score = Math.round(liveConfidence > 0 ? liveConfidence * 0.92 : 92);
  const radius = 40;
  const circumference = 2 * Math.PI * radius; // ~251.2
  const offset = circumference - (score / 100) * circumference;

  return (
    <section
      className={`glass-panel rounded-xl shadow-[0_4px_24px_-4px_rgba(15,23,42,0.04)] p-6 lg:p-7 border border-stone-200/80 dark:border-stone-800/80 transition-all ${className}`}
      data-purpose="primary-stability-card"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Circular Stability Score Gauge */}
        <div className="lg:col-span-5 flex items-center gap-6 pr-4 lg:border-r lg:border-stone-200/60 dark:lg:border-stone-800/60">
          {/* Circular Progress Ring SVG */}
          <div className="relative w-24 h-24 shrink-0 flex items-center justify-center" data-purpose="circular-score-gauge">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background Ring Track */}
              <circle
                className="text-stone-100 dark:text-stone-800"
                cx="50"
                cy="50"
                fill="transparent"
                r={radius}
                stroke="currentColor"
                strokeWidth="8"
              />
              {/* Active Progress Gradient Ring */}
              <motion.circle
                cx="50"
                cy="50"
                fill="transparent"
                r={radius}
                stroke="url(#stabilityGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ type: 'spring', stiffness: 50, damping: 14 }}
              />
              <defs>
                <linearGradient id="stabilityGradient" x1="0%" x2="100%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#6366F1" />
                </linearGradient>
              </defs>
            </svg>
            {/* Center Score Numeric Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
              <span className="text-2xl font-semibold tracking-tight text-stone-800 dark:text-stone-100 leading-none font-headline">
                {score}
              </span>
              <span className="text-[10px] text-stone-400 font-medium mt-0.5">/ 100</span>
            </div>
          </div>

          {/* Score Narrative & Stability Status */}
          <div className="space-y-1.5">
            <h2 className="text-base font-serif font-medium text-stone-900 dark:text-stone-100 leading-snug">
              Typing Pattern Stability
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed font-normal">
              Your current typing behavior is consistent with your personal baseline.
            </p>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-medium text-stone-700 dark:text-stone-300">Stable Baseline</span>
            </div>
            <span className="text-[10px] text-stone-400 dark:text-stone-500 block pt-0.5">
              Screening baseline • Not a diagnostic evaluation
            </span>
          </div>
        </div>

        {/* Right Column: Live Typing Timing Waveform */}
        <div className="lg:col-span-7 flex flex-col justify-between h-full pl-0 lg:pl-4 space-y-4" data-purpose="timing-waveform-visualizer">
          {/* Real-time Badge Indicator */}
          <div className="flex justify-end items-center gap-2">
            {isTyping && (
              <span className="text-[10px] font-telemetry text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded font-medium animate-pulse">
                LIVE KEYSTROKE INGESTION
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Real-time
            </span>
          </div>

          {/* Frequency / Interval Rhythm Waveform Bars */}
          <div
            aria-label="Keystroke interval rhythm visualization"
            className="h-16 flex items-center justify-between gap-[3px] px-2"
          >
            {(randomHeights.length > 0 ? randomHeights : baseHeights).map((h, i) => {
              const delay = (i * 0.05).toFixed(2);
              const isIndigo = h > 30;
              return (
                <span
                  key={i}
                  className={`wave-bar w-[3px] rounded-full transition-all duration-200 ${
                    isIndigo
                      ? h > 48
                        ? 'bg-amber-600 dark:bg-amber-400'
                        : 'bg-amber-400 dark:bg-amber-500'
                      : 'bg-stone-300 dark:bg-stone-700'
                  }`}
                  style={{
                    height: `${h}px`,
                    animationDelay: `${delay}s`,
                  }}
                />
              );
            })}
          </div>

          {/* Waveform Explanation Caption */}
          <div className="flex items-center justify-between text-[11px] text-stone-400 font-normal">
            <span>Live typing pattern (timing only)</span>
            <span className="font-telemetry text-[10px] text-on-surface-variant">One reading per key, in milliseconds</span>
          </div>
        </div>
      </div>
    </section>
  );
};
