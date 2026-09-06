import React from 'react';
import { motion } from 'framer-motion';
import { useBiometrics } from '../context/BiometricsContext';
import { useTheme } from '../context/ThemeContext';
import { Interactive3DTypewriter } from '../components/3d/Interactive3DTypewriter';
import { StabilityCard } from '../components/health/StabilityCard';
import { HealthSignalCard } from '../components/health/HealthSignalCard';
import { MedicalDisclaimer } from '../components/health/MedicalDisclaimer';
import { mockHealthConditions } from '../data/healthConditions';
import { StrokeText } from '../components/motion/StrokeText';

export const OverviewView: React.FC = () => {
  const { setActiveArea } = useBiometrics();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="flex flex-col w-full gap-8 lg:gap-10 pb-12 select-none">
      {/* 1. Grand Hero Section with Full-Width Spacious Typewriter Arena Box */}
      <section
        className="relative bg-gradient-to-br from-white/95 via-slate-50/85 to-indigo-50/40 dark:from-slate-900/95 dark:via-slate-900/80 dark:to-indigo-950/30 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 lg:p-10 overflow-hidden shadow-sm backdrop-blur-sm theme-transition space-y-8"
        data-purpose="hero-section"
      >
        {/* Subtle Ambient Radial Glows */}
        <div className="absolute -right-24 -top-24 w-[32rem] h-[32rem] bg-indigo-300/20 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-[28rem] h-[28rem] bg-sky-200/20 dark:bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header: Editorial Headline, Mission & Quick Actions */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 relative z-10 border-b border-slate-200/60 dark:border-slate-800/60 pb-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50/90 dark:bg-indigo-950/70 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse" />
              <span>Neurological & Mental Health Behavioral Biomarkers</span>
            </div>

            <div className="w-52 sm:w-64 -ml-1">
              <StrokeText
                text="KEYSIGN"
                fontSize={38}
                strokeColor={isDark ? '#38bdf8' : '#4f46e5'}
                fillColor={isDark ? '#e0f2fe' : '#312e81'}
                strokeWidth={1.5}
                drawDuration={1.2}
                fillMode="wipe"
              />
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-slate-900 dark:text-slate-100 leading-[1.15]">
              More than words.
            </h1>

            <p className="font-body text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              We screen subtle variations in typing kinetics to highlight potential motor and cognitive patterns — privately and in real time, so you can consult a physician early.
            </p>

            <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 font-body">
              <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">
                lock
              </span>
              <span>Keystroke content is never recorded • 100% On-Device Enclave</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveArea('monitoring')}
              className="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-medium text-sm shadow-sm shadow-indigo-600/25 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>Live Keystroke Lab</span>
              <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveArea('health-signals')}
              className="px-6 py-3 rounded-full bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 font-medium text-sm transition-colors cursor-pointer"
            >
              Explore Signals
            </motion.button>
          </div>
        </div>

        {/* The Grand Typewriter Box: Expansive, Full-Width Luxury Showcase */}
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="font-serif text-base font-medium text-slate-800 dark:text-slate-200">
                Kinematic Typewriter Arena
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-medium">
                Full QWERTY Physical Synchronization
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-serif italic hidden sm:inline">
              Type on your keyboard to strike keys & ink the rolled paper
            </span>
          </div>

          {/* Grand Box Container */}
          <div className="relative w-full min-h-[560px] sm:min-h-[640px] lg:min-h-[720px] xl:min-h-[760px] rounded-3xl bg-gradient-to-b from-slate-100/70 via-slate-50/50 to-indigo-50/30 dark:from-slate-800/60 dark:via-slate-900/60 dark:to-slate-950/70 border border-slate-200/90 dark:border-slate-800/90 shadow-lg shadow-indigo-950/5 overflow-hidden flex items-center justify-center">
            <Interactive3DTypewriter className="w-full h-full" />
          </div>
        </div>
      </section>

      {/* 2. Main Dashboard Section: Stability Ring & 6 Health Condition Signals */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column (5 cols): Stability Card */}
        <div className="lg:col-span-5">
          <StabilityCard />
        </div>

        {/* Right Column (7 cols): Health Condition Signal Cards Grid */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-medium text-slate-900 dark:text-slate-100">
                Monitored Screening Signals
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                (roadmap · illustrative, not computed from your data)
              </span>
            </div>
            <button
              onClick={() => setActiveArea('health-signals')}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>View details</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
            {mockHealthConditions.map((condition) => (
              <HealthSignalCard
                key={condition.id}
                condition={condition}
                onClick={() => setActiveArea('health-signals')}
              />
            ))}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic px-1">
            * Screening signals indicate statistical timing fluctuations. They are not medical diagnoses. If unusual patterns persist, formal clinical testing with a healthcare professional is strongly recommended.
          </p>
        </div>
      </section>

      {/* 3. Zero-Knowledge Privacy Architecture Pillar */}
      <section className="relative rounded-2xl p-6 sm:p-8 bg-white/70 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/70 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <p className="text-[11px] font-mono uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-semibold">
              Zero-Knowledge Verification
            </p>
            <h3 className="font-serif text-xl font-medium text-slate-900 dark:text-slate-100">
              Private by Design • Zero Keystroke Logging
            </h3>
            <p className="font-body text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Your keystroke content (words, passwords, messages) is never captured, stored, or sent to any server. KeySign only measures micro-timing flight and dwell latencies in volatile device memory.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px]">
                memory
              </span>
              <div className="text-left">
                <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200">Local Enclave</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">100% On-Device</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-[18px]">
                timer
              </span>
              <div className="text-left">
                <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200">Timing Deltas Only</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Hold & Flight Δt</div>
              </div>
            </div>

            <button
              onClick={() => setActiveArea('privacy')}
              className="px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 text-xs font-medium transition-colors cursor-pointer"
            >
              Inspect Specs ›
            </button>
          </div>
        </div>
      </section>

      {/* 4. Clinical Statutory Disclaimer */}
      <MedicalDisclaimer />
    </div>
  );
};
