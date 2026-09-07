import React from 'react';
import { IntroductionView } from './IntroductionView';
import { OverviewView } from './OverviewView';
import { IdentityView } from './IdentityView';
import { ThreatsView } from './ThreatsView';
import { HealthSignalsView } from './HealthSignalsView';

/**
 * The story, in one scroll: what KeySign is, then the live dashboard, who is typing, what the
 * Threat head is doing, and the research behind the health signals. Every section below the
 * introduction is the same live view its own tab opens, not a copy, so what a reviewer scrolls
 * past is the real thing reacting to real typing.
 *
 * The designers' version drove the navigation from a scroll listener. Here the tabs choose
 * which view renders, so a scroll listener that set the active area would unmount this page
 * out from under itself half way down. The dividers do the jumping instead.
 *
 * Live Monitoring is deliberately not in the flow: it owns a WebGL typewriter, and mounting
 * that alongside four other views costs frames for no gain.
 */

const SectionDivider: React.FC<{ title: string; targetId: string }> = ({ title, targetId }) => (
  <div className="w-full py-10 sm:py-14 flex items-center justify-center select-none">
    <div className="w-full flex items-center gap-4">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-stone-300 dark:via-stone-700 to-stone-400/40 dark:to-stone-600/40" />
      <button
        type="button"
        onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' })}
        className="px-4 py-1.5 rounded-md border border-stone-200 dark:border-stone-700 bg-white/80 dark:bg-stone-900/80 text-stone-600 dark:text-stone-400 font-telemetry text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm hover:border-stone-400 dark:hover:border-stone-600 hover:text-stone-900 dark:hover:text-stone-100 transition-all group"
      >
        <span>{title}</span>
        <span className="material-symbols-outlined text-sm text-stone-400 dark:text-stone-500 group-hover:text-stone-900 dark:group-hover:text-stone-100 transition-transform group-hover:translate-y-0.5">
          arrow_downward
        </span>
      </button>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-stone-300 dark:via-stone-700 to-stone-400/40 dark:to-stone-600/40" />
    </div>
  </div>
);

export const MainOverviewFlow: React.FC = () => (
  <div className="w-full flex flex-col">
    <section id="intro-section" className="w-full">
      <IntroductionView />
    </section>

    <SectionDivider title="The live dashboard" targetId="dashboard-section" />
    <section id="dashboard-section" className="w-full scroll-mt-24">
      <OverviewView />
    </section>

    <SectionDivider title="Who is typing" targetId="identity-section" />
    <section id="identity-section" className="w-full scroll-mt-24">
      <IdentityView />
    </section>

    <SectionDivider title="What the threat head sees" targetId="threats-section" />
    <section id="threats-section" className="w-full scroll-mt-24">
      <ThreatsView />
    </section>

    <SectionDivider title="The health signals, and the research" targetId="health-section" />
    <section id="health-section" className="w-full scroll-mt-24">
      <HealthSignalsView />
    </section>
  </div>
);
