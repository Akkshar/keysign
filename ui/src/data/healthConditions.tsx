import React from 'react';
import { HealthCondition } from '../components/health/HealthSignalCard';

export const mockHealthConditions: HealthCondition[] = [
  {
    id: 'parkinsons',
    name: "Parkinson's",
    nameLine2: 'Disease',
    status: 'Stable',
    iconBgClass: 'bg-rose-50 dark:bg-rose-950/40',
    iconTextClass: 'text-rose-500',
    iconBorderClass: 'border-rose-100/60 dark:border-rose-900/40',
    description: 'Tracks micro-tremors in key dwell releases and sub-second flight latency variance indicative of early motor bradykinesia.',
    biomarkers: ['Hold Duration Jitter', 'Release Asymmetry', 'Keypress Acceleration (g)'],
    sampleDriftPct: '+0.4% baseline',
    iconSvg: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'mci',
    name: 'Mild Cognitive',
    nameLine2: 'Impairment',
    status: 'Stable',
    iconBgClass: 'bg-sky-50 dark:bg-sky-950/40',
    iconTextClass: 'text-sky-500',
    iconBorderClass: 'border-sky-100/60 dark:border-sky-900/40',
    description: 'Monitors cognitive pause durations before multi-syllabic lexical boundaries and hesitation patterns in flight intervals.',
    biomarkers: ['Lexical Pause Threshold', 'Digraph Hesitation Index', 'Cadence Entropy'],
    sampleDriftPct: '+1.1% nominal',
    iconSvg: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'alzheimers',
    name: "Alzheimer's",
    nameLine2: 'Disease',
    status: 'Stable',
    iconBgClass: 'bg-purple-50 dark:bg-purple-950/40',
    iconTextClass: 'text-purple-500',
    iconBorderClass: 'border-purple-100/60 dark:border-purple-900/40',
    description: 'Detects longitudinal syntax entropy degradation and spatial disorientation reflected in repeated navigation key patterns.',
    biomarkers: ['Sequential Transition Decay', 'Longitudinal Motor Drift', 'Spatial Search Index'],
    sampleDriftPct: '-0.2% variance',
    iconSvg: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.516 0c.85.493 1.508 1.333 1.508 2.316V18" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'ms',
    name: 'Multiple',
    nameLine2: 'Sclerosis',
    status: 'Monitor',
    iconBgClass: 'bg-teal-50 dark:bg-teal-950/40',
    iconTextClass: 'text-teal-600',
    iconBorderClass: 'border-teal-100/60 dark:border-teal-900/40',
    description: 'Tracks intermittent muscle fatigue spikes where mean dwell time elongates significantly across sustained typing sessions.',
    biomarkers: ['Fatigue Dwell Creep', 'Flight Asynchrony', 'Saccadic Typing Hesitation'],
    sampleDriftPct: '+4.8% (Observation tier)',
    iconSvg: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'depression',
    name: 'Depression',
    nameLine2: '',
    status: 'Stable',
    iconBgClass: 'bg-orange-50 dark:bg-orange-950/40',
    iconTextClass: 'text-rose-500',
    iconBorderClass: 'border-orange-100/60 dark:border-orange-900/40',
    description: 'Analyzes psychomotor retardation and prolonged inter-word dwell pauses reflecting clinical changes in affective state.',
    biomarkers: ['Psychomotor Tempo Index', 'Prolonged Resting Gaps', 'Inter-Word Inertia'],
    sampleDriftPct: '+0.8% baseline',
    iconSvg: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'bipolar',
    name: 'Bipolar',
    nameLine2: 'Disorder',
    status: 'Stable',
    iconBgClass: 'bg-indigo-50 dark:bg-indigo-950/40',
    iconTextClass: 'text-indigo-500',
    iconBorderClass: 'border-indigo-100/60 dark:border-indigo-900/40',
    description: 'Identifies cyclical oscillations between rapid hypomanic burst clusters and depressive typing decelerations over weeks.',
    biomarkers: ['Burst Velocity Oscillations', 'Circadian Typing Flux', 'Tempo Periodicity'],
    sampleDriftPct: '+0.5% baseline',
    iconSvg: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];
