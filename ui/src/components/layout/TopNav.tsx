import React, { useState } from 'react';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { useBiometrics } from '../../context/BiometricsContext';
import { HeaderControls } from './HeaderControls';
import { DetectionArea } from '../../types/biometrics';

/**
 * The top navigation from the new design, adapted.
 *
 * Theirs scrolls one long page to section anchors; ours switches views, so the tabs set the
 * active area instead. The seven sections a demo actually walks through sit in the bar and
 * the rest live under "More", so nothing became unreachable. The live controls to the right
 * live in HeaderControls, not a copy of the old header: the backend pill, Reset, the
 * theme toggle and whoever the machine is measuring against all have to keep working.
 */

const PRIMARY: { id: DetectionArea; label: string }[] = [
  { id: 'introduction', label: 'How it works' },
  { id: 'overview', label: 'Overview' },
  { id: 'monitoring', label: 'Live' },
  { id: 'identity', label: 'Identity' },
  { id: 'threats', label: 'Threats' },
  { id: 'health-signals', label: 'Health' },
  { id: 'settings', label: 'Settings' },
];

const MORE: { id: DetectionArea; label: string }[] = [
  { id: 'state', label: 'State' },
  { id: 'drift', label: 'Drift' },
  { id: 'history', label: 'History' },
  { id: 'privacy', label: 'Privacy & Architecture' },
  { id: 'live-demo', label: 'Presets & playground' },
];

export const TopNav: React.FC = () => {
  const { activeArea, setActiveArea } = useBiometrics();
  const [moreOpen, setMoreOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const inMore = MORE.some((m) => m.id === activeArea);

  const go = (id: DetectionArea) => {
    setActiveArea(id);
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const tab = (item: { id: DetectionArea; label: string }) => (
    <button
      key={item.id}
      type="button"
      onClick={() => go(item.id)}
      className={`relative px-2.5 py-1.5 rounded-md text-[12.5px] whitespace-nowrap transition-colors ${
        activeArea === item.id
          ? 'text-on-surface font-medium'
          : 'text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {activeArea === item.id && (
        <motion.span
          layoutId="topnav-active"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="absolute inset-0 rounded-md bg-on-surface/[0.07]"
        />
      )}
      <span className="relative">{item.label}</span>
    </button>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-outline-variant/70 bg-surface/85 backdrop-blur-md select-none theme-transition">
      <div className="max-w-[1600px] mx-auto pl-5 pr-4 lg:pl-8 h-16 flex items-center gap-4">
        {/* Brand */}
        <button type="button" onClick={() => go('introduction')} className="flex items-baseline gap-2 shrink-0 text-left">
          <span className="font-serif text-xl font-medium tracking-tight text-on-surface">KeySign</span>
          <span className="hidden 2xl:inline font-display italic text-[11px] text-outline">your typing tells a bigger story</span>
        </button>

        {/* Sections */}
        <nav className="flex-1 min-w-0 flex items-center gap-0.5 overflow-x-auto no-scrollbar" aria-label="Sections">
          {PRIMARY.map(tab)}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className={`px-3 py-1.5 rounded-md text-[13px] whitespace-nowrap transition-colors flex items-center gap-1 ${
                inMore ? 'text-on-surface font-medium bg-on-surface/[0.07]'
                       : 'text-on-surface-variant hover:text-on-surface'
              }`}
              aria-expanded={moreOpen}
            >
              {inMore ? (MORE.find((m) => m.id === activeArea)?.label ?? 'More') : 'More'}
              <span className="material-symbols-outlined text-[16px]">expand_more</span>
            </button>
            <AnimatePresence>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-0" onClick={() => setMoreOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-56 rounded-xl border border-outline-variant/80 bg-surface-container-lowest shadow-lg p-1.5 z-10"
                  >
                    {MORE.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => go(m.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors ${
                          activeArea === m.id
                            ? 'bg-on-surface/[0.07] text-on-surface font-medium'
                            : 'text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* The live controls, shared with the old sidebar header */}
        <div className="shrink-0">
          <HeaderControls />
        </div>
      </div>

      {/* How far down the page you are */}
      <motion.div className="h-[2px] bg-primary dark:bg-primary-dark origin-left" style={{ scaleX: progress }} />
    </header>
  );
};
