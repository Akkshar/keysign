import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { mockHealthConditions } from '../data/healthConditions';
import { HealthCondition } from '../components/health/HealthSignalCard';
import { MedicalDisclaimer } from '../components/health/MedicalDisclaimer';

type CategoryFilter = 'all' | 'neurodegenerative' | 'cognitive' | 'neuromuscular' | 'mood';

export const HealthSignalsView: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all');
  const [selectedCondition, setSelectedCondition] = useState<HealthCondition | null>(mockHealthConditions[0]);

  const filterCategory = (c: HealthCondition) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'neurodegenerative') return c.id === 'parkinsons' || c.id === 'alzheimers';
    if (activeFilter === 'cognitive') return c.id === 'mci' || c.id === 'alzheimers';
    if (activeFilter === 'neuromuscular') return c.id === 'ms';
    if (activeFilter === 'mood') return c.id === 'depression' || c.id === 'bipolar';
    return true;
  };

  const filtered = mockHealthConditions.filter(filterCategory);

  return (
    <div className="flex flex-col w-full gap-8 pb-12 select-none">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="text-xs font-mono tracking-wider uppercase text-indigo-600 dark:text-indigo-400 font-semibold">
            Clinical Behavioral Biomarkers
          </span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-slate-900 dark:text-slate-100">
          Health Signals
        </h1>
        <p className="font-body text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
          Continuous passive monitoring extracts micro-variations in finger release speed, hold duration entropy, and flight hesitation without recording message contents.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 dark:border-slate-800/70 pb-4">
        {[
          { id: 'all', label: 'All Signals (6)' },
          { id: 'neurodegenerative', label: 'Neurodegenerative' },
          { id: 'cognitive', label: 'Cognitive' },
          { id: 'neuromuscular', label: 'Neuromuscular' },
          { id: 'mood', label: 'Mood & Affect' },
        ].map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as CategoryFilter)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200/60 dark:border-slate-700/60'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Two Column Layout: Cards on Left, Deep-Dive on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Condition Cards List (5 cols) */}
        <div className="lg:col-span-5 space-y-3.5">
          <AnimatePresence mode="popLayout">
            {filtered.map((c) => {
              const isSelected = selectedCondition?.id === c.id;
              const isMonitor = c.status === 'Monitor' || c.status === 'Observation';

              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setSelectedCondition(c)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 border-indigo-400 dark:border-indigo-600 shadow-md ring-1 ring-indigo-400/30'
                      : 'bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl ${c.iconBgClass} ${c.iconTextClass} flex items-center justify-center border ${c.iconBorderClass} shrink-0`}
                      >
                        {c.iconSvg}
                      </div>
                      <div>
                        <h3 className="font-serif font-medium text-slate-900 dark:text-slate-100 text-sm">
                          {c.name} {c.nameLine2 || ''}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {c.sampleDriftPct}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 pt-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isMonitor ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
                        }`}
                      />
                      <span
                        className={`text-xs font-medium ${
                          isMonitor
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Right Column: Selected Condition Detail Pane (7 cols) */}
        <div className="lg:col-span-7">
          {selectedCondition ? (
            <motion.div
              key={selectedCondition.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm backdrop-blur-sm"
            >
              {/* Top Banner */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl ${selectedCondition.iconBgClass} ${selectedCondition.iconTextClass} flex items-center justify-center border ${selectedCondition.iconBorderClass}`}
                  >
                    {selectedCondition.iconSvg}
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl font-medium text-slate-900 dark:text-slate-100">
                      {selectedCondition.name} {selectedCondition.nameLine2 || ''}
                    </h2>
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                      Continuous Keystroke Kinematic Analysis
                    </span>
                  </div>
                </div>

                <div
                  className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                    selectedCondition.status === 'Monitor'
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      selectedCondition.status === 'Monitor' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                  <span>{selectedCondition.status} Tier</span>
                </div>
              </div>

              {/* Clinical Mechanism */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                  Biomechanical Mechanism
                </h4>
                <p className="font-body text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedCondition.description}
                </p>
              </div>

              {/* Monitored Biomarkers Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                  Key Biomarkers Extracted
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {selectedCondition.biomarkers.map((b, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60"
                    >
                      <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-medium">
                        BM-0{idx + 1}
                      </div>
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                        {b}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 30-Day Trend Visualizer */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                    30-Day Kinematic Variance
                  </span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                    {selectedCondition.sampleDriftPct}
                  </span>
                </div>

                {/* Micro-sparkline chart simulated bars */}
                <div className="h-20 w-full bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 flex items-end justify-between gap-1.5 border border-slate-200/50 dark:border-slate-700/50">
                  {[42, 45, 43, 44, 46, 48, 47, 45, 44, 43, 45, 46, 47, 48, 50, 49, 48, 47, 46, 45, 47, 48, 46, 45, 46, 44, 43, 45].map((val, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${val}%` }}
                      transition={{ duration: 0.4, delay: i * 0.015 }}
                      className={`w-full rounded-sm ${
                        selectedCondition.status === 'Monitor' && i > 20
                          ? 'bg-amber-400 dark:bg-amber-500'
                          : 'bg-indigo-400 dark:bg-indigo-500'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>30 Days Ago</span>
                  <span>Baseline Calibration</span>
                  <span>Today</span>
                </div>
              </div>

              {/* Scientific Grounding Note */}
              <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
                <span className="font-semibold">Research Foundation:</span> KeySign’s feature extraction pipelines align with published clinical trials evaluating timing latency entropy and motor deterioration in continuous keyboard usage.
              </div>
            </motion.div>
          ) : (
            <div className="p-12 text-center text-slate-400 font-serif">
              Select a health condition from the left to view detailed biomarkers.
            </div>
          )}
        </div>
      </div>

      {/* Statutory Medical Disclaimer */}
      <MedicalDisclaimer />
    </div>
  );
};
