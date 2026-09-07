import React, { useRef } from 'react';
import { useBiometrics } from '../context/BiometricsContext';
import { useTheme } from '../context/ThemeContext';
import { Interactive3DTypewriter } from '../components/3d/Interactive3DTypewriter';
import { StabilityCard } from '../components/health/StabilityCard';
import { HealthSignalCard } from '../components/health/HealthSignalCard';
import { MedicalDisclaimer } from '../components/health/MedicalDisclaimer';
import { mockHealthConditions } from '../data/healthConditions';
import { StrokeText } from '../components/motion/StrokeText';
import { Reveal, Swap } from '../components/motion/Reveal';
import { HoverBorderGradient } from '../components/motion/HoverBorderGradient';
import { AnimatedCounter } from '../components/common/AnimatedCounter';
import { DetectionArea } from '../types/biometrics';

const titleCase = (v: string) => v.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * The three-across telemetry band from the new design. Theirs showed a pattern-match
 * percentage derived from the length of the pulse list and a stability line that read
 * "±12ms" whoever was typing; these are the backend's own numbers, and they say
 * "waiting" when there is nothing to report rather than inventing a reading.
 */
const Band: React.FC = () => {
  const { live } = useBiometrics();
  const tick = live.tick;
  const idn = tick?.heads?.identity;
  const st = tick?.heads?.state;
  const distance = tick?.distance ?? null;
  const driver = tick?.top?.[0]?.[0];

  const confidence = typeof idn?.confidence === 'number' ? idn.confidence : null;
  const who = idn?.warming_up ? 'Identifying' : idn?.unknown ? 'Unknown' : idn?.user ? titleCase(idn.user) : null;
  const stateLabel = st?.label ? st.label.charAt(0).toUpperCase() + st.label.slice(1) : null;

  const cell = 'flex flex-col items-center text-center px-4 py-2';
  const label = 'font-telemetry text-[11px] uppercase tracking-widest text-on-surface-variant mb-1.5';
  const value = 'font-serif text-4xl sm:text-5xl font-medium tracking-tight text-on-surface tabular-nums leading-none';
  const note = 'font-serif italic text-xs text-on-surface-variant mt-2';

  return (
    <section className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0 border-y border-outline-variant/60 py-8">
        <div className={`${cell} sm:border-r sm:border-outline-variant/60`}>
          <span className={label}>Confidence</span>
          <Swap value={confidence == null ? 'none' : who ?? 'x'}>
            <span className={value}>
              {confidence == null ? '–' : `${Math.round(confidence * 100)}%`}
            </span>
          </Swap>
          <span className={note}>
            {who ? `that this is ${who}` : 'waiting for typing'}
          </span>
        </div>

        <div className={`${cell} sm:border-r sm:border-outline-variant/60`}>
          <span className={label}>Distance from baseline</span>
          <Swap value={distance == null ? 'none' : distance.toFixed(1)}>
            <span className={value}>{distance == null ? '–' : `${distance.toFixed(2)}σ`}</span>
          </Swap>
          <span className={note}>
            {driver ? `led by ${driver.replace(/_/g, ' ')}` : 'how far this window sits from the enrolled rhythm'}
          </span>
        </div>

        <div className={cell}>
          <span className={label}>State</span>
          <Swap value={stateLabel ?? 'none'}>
            <span className={`${value} text-3xl sm:text-4xl`}>{stateLabel ?? '–'}</span>
          </Swap>
          <span className={note}>
            {typeof st?.load === 'number' ? `cognitive load ${Math.round(st.load * 100)}/100` : 'no load score yet'}
          </span>
        </div>
      </div>
    </section>
  );
};

