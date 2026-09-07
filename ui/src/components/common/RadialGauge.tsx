import React from 'react';
import { motion } from 'framer-motion';

interface RadialGaugeProps {
  score: number; // 0 - 100
  size?: number;
  strokeWidth?: number;
  label?: string;
  verdict?: string;
  subtext?: string;
  className?: string;
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({
  score,
  size = 180,
  strokeWidth = 9,
  label = 'Confidence',
  verdict,
  subtext,
  className = '',
}) => {
  const radius = 50;
  const circumference = 2 * Math.PI * radius; // ~314.16
  const offset = circumference - (Math.min(Math.max(score, 0), 100) / 100) * circumference;

  const getColorClass = () => {
    if (score >= 85) return 'text-secondary';
    if (score >= 60) return 'text-tertiary';
    return 'text-error';
  };

  const getStrokeHex = () => {
    if (score >= 85) return '#059669'; // secondary emerald
    if (score >= 60) return '#d97706'; // tertiary amber
    return '#dc2626'; // error red
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* Subtle decorative scanner halo */}
        <div
          className="absolute inset-2 rounded-full border border-primary/10 dark:border-primary/20 pointer-events-none animate-ping-slow opacity-40"
        />

        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          {/* Background circle track */}
          <circle
            className="text-surface-container-high stroke-current opacity-40"
            cx="60"
            cy="60"
            fill="none"
            r={radius}
            strokeWidth={strokeWidth}
          />
          {/* Animated active score ring using Framer Motion */}
          <motion.circle
            className={`${getColorClass()} stroke-current`}
            cx="60"
            cy="60"
            fill="none"
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ type: 'spring', stiffness: 45, damping: 12 }}
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
          <motion.span
            key={score.toFixed(0)}
            initial={{ scale: 0.94 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="font-telemetry text-3xl font-bold text-on-surface tracking-tight"
          >
            {score.toFixed(1)}%
          </motion.span>
          {label && (
            <span className="font-headline text-[11px] text-on-surface-variant uppercase font-semibold tracking-wider mt-0.5">
              {label}
            </span>
          )}
          {subtext && (
            <span className="text-[10px] text-on-surface-variant opacity-80 mt-0.5">
              {subtext}
            </span>
          )}
        </div>
      </div>
      {verdict && (
        <div className="mt-space-sm flex items-center gap-space-xs px-space-md py-space-xs bg-surface-container-low rounded-full border border-outline-variant text-xs font-headline font-semibold text-on-surface">
          <span className={`material-symbols-outlined text-[16px] ${getColorClass()}`}>
            {score >= 85 ? 'verified' : score >= 60 ? 'warning' : 'dangerous'}
          </span>
          <span>{verdict}</span>
        </div>
      )}
    </div>
  );
};
