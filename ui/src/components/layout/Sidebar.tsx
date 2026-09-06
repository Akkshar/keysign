import React from 'react';
import { useBiometrics } from '../../context/BiometricsContext';
import { DetectionArea } from '../../types/biometrics';
import { LineSidebar } from './LineSidebar';

interface NavItem {
  id: DetectionArea;
  label: string;
}

// One pipeline, four heads: Identity, State, Threats live; Drift is the roadmap chart.
const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'monitoring', label: 'Live Monitoring' },
  { id: 'identity', label: 'Identity' },
  { id: 'state', label: 'State' },
  { id: 'threats', label: 'Threats' },
  { id: 'drift', label: 'Drift' },
  { id: 'health-signals', label: 'Health Signals' },
  { id: 'history', label: 'History' },
  { id: 'privacy', label: 'Privacy & Architecture' },
];

export const Sidebar: React.FC = () => {
  const { activeArea, setActiveArea } = useBiometrics();

  const activeIndex = navItems.findIndex((item) => item.id === activeArea);

  return (
    <aside
      className="fixed left-0 top-0 h-full w-64 shrink-0 flex flex-col justify-between py-7 px-5 border-r border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md select-none z-50 theme-transition"
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

        {/* React Bits LineSidebar Navigation */}
        <div className="pt-2">
          <LineSidebar
            items={navItems.map((item) => item.label)}
            active={activeIndex >= 0 ? activeIndex : 0}
            onItemClick={(idx) => {
              if (navItems[idx]) setActiveArea(navItems[idx].id);
            }}
          />
        </div>
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


