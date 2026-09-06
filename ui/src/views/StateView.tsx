import React, { useState } from 'react';
import { useBiometrics } from '../context/BiometricsContext';
import { mockStateTimelineEvents } from '../data/mockState';

export const StateView: React.FC = () => {
  const { cognitiveState, setCognitiveState, stateTimeline } = useBiometrics();
  const timeline = stateTimeline.length ? stateTimeline.slice(-3) : mockStateTimelineEvents;
  const [timelinePeriod, setTimelinePeriod] = useState<'60m' | 'day' | 'week'>('60m');

  const toggleInterruption = () => {
    setCognitiveState((prev) => ({
      ...prev,
      smartInterruptionActive: !prev.smartInterruptionActive,
    }));
  };

  return (
    <div className="flex flex-col w-full gap-space-2xl">
      {/* Top Context & Privacy Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md p-space-md bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container">
        <div className="flex items-center gap-space-md">
          <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary flex-shrink-0 border border-surface-container">
            <span className="material-symbols-outlined text-[24px]">psychology</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-space-xs flex-wrap">
              <span className="font-headline text-sm font-bold text-on-surface">Zero-Knowledge Cognitive Estimation</span>
              <span className="font-telemetry text-[11px] bg-secondary-container text-on-secondary-container px-space-xs py-space-2xs rounded font-semibold">
                Local Only
              </span>
            </div>
            <p className="font-body text-xs text-on-surface-variant">
              Derived strictly from interval micro-deltas, never typed characters. Scores are computed relative to the declared user's personal baseline.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-space-xs bg-surface-container-low px-space-md py-space-xs rounded-full flex-shrink-0 self-start md:self-auto border border-surface-container">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
          <span className="font-telemetry text-xs text-on-surface font-medium">Processing locally • Keystroke content never recorded</span>
        </div>
      </div>

      {/* Page Header Title Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-xs mb-space-xs">
            <span className="font-telemetry text-xs text-primary uppercase tracking-wider font-semibold">Telemetry Vector</span>
            <span className="font-telemetry text-xs text-outline-variant">/</span>
            <span className="font-telemetry text-xs text-on-surface-variant">Neuromotor Resonance</span>
          </div>
          <h1 className="font-headline text-2xl lg:text-3xl text-on-surface font-bold tracking-tight">
            State — Focus &amp; Cognitive Load Dynamics
          </h1>
          <p className="font-body text-sm text-on-surface-variant max-w-3xl mt-space-2xs">
            Passive on-device estimation of mental saturation and attentional flow derived from neuromotor timing intervals.
          </p>
        </div>

        {/* Timeline Segmented Control */}
        <div className="flex items-center bg-surface-container-low p-1 rounded-lg self-start md:self-auto shadow-sm border border-surface-container">
          <button
            type="button"
            onClick={() => setTimelinePeriod('60m')}
            className={`px-space-md py-space-xs rounded-md font-headline text-xs transition-all ${
              timelinePeriod === '60m'
                ? 'bg-surface-container-lowest font-bold text-on-surface shadow-sm border border-surface-container'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Last 60 Minutes
          </button>
          <button
            type="button"
            onClick={() => setTimelinePeriod('day')}
            className={`px-space-md py-space-xs rounded-md font-headline text-xs transition-all ${
              timelinePeriod === 'day'
                ? 'bg-surface-container-lowest font-bold text-on-surface shadow-sm border border-surface-container'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Full Workday
          </button>
          <button
            type="button"
            onClick={() => setTimelinePeriod('week')}
            className={`px-space-md py-space-xs rounded-md font-headline text-xs transition-all ${
              timelinePeriod === 'week'
                ? 'bg-surface-container-lowest font-bold text-on-surface shadow-sm border border-surface-container'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Weekly Trend
          </button>
        </div>
      </div>

      {/* Top 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg">
        {/* Card 1: Cognitive Load */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-space-md">
            <span className="font-headline text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
              Cognitive Load
            </span>
            <span className="font-telemetry text-xs bg-secondary-container text-on-secondary-container px-space-xs py-space-2xs rounded font-medium">
              {cognitiveState.cognitiveLoad > 70 ? 'Elevated' : 'Normal'}
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs mb-space-xs">
            <span className="font-telemetry text-3xl text-on-surface font-bold">{cognitiveState.cognitiveLoad}</span>
            <span className="font-telemetry text-xs text-on-surface-variant">/ 100</span>
          </div>
          <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden mb-space-sm">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                cognitiveState.cognitiveLoad > 70 ? 'bg-tertiary' : 'bg-secondary'
              }`}
              style={{ width: `${cognitiveState.cognitiveLoad}%` }}
            ></div>
          </div>
          <p className="font-body text-xs text-on-surface-variant">
            {cognitiveState.cognitiveLoad > 70
              ? 'High mental saturation. Frequent pause clusters observed.'
              : 'Balanced mental exertion. Saturation nominal across last 30 minutes.'}
          </p>
        </div>

        {/* Card 2: Focus Index */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-space-md">
            <span className="font-headline text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
              Focus Index
            </span>
            <span className="font-telemetry text-xs bg-primary/10 text-primary px-space-xs py-space-2xs rounded font-medium">
              {cognitiveState.focusIndex > 65 ? 'Deep Focus' : 'Moderate'}
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs mb-space-xs">
            <span className="font-telemetry text-3xl text-primary font-bold">{cognitiveState.focusIndex}</span>
            <span className="font-telemetry text-xs text-on-surface-variant">/ 100</span>
          </div>
          <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden mb-space-sm">
            <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${cognitiveState.focusIndex}%` }}></div>
          </div>
          <p className="font-body text-xs text-on-surface-variant">
            Sustained harmonic cadence. Zero erratic pause clusters detected.
          </p>
        </div>

        {/* Card 3: Flow State Duration */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-space-md">
            <span className="font-headline text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
              Flow Duration
            </span>
            <span className="material-symbols-outlined text-secondary text-[18px]">timelapse</span>
          </div>
          <div className="flex items-baseline gap-space-xs mb-space-xs">
            <span className="font-telemetry text-3xl text-on-surface font-bold">{cognitiveState.flowDurationMins}</span>
            <span className="font-telemetry text-xs text-on-surface font-medium">mins</span>
          </div>
          <div className="flex items-center gap-space-xs text-secondary mb-space-sm text-xs font-telemetry">
            <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
            <span>+18m beyond session avg</span>
          </div>
          <p className="font-body text-xs text-on-surface-variant">
            Continuous uninterrupted typing cadence without distraction breaks.
          </p>
        </div>

        {/* Card 4: Baseline Variance */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-space-md">
            <span className="font-headline text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
              Baseline Variance
            </span>
            <span className="font-telemetry text-xs bg-surface-container text-on-surface font-medium px-space-xs py-space-2xs rounded border border-surface-container">
              σ {cognitiveState.varianceStdDev}
            </span>
          </div>
          <div className="flex items-baseline gap-space-xs mb-space-xs">
            <span className="font-telemetry text-3xl text-on-surface font-bold">±{cognitiveState.baselineVariance}%</span>
          </div>
          <div className="flex items-center gap-space-xs text-secondary mb-space-sm text-xs font-telemetry">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            <span>Within safe envelope</span>
          </div>
          <p className="font-body text-xs text-on-surface-variant">
            Relative to the declared user's personal calm baseline.
          </p>
        </div>
      </div>

      {/* Smart Interruption Management Banner */}
      <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg">
        <div className="flex items-start gap-space-lg">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 border border-primary/20">
            <span className="material-symbols-outlined text-[28px]">notifications_paused</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-space-sm">
              <span className="font-headline text-xs uppercase tracking-wider text-primary font-bold">
                Active Recommendation
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
              <span className="font-telemetry text-xs text-on-surface-variant">Local State Engine</span>
            </div>
            <h2 className="font-headline text-base font-bold text-on-surface mt-space-2xs">
              Smart Interruption Management: Deep Focus Active
            </h2>
            <p className="font-body text-xs text-on-surface-variant mt-space-2xs max-w-2xl leading-relaxed">
              The typist appears to be in uninterrupted deep focus. Non-critical notifications can be automatically buffered locally to safeguard cognitive flow.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-space-md flex-shrink-0 flex-wrap">
          <button
            type="button"
            onClick={toggleInterruption}
            className={`font-headline text-xs px-space-lg py-space-sm rounded-lg font-semibold shadow-sm transition-all flex items-center gap-space-xs ${
              cognitiveState.smartInterruptionActive
                ? 'bg-primary text-white hover:bg-primary-dark'
                : 'bg-surface-container-low text-on-surface-variant border border-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">sync_saved_locally</span>
            <span>
              {cognitiveState.smartInterruptionActive
                ? 'Auto-Delay Slack & Mail (Active)'
                : 'Enable Interruption Guard'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => alert('Cognitive sensitivity threshold adjusted to strict flow guard.')}
            className="bg-surface-container-low text-on-surface font-headline text-xs px-space-md py-space-sm rounded-lg font-semibold hover:bg-surface-container border border-surface-container transition-all"
          >
            Adjust Thresholds
          </button>
        </div>
      </div>

      {/* Real-Time Cognitive Load & Focus Graph Container */}
      <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md mb-space-lg">
          <div>
            <div className="flex items-center gap-space-xs">
              <span className="font-headline text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                Session Telemetry Stream
              </span>
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span className="font-telemetry text-xs text-secondary font-medium">0.4ms Ingestion</span>
            </div>
            <h3 className="font-headline text-lg font-bold text-on-surface mt-space-2xs">
              Cognitive Saturation &amp; Focus Trajectory
            </h3>
          </div>
          <div className="flex items-center gap-space-lg text-xs font-headline flex-wrap">
            <div className="flex items-center gap-space-xs">
              <span className="w-3 h-3 rounded-full bg-primary"></span>
              <span className="font-telemetry text-on-surface-variant">Focus Index (0-100)</span>
            </div>
            <div className="flex items-center gap-space-xs">
              <span className="w-3 h-3 rounded-full bg-secondary"></span>
              <span className="font-telemetry text-on-surface-variant">Cognitive Load (0-100)</span>
            </div>
            <div className="flex items-center gap-space-xs">
              <span className="w-3 h-1.5 rounded-sm bg-tertiary"></span>
              <span className="font-telemetry text-on-surface-variant">Fatigue Risk Zone</span>
            </div>
          </div>
        </div>

        {/* Multi-Zone Vector Chart Canvas */}
        <div className="relative w-full bg-surface-container-low rounded-lg p-space-md overflow-hidden border border-surface-container">
          {/* Zone Background Labels */}
          <div className="absolute inset-y-0 left-space-md flex flex-col justify-between pointer-events-none py-space-sm z-0 text-[10px] font-telemetry font-semibold">
            <span className="text-tertiary bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-300/30">
              High Load / Fatigue (&gt;85)
            </span>
            <span className="text-primary bg-blue-100 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-300/30">
              Deep Focus Zone (75-100)
            </span>
            <span className="text-secondary bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300/30">
              Normal Operating Baseline (35-74)
            </span>
            <span className="text-outline bg-surface-container px-1.5 py-0.5 rounded border border-surface-container">
              Passive / Idle (0-34)
            </span>
          </div>

          <svg className="w-full h-72 overflow-visible relative z-10" preserveAspectRatio="none" viewBox="0 0 1000 320">
            <defs>
              <linearGradient id="focusFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="loadFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Threshold Horizontal Guidelines */}
            <line stroke="#d97706" strokeDasharray="4,4" strokeWidth="1" opacity="0.4" x1="0" x2="1000" y1="48" y2="48" />
            <line stroke="#1d4ed8" strokeDasharray="4,4" strokeWidth="1" opacity="0.3" x1="0" x2="1000" y1="110" y2="110" />
            <line stroke="#059669" strokeDasharray="4,4" strokeWidth="1" opacity="0.3" x1="0" x2="1000" y1="210" y2="210" />

            {/* Focus Curve */}
            <path
              d="M 0,220 C 80,210 140,160 220,130 C 300,100 380,85 460,80 C 540,75 600,110 680,105 C 760,100 840,72 920,70 L 1000,68 L 1000,320 L 0,320 Z"
              fill="url(#focusFill)"
            />
            <path
              d="M 0,220 C 80,210 140,160 220,130 C 300,100 380,85 460,80 C 540,75 600,110 680,105 C 760,100 840,72 920,70 L 1000,68"
              fill="none"
              stroke="#1d4ed8"
              strokeLinecap="round"
              strokeWidth="2.5"
            />

            {/* Cognitive Load Curve */}
            <path
              d="M 0,260 C 90,250 170,220 250,215 C 330,210 420,195 500,190 C 580,185 640,160 720,165 C 800,170 890,195 1000,185 L 1000,320 L 0,320 Z"
              fill="url(#loadFill)"
            />
            <path
              d="M 0,260 C 90,250 170,220 250,215 C 330,210 420,195 500,190 C 580,185 640,160 720,165 C 800,170 890,195 1000,185"
              fill="none"
              stroke="#059669"
              strokeLinecap="round"
              strokeWidth="2"
            />

            {/* Checkpoint Markers */}
            <circle cx="250" cy="122" fill="#1d4ed8" r="5" stroke="#ffffff" strokeWidth="2" />
            <line stroke="#1d4ed8" strokeDasharray="2,2" strokeWidth="1.5" opacity="0.6" x1="250" x2="250" y1="122" y2="300" />

            <circle cx="680" cy="105" fill="#d97706" r="5" stroke="#ffffff" strokeWidth="2" />
            <line stroke="#d97706" strokeDasharray="2,2" strokeWidth="1.5" opacity="0.6" x1="680" x2="680" y1="105" y2="300" />

            <circle className="animate-ping" cx="960" cy="70" fill="#059669" r="6" stroke="#ffffff" strokeWidth="2" />
            <circle cx="960" cy="70" fill="#059669" r="5" stroke="#ffffff" strokeWidth="2" />
          </svg>

          {/* Event Cards Embedded on Graph */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md mt-space-md pt-space-md bg-surface-container-lowest/80 backdrop-blur-md rounded-lg p-space-md border border-surface-container">
            {timeline.map((evt) => (
              <div key={evt.num} className="flex items-start gap-space-sm">
                <div className={`w-6 h-6 rounded-full ${evt.color} flex items-center justify-center font-telemetry text-xs flex-shrink-0 mt-0.5 font-bold shadow-sm`}>
                  {evt.num}
                </div>
                <div>
                  <div className="flex items-center gap-space-xs">
                    <span className="font-telemetry text-xs font-bold text-on-surface">{evt.time}</span>
                    <span className={`font-headline text-xs font-semibold ${evt.textColor}`}>• {evt.title}</span>
                  </div>
                  <p className="font-body text-[11px] text-on-surface-variant leading-tight mt-0.5">{evt.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
