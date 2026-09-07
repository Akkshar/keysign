import React from 'react';
import { HealthCondition } from '../components/health/HealthSignalCard';

/**
 * Research roadmap. None of this is computed from anyone's data today: the
 * Drift head is a chart, and these three are the screening signals it could
 * grow into given months of typing from the same person. Only signals with a
 * published keystroke-TIMING result are listed; anything that would need the
 * typed text (syntax, word choice) or rests on mood-disorder studies with tiny
 * cohorts was cut, because this tool never sees text and cannot back those.
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
    evidence: 'Longer pre-word pauses under load are well documented. For mild cognitive impairment the keystroke evidence is early and small (e.g. Ntracha et al., 2020, touchscreen typing), so this is the least settled of the three.',
    action: 'If you or someone close to you notices memory or word-finding changes, ask a healthcare provider for a proper cognitive assessment.',
    clinicalNotice: 'Early screening indicator only. Never self-diagnose. If you or a loved one experience noticeable memory or language changes, schedule formal clinical testing with a healthcare provider.',
    iconSvg: icon('M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z'),
  },
  {
    id: 'ms',
    name: 'Neuromuscular Fatigue',
    watches: 'Hold times lengthening over the course of one long session, then recovering after rest.',
    evidence: 'Lam et al. (2021, Multiple Sclerosis Journal) reported real-world keystroke dynamics tracking clinical disability in MS; a single cohort, so a possible signal, not a test.',
    action: 'Recurring motor fatigue that does not match your workload is a reason to see a doctor, not something a keyboard can settle.',
    clinicalNotice: 'Non-diagnostic. A sustained change in typing fatigue would only suggest a possible motor pattern shift; have it evaluated clinically by your doctor.',
    iconSvg: icon('M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z'),
  },
];
