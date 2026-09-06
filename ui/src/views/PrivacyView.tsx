import React from 'react';
import { motion } from 'framer-motion';
import { MedicalDisclaimer } from '../components/health/MedicalDisclaimer';

export const PrivacyView: React.FC = () => {
  return (
    <div className="flex flex-col w-full gap-8 pb-12 select-none">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="text-xs font-mono tracking-wider uppercase text-indigo-600 dark:text-indigo-400 font-semibold">
            Privacy By Design
          </span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-slate-900 dark:text-slate-100">
          Privacy Architecture & Cryptographic Isolation
        </h1>
        <p className="font-body text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
          KeySign is architected from the ground up so that it is mathematically impossible to reconstruct typed messages, words, or credentials from stored telemetry.
        </p>
      </div>

      {/* Key Principle Banner */}
      <section className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-8 sm:p-10 shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="text-xs font-mono tracking-widest text-indigo-300 uppercase font-semibold">
            Foundational Commitment
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-medium leading-snug">
            Your words are yours alone. Only relative timing intervals are evaluated.
          </h2>
          <p className="text-sm text-indigo-200/90 leading-relaxed pt-2">
            The moment a key is pressed, its letter, symbol, or glyph is discarded. We retain only two floating-point millisecond timestamps: the press time and the release time.
          </p>
        </div>
      </section>

      {/* 4 Pillars Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          {
            icon: 'delete_sweep',
            title: '1. Immediate Payload Stripping',
            desc: 'The OS keyboard interrupt delivers character symbols. KeySign immediately sets character values to null and drops them from memory before processing.',
            code: 'keyEvent.char = null; keyEvent.code = null;',
          },
          {
            icon: 'memory',
            title: '2. 100% On-Device Local Processing',
            desc: 'Inference runs inside a local client-side enclave. No biometric timing vectors, baseline models, or logs are uploaded to any external server or cloud provider.',
            code: 'enclave.processLocally({ network: "DISCONNECTED" });',
          },
          {
            icon: 'graphic_eq',
            title: '3. Spectral Wavelet Transformation',
            desc: 'Timing series are transformed into 28 frequency distribution bins. This irreversible mathematical transform destroys word-length patterns while preserving motor rhythm.',
            code: 'spectrum = FFT(deltaTimes.normalize());',
          },
          {
            icon: 'lock',
            title: '4. Differential Privacy Noise Injection',
            desc: 'Calibrated Laplace noise is added to long-term drift baselines, ensuring mathematical zero-knowledge against fingerprinting or reconstruction attacks.',
            code: 'baselineVector += LaplaceNoise(scale = epsilon);',
          },
        ].map((pillar, idx) => (
          <div
            key={idx}
            className="p-6 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 shadow-sm space-y-3"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
              <span className="material-symbols-outlined text-[20px]">{pillar.icon}</span>
            </div>
            <h3 className="font-serif text-base font-medium text-slate-900 dark:text-slate-100">
              {pillar.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-body">
              {pillar.desc}
            </p>
            <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800/70 font-mono text-[11px] text-slate-700 dark:text-slate-300">
              {pillar.code}
            </div>
          </div>
        ))}
      </section>

      {/* Comparison Table */}
      <section className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <h3 className="font-serif text-xl font-medium text-slate-900 dark:text-slate-100">
          Architecture Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-mono uppercase">
                <th className="py-3 px-4">Telemetry Dimension</th>
                <th className="py-3 px-4 text-rose-500">Commercial Keyloggers</th>
                <th className="py-3 px-4 text-emerald-600 dark:text-emerald-400">
                  KeySign Enclave
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-body">
              <tr>
                <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                  Typed Alphanumeric Text
                </td>
                <td className="py-3 px-4 text-rose-600">Recorded & Logged</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">
                  Zero Capture (Discarded)
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                  Passwords & Sensitive Fields
                </td>
                <td className="py-3 px-4 text-rose-600">Stored in cleartext/hash</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">
                  Never Intercepted
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                  Relative Microsecond Timing (t_down, t_up)
                </td>
                <td className="py-3 px-4 text-slate-400">Ignored</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">
                  Extracted for Motor Screening
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                  Network Transmission
                </td>
                <td className="py-3 px-4 text-rose-600">Continuous cloud sync</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">
                  100% In-Browser / On-Device
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Statutory Medical Disclaimer */}
      <MedicalDisclaimer />
    </div>
  );
};
