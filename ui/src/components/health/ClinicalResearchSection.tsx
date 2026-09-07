import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ClinicalCondition {
  id: 'parkinsons' | 'cognitive-hesitation' | 'neuromuscular-fatigue';
  title: string;
  conditionName: string;
  badge: string;
  badgeColor: string;
  biometricSignal: string;
  measuredValue: string;
  nominalRange: string;
  riskThreshold: string;
  riskScore: number;              // kept at 0: KeySign produces no risk score
  status: 'Not scored';           // ...and says so on the card, rather than showing a green light
  
  // Research Citation
  paperTitle: string;
  authors: string;
  journal: string;
  year: number;
  doi: string;
  sampleSize: string;
  studyFinding: string;

  // Medical Mechanism & Non-Diagnostic Guidance
  mechanism: string;
  ethicalNotice: string;
  clinicalRecommendation: string;
}

export const CLINICAL_CONDITIONS: ClinicalCondition[] = [
  {
    id: 'parkinsons',
    title: 'Tremor and movement',
    conditionName: "Parkinson's disease, early motor change",
    badge: 'Movement disorders',
    badgeColor: 'text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-700',
    biometricSignal: 'How long each key is held, and how much that varies within a sitting',
    measuredValue: 'hold_mean, hold_std',
    nominalRange: "this person's own calm baseline, as a z-score",
    riskThreshold: 'no threshold: KeySign shows the drift, a clinician reads it',
    riskScore: 0,
    status: 'Not scored',
    paperTitle: "Computer keyboard interaction as an indicator of early Parkinson's disease",
    authors: 'L. Giancardo, A. Sánchez-Ferro, T. Arroyo-Gallego et al.',
    journal: 'Scientific Reports',
    year: 2016,
    doi: '10.1038/srep34468',
    sampleSize: 'See the paper; the DOI resolves to the full text.',
    studyFinding: "Keystroke hold times captured during ordinary, unconstrained typing separated people with early Parkinson's disease from controls. The same group had already shown the effect for psychomotor impairment (Scientific Reports 2015, 10.1038/srep09678).",
    mechanism: 'Hold time is set by how quickly a finger can be commanded to release, which is among the first things basal-ganglia disorders slow down.',
    ethicalNotice: 'KeySign does not diagnose. It measures typing timing and shows how far today sits from your own baseline. Nothing here is a clinical finding.',
    clinicalRecommendation: 'A drift that persists over weeks is a reason to see a neurologist, not a diagnosis of anything.',
  },
  {
    id: 'cognitive-hesitation',
    title: 'Hesitation and pauses',
    conditionName: 'Mild cognitive impairment',
    badge: 'Cognition',
    badgeColor: 'text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-700',
    biometricSignal: 'Gaps between keys, and how often a pause interrupts a word',
    measuredValue: 'flight_mean, pause_ratio',
    nominalRange: "this person's own calm baseline, as a z-score",
    riskThreshold: 'no threshold: KeySign shows the drift, a clinician reads it',
    riskScore: 0,
    status: 'Not scored',
    paperTitle: 'Discriminant Power of Smartphone-Derived Keystroke Dynamics for Mild Cognitive Impairment Compared to a Neuropsychological Screening Test: Cross-Sectional Study',
    authors: 'J. Park et al.',
    journal: 'Journal of Medical Internet Research',
    year: 2024,
    doi: '10.2196/59247',
    sampleSize: 'See the paper; the DOI resolves to the full text.',
    studyFinding: 'Keystroke timing collected from everyday phone use was compared against a neuropsychological screening test for mild cognitive impairment.',
    mechanism: 'Retrieving a word and planning the next keystroke happen together while typing, so hesitation shows up in the gaps rather than in the words.',
    ethicalNotice: 'KeySign does not diagnose. It measures typing timing and shows how far today sits from your own baseline. Nothing here is a clinical finding.',
    clinicalRecommendation: 'A drift that persists over weeks is a reason to see a doctor, not a diagnosis of anything.',
  },
  {
    id: 'neuromuscular-fatigue',
    title: 'Fatigue',
    conditionName: 'Mental fatigue over a sitting',
    badge: 'Fatigue',
    badgeColor: 'text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-700',
    biometricSignal: 'Speed, rhythm variance and error rate drifting across a long session',
    measuredValue: 'speed_kps, rhythm_cv, error_rate',
    nominalRange: "this person's own calm baseline, as a z-score",
    riskThreshold: 'no threshold: the State head reports load, not a diagnosis',
    riskScore: 0,
    status: 'Not scored',
    paperTitle: 'Evaluating keystroke dynamics as a biomarker for mental fatigue detection',
    authors: 'T. Arroyo-Gallego, A. Ayala, A. Morales et al.',
    journal: 'Research Square (preprint, not peer reviewed)',
    year: 2022,
    doi: '10.21203/rs.3.rs-1580509/v1',
    sampleSize: 'See the preprint; the DOI resolves to the full text.',
    studyFinding: 'Keystroke timing was evaluated as a marker of mental fatigue. This one is a preprint: it has not been through peer review, and it is listed here as evidence of direction, not of proof.',
    mechanism: 'Tiredness costs the same motor plan more time, and the cost shows first in rhythm rather than in raw speed.',
    ethicalNotice: 'KeySign does not diagnose. The State head reports cognitive load against your own baseline; it says nothing about health.',
    clinicalRecommendation: 'Treat this as a working-conditions signal, not a medical one.',
  },
];

