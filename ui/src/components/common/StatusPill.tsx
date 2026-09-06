import React from 'react';
import { motion } from 'framer-motion';

interface StatusPillProps {
  status: 'verified' | 'warning' | 'error' | 'info' | 'drift' | 'duress';
  label: string;
  dot?: boolean;
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  label,
  dot = true,
  className = '',
}) => {
  let bgClass = 'bg-secondary-container text-on-secondary-container';
  let dotClass = 'bg-secondary';

  if (status === 'warning' || status === 'drift') {
    bgClass = 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300/40';
    dotClass = 'bg-tertiary';
  } else if (status === 'error' || status === 'duress') {
    bgClass = 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300 border border-red-300/40';
    dotClass = 'bg-error';
  } else if (status === 'info') {
    bgClass = 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-300/40';
    dotClass = 'bg-primary';
  } else {
    // verified
    bgClass = 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40';
    dotClass = 'bg-secondary';
  }

  return (
    <motion.span
      layout
      initial={{ opacity: 0.8, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`inline-flex items-center gap-1.5 px-space-xs py-0.5 rounded text-[11px] font-telemetry font-semibold uppercase tracking-wider ${bgClass} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotClass} flex-shrink-0 animate-pulse`}></span>}
      <span>{label}</span>
    </motion.span>
  );
};
