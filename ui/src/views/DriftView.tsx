import React from 'react';
import { mockDriftMetrics } from '../data/mockDrift';
import { PrivacyBadge } from '../components/common/PrivacyBadge';

export const DriftView: React.FC = () => {
  return (
    <div className="flex flex-col w-full gap-space-2xl">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md p-space-md bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container">
        <div className="flex items-center gap-space-md">
          <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary flex-shrink-0 border border-surface-container">
            <span className="material-symbols-outlined text-[24px]">trending_up</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-space-xs flex-wrap">
              <span className="font-headline text-sm font-bold text-on-surface">Area 04 • Neuromotor Baseline Drift</span>
              <span className="font-telemetry text-[11px] bg-primary/10 text-primary px-space-xs py-space-2xs rounded font-semibold">
                30-Day Window
              </span>
            </div>
            <p className="font-body text-xs text-on-surface-variant">
              Long-term neuromotor variance detection tracks physical habit shifts, posture adjustments, and progressive cadence adaptation.
            </p>
          </div>
        </div>
        <PrivacyBadge variant="pill" />
      </div>

      {/* Page Header */}
      <div>
        <div className="flex items-center gap-space-xs mb-space-xs">
          <span className="font-telemetry text-xs text-primary uppercase tracking-wider font-semibold">Longitudinal Analysis</span>
          <span className="font-telemetry text-xs text-outline-variant">/</span>
          <span className="font-telemetry text-xs text-on-surface-variant">Continuous Enrolment Model</span>
        </div>
        <h1 className="font-headline text-2xl lg:text-3xl text-on-surface font-bold tracking-tight">
          Drift — Long-Term Typing Changes
        </h1>
        <p className="font-body text-sm text-on-surface-variant max-w-3xl mt-space-2xs">
          Evaluating whether slow biometric shifts reflect natural biological variance, hardware changes, or gradual motor degradation.
        </p>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg">
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-md">
            <span className="font-headline text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
              30-Day Motor Sync
            </span>
            <span className="font-telemetry text-xs bg-secondary-container text-on-secondary-container px-space-xs py-space-2xs rounded font-semibold">
              Optimal
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs mb-space-xs">
            <span className="font-telemetry text-3xl font-bold text-on-surface">{mockDriftMetrics.syncPercentage}%</span>
            <span className="font-telemetry text-xs text-secondary font-semibold">{mockDriftMetrics.driftDelta}</span>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full mt-space-xs overflow-hidden">
            <div className="bg-secondary h-full rounded-full" style={{ width: `${mockDriftMetrics.syncPercentage}%` }}></div>
          </div>
          <p className="font-body text-xs text-on-surface-variant mt-space-sm">
            Continuous sync maintains zero false lockouts across 30 days.
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-md">
            <span className="font-headline text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
              Dwell Drift
            </span>
            <span className="font-telemetry text-xs bg-surface-container text-on-surface font-medium px-space-xs py-space-2xs rounded border border-surface-container">
              +1.1ms Net
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs mb-space-xs">
            <span className="font-telemetry text-3xl font-bold text-primary">84.2ms</span>
            <span className="font-telemetry text-xs text-outline">vs 83.1ms base</span>
          </div>
          <p className="font-body text-xs text-on-surface-variant mt-space-sm">
            Negligible key-hold duration migration across all finger groups.
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-md">
            <span className="font-headline text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
              Flight Latency Shift
            </span>
            <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
          </div>
          <div className="flex items-baseline gap-space-xs mb-space-xs">
            <span className="font-telemetry text-3xl font-bold text-on-surface">112.6ms</span>
            <span className="font-telemetry text-xs text-secondary font-semibold">Stable</span>
          </div>
          <p className="font-body text-xs text-on-surface-variant mt-space-sm">
            Inter-key transitions exhibit zero progressive fatigue decay.
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-md">
            <span className="font-headline text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
              Stability Tier
            </span>
            <span className="font-telemetry text-xs bg-primary/10 text-primary font-semibold px-space-xs py-space-2xs rounded">
              Tier 1
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs mb-space-xs">
            <span className="font-headline text-lg font-bold text-on-surface">Stable Track</span>
            <span className="font-telemetry text-xs text-secondary font-medium">σ=0.08</span>
          </div>
          <p className="font-body text-[11px] text-on-surface-variant mt-space-sm leading-tight">
            Health screening indicator only — not a clinical diagnosis.
          </p>
        </div>
      </div>

      {/* Multi-Week Trend Graph */}
      <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container flex flex-col gap-space-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
          <div>
            <h3 className="font-headline text-base font-bold text-on-surface">
              4-Week Neuromotor Baseline Evolution
            </h3>
            <p className="font-body text-xs text-on-surface-variant">
              Weekly rolling average of dwell contact time and inter-key transit latency
            </p>
          </div>
          <div className="flex items-center gap-space-md text-xs font-headline">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-primary"></span>
              <span className="font-telemetry text-on-surface-variant">Dwell (ms)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-secondary"></span>
              <span className="font-telemetry text-on-surface-variant">Flight (ms)</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-space-md">
          {mockDriftMetrics.weeklyDriftTrend.map((w, idx) => (
            <div
              key={idx}
              className="bg-surface-container-low p-space-md rounded-lg border border-surface-container flex flex-col gap-space-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-headline text-xs font-bold text-on-surface">{w.week}</span>
                <span className="font-telemetry text-[11px] text-secondary font-semibold">{w.sync}% sync</span>
              </div>
              <div className="flex justify-between items-center text-xs font-telemetry pt-1">
                <span className="text-on-surface-variant">Dwell Avg:</span>
                <span className="text-primary font-semibold">{w.dwell}ms</span>
              </div>
              <div className="flex justify-between items-center text-xs font-telemetry">
                <span className="text-on-surface-variant">Flight Avg:</span>
                <span className="text-secondary font-semibold">{w.flight}ms</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Multi-Keyboard Modality Awareness */}
      <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container flex flex-col gap-space-md">
        <div>
          <h3 className="font-headline text-base font-bold text-on-surface">
            Multi-Hardware Modality Profiles
          </h3>
          <p className="font-body text-xs text-on-surface-variant">
            KeySign detects mechanical switch resistance, key travel depth, and layout variances without re-enrolling from scratch.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md mt-space-xs">
          {mockDriftMetrics.keyboardProfiles.map((kb, i) => (
            <div
              key={i}
              className={`p-space-md rounded-lg border transition-all ${
                kb.active
                  ? 'bg-primary/5 border-primary/40 shadow-sm'
                  : 'bg-surface-container-low border-surface-container'
              }`}
            >
              <div className="flex items-center justify-between mb-space-xs">
                <span className="font-headline text-xs font-bold text-on-surface">{kb.name}</span>
                {kb.active && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-telemetry bg-primary text-white font-semibold">
                    ACTIVE
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center text-xs font-telemetry mt-space-sm">
                <span className="text-on-surface-variant">Sync Baseline:</span>
                <span className="text-secondary font-semibold">{kb.syncScore}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-telemetry mt-1">
                <span className="text-on-surface-variant">Dwell / Flight:</span>
                <span className="text-on-surface">{kb.dwellAvg} / {kb.flightAvg}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
