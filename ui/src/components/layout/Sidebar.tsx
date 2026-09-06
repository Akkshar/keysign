import React from 'react';
import { motion } from 'framer-motion';
import { useBiometrics } from '../../context/BiometricsContext';
import { DetectionArea } from '../../types/biometrics';

interface NavItem {
  id: DetectionArea;
  label: string;
  icon: string;
}

// One pipeline, four heads: Identity, State, Threats live; Drift is the roadmap chart.
const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'monitoring', label: 'Live Monitoring', icon: 'monitor_heart' },
  { id: 'identity', label: 'Identity', icon: 'fingerprint' },
  { id: 'state', label: 'State', icon: 'psychology' },
  { id: 'threats', label: 'Threats', icon: 'gpp_maybe' },
  { id: 'drift', label: 'Drift', icon: 'trending_up' },
  { id: 'health-signals', label: 'Health Signals', icon: 'vital_signs' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'privacy', label: 'Privacy & Architecture', icon: 'verified_user' },
];

export const Sidebar: React.FC = () => {
  const { activeArea, setActiveArea } = useBiometrics();

  return (
    <aside
      className="fixed left-0 top-0 h-full w-64 shrink-0 flex flex-col justify-between py-7 px-5 border-r border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/60 backdrop-blur-md select-none z-50 theme-transition"
      data-purpose="main-sidebar"
    >
      <div className="space-y-8">
        {/* Brand Header */}
        <div
          className="space-y-1.5 px-2 cursor-pointer group"
          onClick={() => setActiveArea('overview')}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white shadow-sm shadow-indigo-600/20">
              <span className="material-symbols-outlined text-[19px]">keyboard_alt</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-xl font-medium tracking-tight text-slate-900 dark:text-slate-100">
                KeySign
              </span>
              <span className="text-[10px] font-telemetry text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded font-medium">
                v2.1
              </span>
            </div>
          </div>
          <p className="text-xs font-serif text-slate-500 dark:text-slate-400 italic tracking-wide pl-0.5">
            Your typing tells a bigger story.
          </p>
        </div>

        {/* Navigation Items */}
        <nav aria-label="Primary Dashboard Navigation" className="space-y-1.5">
          {navItems.map((item) => {
            const isActive = activeArea === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => setActiveArea(item.id)}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/40'
                }`}
              >
                {/* Active Indicator Sliding Pill */}
                {isActive && (
                  <motion.div
                    layoutId="activeNavBackground"
                    className="absolute inset-0 bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-100/80 dark:border-indigo-800/50 rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] z-0"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}

                <span
                  className={`material-symbols-outlined text-[19px] relative z-10 transition-colors ${
                    isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="relative z-10 font-body text-xs lg:text-sm tracking-tight">{item.label}</span>
              </motion.button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Brand Footnote */}
      <div className="px-2 pt-6 border-t border-slate-200/50 dark:border-slate-800/50">
        <p className="text-xs font-serif text-slate-400 dark:text-slate-500 leading-snug">
          Typing for <br />
          <span className="text-slate-700 dark:text-slate-300 font-medium">A Healthier Tomorrow</span>
        </p>
        <div className="w-6 h-[2px] bg-indigo-500/60 rounded-full mt-2.5"></div>
      </div>
    </aside>
  );
};