/**
 * The published work behind the drift head, and what KeySign does and does not do with it.
 *
 * Every citation here was checked against Crossref on 2026-09-08: title, authors, journal and
 * year come from the DOI record. Two citations in the original design did not survive that
 * check (one DOI pointed at an unrelated paper about serious games, one did not resolve at
 * all) and were replaced. The per-person "measured values" and risk scores it shipped with
 * were invented, so they are gone: KeySign measures the features named on each card against
 * that person's own baseline and produces no risk score of any kind.
 */
export const ClinicalResearchSection: React.FC = () => {
  const [selectedCondition, setSelectedCondition] = useState<ClinicalCondition | null>(null);

  return (
    <div className="w-full space-y-6">
      {/* 3 Interactive Condition Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {CLINICAL_CONDITIONS.map((cond) => (
          <div
            key={cond.id}
            onClick={() => setSelectedCondition(cond)}
            className="p-5 sm:p-6 rounded-xl border border-stone-200 dark:border-stone-700 bg-[#fdfcf9] dark:bg-[#151513] space-y-4 shadow-sm hover-subtle-glow transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="space-y-3">
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <span className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-mono font-semibold border ${cond.badgeColor}`}>
                  {cond.badge}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-mono text-stone-500 dark:text-stone-400">
                  {cond.status}
                </span>
              </div>

              {/* Title & Signal */}
              <div>
                <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100 group-hover:text-stone-700 dark:group-hover:text-stone-300 transition-colors">
                  {cond.title}
                </h3>
                <p className="text-xs font-mono text-stone-500 dark:text-stone-400 line-clamp-1 pt-0.5">
                  {cond.conditionName}
                </p>
              </div>

              <p className="text-xs font-sans text-stone-600 dark:text-stone-400 leading-relaxed">
                {cond.biometricSignal}
              </p>
            </div>

            {/* Metric & Research Badge */}
            <div className="space-y-3 pt-2 border-t border-stone-100 dark:border-stone-700">
              <div className="flex items-baseline justify-between font-mono text-xs">
                <span className="text-stone-400 text-[11px]">Features:</span>
                <strong className="text-stone-900 dark:text-stone-100 font-bold">
                  {cond.measuredValue}
                </strong>
              </div>

              {/* Scientific Paper Tag */}
              <div className="p-2.5 rounded-md bg-stone-100/80 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[13px]">description</span>
                  <span>{cond.journal} ({cond.year})</span>
                </div>
                <p className="text-[11px] font-mono text-stone-600 dark:text-stone-300 line-clamp-1 italic">
                  "{cond.paperTitle}"
                </p>
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-stone-600 dark:text-stone-400 group-hover:text-stone-900 dark:group-hover:text-stone-100 pt-1 group-hover:translate-x-0.5 transition-all">
                <span className="font-semibold text-[11px]">Read the research</span>
                <span>→</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Clinical Investigation Modal */}
      <AnimatePresence>
        {selectedCondition && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 dark:bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-stone-200 dark:border-stone-700 bg-[#fdfcf9] dark:bg-[#151513] p-6 sm:p-8 space-y-6 shadow-2xl text-stone-900 dark:text-stone-100 font-sans"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 border-b border-stone-200 dark:border-stone-700 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-mono font-semibold border ${selectedCondition.badgeColor}`}>
                      {selectedCondition.badge}
                    </span>
                  </div>
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
                    {selectedCondition.title}
                  </h2>
                  <p className="font-mono text-xs text-stone-500 dark:text-stone-400">
                    {selectedCondition.conditionName}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCondition(null)}
                  className="p-1.5 rounded-md hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors cursor-pointer"
                  title="Close modal"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* CRITICAL ETHICAL / NON-DIAGNOSTIC ADVISORY BANNER */}
              <div className="p-4 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-100/80 dark:bg-stone-900/80 space-y-2">
                <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-mono text-xs font-bold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-base text-stone-600 dark:text-stone-400">shield</span>
                  <span>Non-Diagnostic Research Indicator</span>
                </div>
                <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed font-sans">
                  {selectedCondition.ethicalNotice}
                </p>
                <div className="pt-1 text-xs text-stone-700 dark:text-stone-300 font-sans font-medium border-t border-stone-200 dark:border-stone-700">
                  <span className="font-bold text-stone-900 dark:text-stone-100">Clinical Protocol: </span>
                  {selectedCondition.clinicalRecommendation}
                </div>
              </div>

              {/* What is measured, what it is measured against, and what it is not */}
              <div className="space-y-3 font-mono">
                <h4 className="text-xs uppercase tracking-wider text-stone-400 font-semibold">
                  What this signal is, in KeySign
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-lg bg-stone-100 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-700 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10.5px] text-stone-400 block">WHAT KEYSIGN MEASURES</span>
                    <strong className="text-stone-900 dark:text-stone-100 text-base">
                      {selectedCondition.measuredValue}
                    </strong>
                    <span className="block text-[10px] text-stone-400">
                      from your own typing
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10.5px] text-stone-400 block">COMPARED AGAINST</span>
                    <strong className="text-stone-700 dark:text-stone-300 text-sm">
                      {selectedCondition.nominalRange}
                    </strong>
                    <span className="block text-[10px] text-stone-400">
                      your calm samples, not a population
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10.5px] text-stone-400 block">WHAT IT DOES NOT DO</span>
                    <strong className="text-stone-900 dark:text-stone-100 text-sm">
                      {selectedCondition.riskThreshold}
                    </strong>
                    <span className="block text-[10px] text-stone-500 dark:text-stone-400 font-medium">
                      no score, no verdict
                    </span>
                  </div>
                </div>
              </div>

              {/* Peer-Reviewed Scientific Research Paper Proof */}
              <div className="p-4 sm:p-5 rounded-lg border border-stone-200 dark:border-stone-700 bg-[#f8f7f4] dark:bg-[#1a1a18] space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5 font-mono tracking-wider uppercase">
                    <span className="material-symbols-outlined text-sm text-stone-500 dark:text-stone-400">science</span>
                    <span>Published research</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                    DOI: {selectedCondition.doi}
                  </span>
                </div>

                <div className="space-y-1">
                  <strong className="font-serif text-sm text-stone-900 dark:text-stone-100 block">
                    "{selectedCondition.paperTitle}"
                  </strong>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    {selectedCondition.authors} • <em>{selectedCondition.journal}</em> ({selectedCondition.year})
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-stone-200 dark:border-stone-700 font-sans text-xs">
                  <div className="text-stone-700 dark:text-stone-300 leading-relaxed">
                    <strong className="font-mono text-[11px] text-stone-900 dark:text-stone-100">Where to read it: </strong>
                    {selectedCondition.sampleSize}
                  </div>
                  <div className="text-stone-700 dark:text-stone-300 leading-relaxed">
                    <strong className="font-mono text-[11px] text-stone-900 dark:text-stone-100">What it found: </strong>
                    {selectedCondition.studyFinding}
                  </div>
                  <div className="text-stone-700 dark:text-stone-300 leading-relaxed">
                    <strong className="font-mono text-[11px] text-stone-900 dark:text-stone-100">Why timing carries it: </strong>
                    {selectedCondition.mechanism}
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions (Structured Compact Rectangular Buttons) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-stone-200 dark:border-stone-700">
                <a
                  href={`https://doi.org/${selectedCondition.doi}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-md bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 font-mono text-xs font-semibold hover:bg-stone-800 dark:hover:bg-stone-200 transition-all cursor-pointer shadow-sm border border-stone-800 dark:border-stone-200 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  <span>Read the paper</span>
                </a>
                <button
                  onClick={() => setSelectedCondition(null)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-md border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-mono text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition-all cursor-pointer text-center"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClinicalResearchSection;
