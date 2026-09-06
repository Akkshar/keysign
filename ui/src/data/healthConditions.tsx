import React from 'react';
import { HealthCondition } from '../components/health/HealthSignalCard';

/**
 * Research roadmap. None of this is computed from anyone's data today: the
 * Drift head is a chart, and these six are the screening signals it could grow
 * into given months of typing from the same person. Names and clinical notices
 * are the teammate's; the copy is deliberately short and hedged.
 */

const icon = (d: string) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const mockHealthConditions: HealthCondition[] = [
  {
    id: 'parkinsons',
    name: 'Tremor & Kinetics',
    watches: 'Hold-time jitter and release asymmetry: whether the same keys are held for increasingly uneven lengths of time.',
    evidence: 'MIT neuroQWERTY (Giancardo et al., 2016) showed hold-time patterns from ordinary typing separating early Parkinson\'s from controls; it remains the strongest published result in this area.',
    action: 'If your typing feels slower or less steady than it used to, see a physician or neurologist; this signal would only ever say "worth asking".',
    clinicalNotice: 'Non-diagnostic screening. A pattern change would indicate a possible shift in fine-motor timing; a physician or neurologist performs the actual clinical evaluation.',
    iconSvg: icon('M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z'),
  },
  {
    id: 'mci',
    name: 'Cognitive Hesitation',
    watches: 'Pause length before words and how evenly the rhythm holds across a sentence.',
    evidence: 'Longer pre-word pauses under cognitive load are well documented; links to mild cognitive impairment come from small, early studies and are not yet settled.',
    action: 'If you or someone close to you notices memory or word-finding changes, ask a healthcare provider for a proper cognitive assessment.',
    clinicalNotice: 'Early screening indicator only. Never self-diagnose. If you or a loved one experience noticeable memory or language changes, schedule formal clinical testing with a healthcare provider.',
    iconSvg: icon('M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z'),
  },
  {
    id: 'alzheimers',
    name: 'Spatial & Syntax Drift',
    watches: 'Week-over-week change in common two-key transitions and in how often the cursor keys are used to go back and search.',
    evidence: 'Evidence here is indirect: writing changes over years are described in the literature, but keystroke-specific studies are few and small.',
    action: 'Treat any long-term change as something to raise with a physician, who can run the assessments that actually diagnose.',
    clinicalNotice: 'Non-diagnostic. Observed behavioral metrics are intended solely to support discussion with your physician, who can perform clinical diagnostic assessments.',
    iconSvg: icon('M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.516 0c.85.493 1.508 1.333 1.508 2.316V18'),
  },
  {
    id: 'ms',
    name: 'Neuromuscular Fatigue',
    watches: 'Hold times lengthening over the course of one long session, then recovering after rest.',
    evidence: 'Dwell creep under fatigue shows up in ordinary typing studies; disease-specific evidence is early and would need clinical follow-up to mean anything.',
    action: 'Recurring motor fatigue that does not match your workload is a reason to see a doctor, not something a keyboard can settle.',
    clinicalNotice: 'Non-diagnostic. A sustained change in typing fatigue would only suggest a possible motor pattern shift; have it evaluated clinically by your doctor.',
    iconSvg: icon('M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z'),
  },
  {
    id: 'depression',
    name: 'Psychomotor Tempo',
    watches: 'Overall tempo and the length of resting gaps between phrases, compared with the same person\'s usual weeks.',
    evidence: 'Smartphone keystroke studies report slower tempo during low-mood periods, with small effects and small cohorts.',
    action: 'If low energy or mood changes are getting in the way of daily life, reach out to a healthcare professional.',
    clinicalNotice: 'Screening signal only. If low energy, burnout, or mood shifts interfere with your daily life, please reach out to a healthcare professional for clinical support.',
    iconSvg: icon('M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z'),
  },
  {
    id: 'bipolar',
    name: 'Circadian Cadence Flux',
    watches: 'Swings between unusually fast bursts and unusually slow stretches across days, including at what hour they happen.',
    evidence: 'A few phone-typing studies track day-to-day rhythm in bipolar disorder; the cohorts are small and the work is exploratory.',
    action: 'Questions about mood or sleep rhythm belong with a qualified clinician; a chart can only help you describe what you noticed.',
    clinicalNotice: 'Informational behavioral monitoring only. Not an evaluation or diagnostic finding. Discuss questions regarding mood or sleep rhythms with a qualified clinician.',
    iconSvg: icon('M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z'),
  },
];