export const OverviewView: React.FC = () => {
  const { setActiveArea, live, userProfile, cognitiveState } = useBiometrics();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const headsRef = useRef<HTMLElement>(null);

  const stateLabel = live.tick?.heads?.state?.label;
  const threatLevel = live.tick?.heads?.threat?.level ?? 'none';

  // One line per head, from the latest tick. Plain words, no fake precision.
  // `key` is the verdict label: the line cross-fades when the verdict changes, not on every tick.
  const heads: { area: DetectionArea; name: string; question: string; key: string; live: React.ReactNode; tone: string }[] = [
    {
      area: 'identity',
      name: 'Identity',
      question: 'Who is typing?',
      key: live.tick ? userProfile.name : 'waiting',
      live: live.tick ? userProfile.name : 'Waiting for typing',
      tone: 'text-primary dark:text-primary-dark',
    },
    {
      area: 'state',
      name: 'State',
      question: 'What state are they in?',
      key: stateLabel ?? 'waiting',
      live: stateLabel ? (
        <>
          {stateLabel.charAt(0).toUpperCase() + stateLabel.slice(1)} · load{' '}
          <AnimatedCounter value={cognitiveState.cognitiveLoad} className="text-on-surface" />
          /100
        </>
      ) : 'Waiting for typing',
      tone: 'text-tertiary dark:text-tertiary-dark',
    },
    {
      area: 'threats',
      name: 'Threat',
      question: 'Is something wrong right now?',
      key: live.tick ? threatLevel : 'waiting',
      live: threatLevel === 'alert' ? 'Alert raised silently' : threatLevel === 'warn' ? 'Caution' : live.tick ? 'All clear' : 'Waiting for typing',
      tone: 'text-error dark:text-error-dark',
    },
    {
      area: 'drift',
      name: 'Drift',
      question: 'Is the baseline moving over weeks?',
      key: 'roadmap',
      live: 'Roadmap · needs weeks of data',
      tone: 'text-on-surface-variant',
    },
  ];

  return (
    <Reveal className="flex flex-col w-full gap-8 pb-12">
      {/* Thesis */}
      <section
        className="bg-surface-container-lowest border border-outline-variant/40 rounded-3xl p-6 sm:p-8 lg:p-10"
        data-purpose="hero-section"
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-5 max-w-2xl">
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

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-on-surface leading-[1.1]">
              Your typing is a signature. KeySign reads it.
            </h1>

            <p className="font-body text-sm sm:text-base text-on-surface-variant leading-relaxed">
              Everyone types with a rhythm: how long each key is held, the gap to the next one, where the
              pauses fall. KeySign turns that rhythm into one signal and asks it four questions: who is
              typing, what state they are in, whether something is wrong right now, and whether the pattern
              is drifting over time. Everything runs on this machine. Only timings are measured, never the words.
            </p>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
            <div className="flex flex-wrap items-center gap-3">
              <HoverBorderGradient
                onClick={() => setActiveArea('monitoring')}
                className="px-6 py-3 bg-primary text-white font-body font-medium text-sm flex items-center gap-2"
              >
                <span>Open the live lab</span>
                <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
              </HoverBorderGradient>
              <button
                onClick={() => headsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="px-6 py-3 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/40 font-body font-medium text-sm transition-colors cursor-pointer"
              >
                See the four heads
              </button>
            </div>
            <p className="font-body text-xs text-on-surface-variant flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${live.connected ? 'bg-secondary' : 'bg-outline-variant'}`} />
              <Swap value={String(live.connected)}>
                {live.connected ? 'Backend connected · scoring on this machine' : 'Start the backend: uv run python -m backend'}
              </Swap>
            </p>
          </div>
        </div>
      </section>

      <Band />

      {/* The environment */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="font-serif text-lg font-medium text-on-surface">The KeySign environment</h2>
          <span className="font-body text-xs text-on-surface-variant">
            Type anywhere: every key you press is scored on this machine
          </span>
        </div>
        <div className="relative w-full h-[480px] rounded-3xl bg-surface-container-low border border-outline-variant/40 overflow-hidden [&>div>div:first-child]:!h-[480px]">
          <Interactive3DTypewriter className="w-full" />
        </div>
      </section>

      {/* One pipeline, four heads */}
      <section ref={headsRef} className="space-y-3 scroll-mt-28">
        <div className="px-1">
          <h2 className="font-serif text-lg font-medium text-on-surface">One signal, four questions</h2>
          <p className="font-body text-xs text-on-surface-variant">
            The same features feed four heads. Each line below is the latest verdict from the backend.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {heads.map((h) => (
            <button
              key={h.area}
              onClick={() => setActiveArea(h.area)}
              className="text-left bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 hover:bg-surface-container-low transition-colors cursor-pointer space-y-2"
            >
              <span className={`font-telemetry text-[11px] uppercase tracking-wider ${h.tone}`}>{h.name}</span>
              <p className="font-serif text-base font-medium text-on-surface leading-snug">{h.question}</p>
              <Swap value={h.key} className="font-body text-xs text-on-surface-variant">
                {h.live}
              </Swap>
            </button>
          ))}
        </div>
      </section>

      {/* Stability (live) and screening signals (illustrative) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <div className="lg:col-span-5">
          <StabilityCard className="h-full" />
        </div>

        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="flex items-baseline justify-between px-1 gap-4">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h2 className="font-serif text-lg font-medium text-on-surface">Screening signals</h2>
              <span className="font-body text-xs text-on-surface-variant">
                (roadmap · illustrative, not computed from your data)
              </span>
            </div>
            <button
              onClick={() => setActiveArea('health-signals')}
              className="font-body text-xs font-medium text-primary dark:text-primary-dark hover:underline flex items-center gap-0.5 cursor-pointer shrink-0"
            >
              <span>Details</span>
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

          <p className="font-body text-[11px] text-on-surface-variant px-1">
            These are the kinds of long-term shifts the drift head is meant to surface once there is
            weeks of data. They are a screening idea, not a diagnosis, and nothing here is measured from
            you today.
          </p>
        </div>
      </section>

      <MedicalDisclaimer onLearnMore={() => setActiveArea('privacy')} />
    </Reveal>
  );
};
