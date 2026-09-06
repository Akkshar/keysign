import React from 'react';
import { motion } from 'framer-motion';

export interface HealthCondition {
  id: string;
  name: string;
  nameLine2?: string;
  status: 'Stable' | 'Observation Suggested' | 'Monitor' | 'Observation';
  iconSvg: React.ReactNode;
  iconBgClass: string;
  iconTextClass: string;
  iconBorderClass: string;
  description: string;
  clinicalNotice?: string;
  biomarkers: string[];
  sampleDriftPct: string;
}

interface HealthSignalCardProps {
  condition: HealthCondition;
  onClick?: () => void;
}

export const HealthSignalCard: React.FC<HealthSignalCardProps> = ({ condition, onClick }) => {
  const isMonitor = condition.status === 'Monitor' || condition.status === 'Observation' || condition.status === 'Observation Suggested';

  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      onClick={onClick}
      className="group bg-white/90 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 border border-slate-200/70 dark:border-slate-800/80 hover:border-indigo-200/90 dark:hover:border-indigo-800/80 rounded-2xl p-4 transition-all duration-200 hover:shadow-md flex flex-col justify-between min-h-[160px] cursor-pointer"
      data-purpose="signal-card"
    >
      <div className="space-y-3">
        {/* Soft Pastel Glyph */}
        <div
          className={`w-9 h-9 rounded-xl ${condition.iconBgClass} ${condition.iconTextClass} flex items-center justify-center border ${condition.iconBorderClass}`}
        >
          {condition.iconSvg}
        </div>
        <h3 className="text-xs font-serif font-medium text-slate-800 dark:text-slate-100 leading-snug">
          {condition.name}
          {condition.nameLine2 && (
            <>
              <br />
              {condition.nameLine2}
            </>
          )}
        </h3>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isMonitor ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
            }`}
          />
          <span
            className={`text-[11px] font-medium ${
              isMonitor
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {condition.status}
          </span>
        </div>
        <span className="text-xs text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
          ›
        </span>
      </div>
    </motion.div>
  );
};
