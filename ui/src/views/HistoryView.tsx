import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MedicalDisclaimer } from '../components/health/MedicalDisclaimer';

interface SessionRecord {
  id: string;
  timestamp: string;
  durationMinutes: number;
  keystrokesCount: number;
  meanDwellMs: number;
  flightLatencyMs: number;
  stabilityScore: number;
  assessment: 'Stable' | 'Observation' | 'Calibration';
}

const mockSessions: SessionRecord[] = [
  {
    id: 's-1',
    timestamp: 'Today, 02:14 PM',
    durationMinutes: 45,
    keystrokesCount: 3410,
    meanDwellMs: 88,
    flightLatencyMs: 115,
    stabilityScore: 92,
    assessment: 'Stable',
  },
  {
    id: 's-2',
    timestamp: 'Today, 10:30 AM',
    durationMinutes: 28,
    keystrokesCount: 1890,
    meanDwellMs: 89,
    flightLatencyMs: 118,
    stabilityScore: 93,
    assessment: 'Stable',
  },
  {
    id: 's-3',
    timestamp: 'Yesterday, 04:55 PM',
    durationMinutes: 62,
    keystrokesCount: 4820,
    meanDwellMs: 104,
    flightLatencyMs: 135,
    stabilityScore: 86,
    assessment: 'Observation',
  },
  {
    id: 's-4',
    timestamp: 'Yesterday, 11:15 AM',
    durationMinutes: 34,
    keystrokesCount: 2450,
    meanDwellMs: 87,
    flightLatencyMs: 114,
    stabilityScore: 94,
    assessment: 'Stable',
  },
  {
    id: 's-5',
    timestamp: '2 Days Ago, 03:20 PM',
    durationMinutes: 50,
    keystrokesCount: 3900,
    meanDwellMs: 86,
    flightLatencyMs: 112,
    stabilityScore: 95,
    assessment: 'Stable',
  },
  {
    id: 's-6',
    timestamp: '3 Days Ago, 09:45 AM',
    durationMinutes: 40,
    keystrokesCount: 3100,
    meanDwellMs: 88,
    flightLatencyMs: 116,
    stabilityScore: 91,
    assessment: 'Stable',
  },
];

export const HistoryView: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'stable' | 'observation'>('all');

  const filteredSessions = mockSessions.filter((s) => {
    if (filter === 'stable') return s.assessment === 'Stable';
    if (filter === 'observation') return s.assessment === 'Observation';
    return true;
  });

  return (
    <div className="flex flex-col w-full gap-8 pb-12 select-none">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="text-xs font-mono tracking-wider uppercase text-indigo-600 dark:text-indigo-400 font-semibold">
            Longitudinal Screening Log
          </span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-slate-900 dark:text-slate-100">
          History & Trend Records
        </h1>
        <p className="font-body text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
          Historical typing session checkpoints and stability scores. All telemetry is aggregated as anonymous mathematical distributions in local browser storage.
        </p>
      </div>

      {/* Aggregate Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 shadow-sm">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
            30-Day Mean Stability
          </span>
          <div className="text-2xl font-serif font-semibold text-slate-900 dark:text-slate-100 mt-1">
            92.4 <span className="text-xs font-mono text-slate-400">/ 100</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 shadow-sm">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
            Total Sessions
          </span>
          <div className="text-2xl font-serif font-semibold text-slate-900 dark:text-slate-100 mt-1">
            142 <span className="text-xs font-mono text-slate-400">sessions</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 shadow-sm">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
            Observation Alerts
          </span>
          <div className="text-2xl font-serif font-semibold text-amber-600 dark:text-amber-400 mt-1">
            1 <span className="text-xs font-mono text-slate-400">transient</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 shadow-sm">
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
            Baseline Calibration
          </span>
          <div className="text-2xl font-serif font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
            Active <span className="text-xs font-mono text-slate-400">99.1%</span>
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-xl font-medium text-slate-900 dark:text-slate-100">
              Session Checkpoints
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Micro-timing evaluation aggregates stored without character contents
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('stable')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === 'stable'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Stable
            </button>
            <button
              onClick={() => setFilter('observation')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === 'observation'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Observation
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-mono uppercase text-[11px]">
                <th className="py-3 px-4">Session Time</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Keystrokes</th>
                <th className="py-3 px-4">Mean Hold</th>
                <th className="py-3 px-4">Flight Latency</th>
                <th className="py-3 px-4">Stability</th>
                <th className="py-3 px-4 text-right">Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {filteredSessions.map((session) => (
                <tr key={session.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">
                    {session.timestamp}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                    {session.durationMinutes} min
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                    {session.keystrokesCount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-indigo-600 dark:text-indigo-400">
                    {session.meanDwellMs} ms
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                    {session.flightLatencyMs} ms
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-100">
                    {session.stabilityScore}%
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium font-sans ${
                        session.assessment === 'Observation'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                      }`}
                    >
                      {session.assessment}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disclaimer */}
      <MedicalDisclaimer />
    </div>
  );
};
