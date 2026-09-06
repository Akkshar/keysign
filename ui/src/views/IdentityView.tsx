import React, { useState } from 'react';
import { useBiometrics } from '../context/BiometricsContext';
import { mockDigraphTimings, mockIdentityAuditEvents } from '../data/mockIdentity';
import { RadialGauge } from '../components/common/RadialGauge';

export const IdentityView: React.FC = () => {
  const { userProfile, liveConfidence } = useBiometrics();

  const [policyStepUp, setPolicyStepUp] = useState(true);
  const [policyInstantLock, setPolicyInstantLock] = useState(true);
  const [policyAdaptive, setPolicyAdaptive] = useState(true);

  return (
    <div className="flex flex-col w-full gap-space-2xl">
      {/* Profile & Real-Time Confidence Banner */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-xl items-stretch">
        {/* Enrolled Subject Identity Card */}
        <div className="xl:col-span-8 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none opacity-60"></div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-lg relative z-10">
            <div className="flex items-center gap-space-lg">
              <div className="relative">
                <img
                  className="w-20 h-20 rounded-full object-cover shadow-sm ring-4 ring-surface-container-low"
                  alt={userProfile.name}
                  src={userProfile.avatarUrl}
                />
                <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-secondary ring-2 ring-surface-container-lowest animate-pulse" title="Biometrics Actively Streamed"></span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-space-sm flex-wrap">
                  <span className="font-headline text-xl font-bold text-on-surface">{userProfile.name}</span>
                  <span className="font-headline text-xs px-space-sm py-space-2xs rounded bg-surface-container text-primary font-medium border border-surface-container">
                    Profile #{userProfile.id}
                  </span>
                  <span className="font-headline text-xs px-space-sm py-space-2xs rounded bg-secondary-container text-on-secondary-container font-semibold flex items-center gap-space-2xs">
                    <span className="material-symbols-outlined text-[13px]">verified_user</span> Continuous Active
                  </span>
                </div>
                <p className="font-body text-xs text-on-surface-variant mt-0.5">{userProfile.title}</p>
                <div className="flex items-center gap-space-md mt-space-sm text-outline font-telemetry text-xs flex-wrap">
                  <span className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-[15px] text-primary">model_training</span>
                    {userProfile.enrolledSamples.toLocaleString()} Keystroke Pairs Analyzed
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-[15px] text-secondary">memory</span>
                    Model {userProfile.modelVersion}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex md:flex-col items-end justify-between md:justify-center gap-space-xs pt-space-sm md:pt-0">
              <span className="font-headline text-[11px] uppercase tracking-wider text-outline font-semibold">
                Entropy Integrity
              </span>
              <div className="flex items-baseline gap-space-xs">
                <span className="font-telemetry text-2xl text-on-surface font-bold">
                  {userProfile.entropyIntegrity}%
                </span>
                <span className="font-headline text-xs text-secondary font-medium">{userProfile.entropyStatus}</span>
              </div>
              <span className="font-telemetry text-xs text-outline">Threshold Delta: ±0.8%</span>
            </div>
          </div>

          {/* Linear Micro-Metrics Stream */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-md pt-space-xl mt-space-lg relative z-10 border-t border-surface-container">
            <div className="flex flex-col bg-surface-container-low p-space-md rounded-lg border border-surface-container">
              <span className="font-headline text-[11px] text-on-surface-variant font-medium">Dwell Stability</span>
              <span className="font-telemetry text-sm font-semibold text-on-surface mt-0.5">
                {userProfile.meanDwell} ms ± {userProfile.dwellStdDev}ms
              </span>
              <span className="font-telemetry text-xs text-secondary mt-space-2xs">Gaussian fit: 0.98</span>
            </div>
            <div className="flex flex-col bg-surface-container-low p-space-md rounded-lg border border-surface-container">
              <span className="font-headline text-[11px] text-on-surface-variant font-medium">Flight Mean Cadence</span>
              <span className="font-telemetry text-sm font-semibold text-on-surface mt-0.5">
                {userProfile.meanFlight} ms
              </span>
              <span className="font-telemetry text-xs text-primary mt-space-2xs">Low variance (σ {userProfile.flightStdDev})</span>
            </div>
            <div className="flex flex-col bg-surface-container-low p-space-md rounded-lg border border-surface-container">
              <span className="font-headline text-[11px] text-on-surface-variant font-medium">Rhythm Synchrony</span>
              <span className="font-telemetry text-sm font-semibold text-on-surface mt-0.5">
                {userProfile.rhythmSynchrony}%
              </span>
              <span className="font-telemetry text-xs text-secondary mt-space-2xs">Optimal cognitive tier</span>
            </div>
            <div className="flex flex-col bg-surface-container-low p-space-md rounded-lg border border-surface-container">
              <span className="font-headline text-[11px] text-on-surface-variant font-medium">Baseline Recalibrated</span>
              <span className="font-telemetry text-sm font-semibold text-on-surface mt-0.5">
                {userProfile.lastRecalibrated}
              </span>
              <span className="font-telemetry text-xs text-outline mt-space-2xs">Zero storage retained</span>
            </div>
          </div>
        </div>

        {/* Live Confidence Radial Gauge Card */}
        <div className="xl:col-span-4 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container flex flex-col justify-between items-center text-center relative">
          <div className="w-full flex items-center justify-between">
            <span className="font-headline text-[11px] uppercase tracking-wider text-outline font-semibold">
              Continuous Match Status
            </span>
            <span className="inline-flex items-center gap-space-2xs font-telemetry text-xs text-secondary px-space-xs py-space-2xs rounded bg-surface-container-low border border-surface-container">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping"></span> Live (0.4ms)
            </span>
          </div>

          <RadialGauge score={liveConfidence} size={190} label="Confidence" subtext="Guarded Enclave" />

          <div className="w-full bg-surface-container-low rounded-lg p-space-sm flex items-center justify-between border border-surface-container mt-space-md">
            <div className="flex items-center gap-space-xs text-left">
              <span className="material-symbols-outlined text-[18px] text-primary">security_update_good</span>
              <span className="font-body text-xs text-on-surface-variant font-medium">
                Lockout Margin: <strong className="text-on-surface">&gt; 25% drop</strong>
              </span>
            </div>
            <span className="font-telemetry text-xs px-space-xs py-space-2xs rounded bg-surface-container-lowest text-secondary font-medium border border-surface-container">
              Guarded
            </span>
          </div>
        </div>
      </div>

      {/* Behavioral Dynamics Breakdown Grid */}
      <div className="flex flex-col gap-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
          <div>
            <h3 className="font-headline text-base font-bold text-on-surface">
              Sub-Conscious Behavioral Dynamics Breakdown
            </h3>
            <p className="font-body text-xs text-on-surface-variant mt-0.5">
              High-dimensional neuro-mechanical metrics calculated locally per hardware stroke buffer
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-space-xs bg-surface-container-lowest px-space-sm py-space-xs rounded-lg shadow-sm border border-surface-container font-telemetry text-xs text-outline">
            <span className="material-symbols-outlined text-[14px]">tune</span> Resolution: 0.1ms Microsecond Latency
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg">
          {/* Digraph Timing Matrix */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-space-sm">
                <div className="flex flex-col">
                  <span className="font-headline text-[11px] uppercase tracking-wider text-outline font-semibold">
                    Digraph Timing Matrix
                  </span>
                  <span className="font-headline text-sm font-bold text-on-surface mt-0.5">
                    Standard Transitions
                  </span>
                </div>
                <span className="material-symbols-outlined text-primary text-[20px]">keyboard_double_arrow_right</span>
              </div>
              <p className="font-body text-xs text-on-surface-variant pb-space-md">
                Reference digraph latencies (illustrative; the live model uses 22 aggregate timing features).
              </p>

              <div className="flex flex-col gap-space-xs bg-surface-container-low p-space-sm rounded-lg border border-surface-container">
                {mockDigraphTimings.map((d) => (
                  <div key={d.digraph} className="flex items-center justify-between bg-surface-container-lowest px-space-sm py-space-2xs rounded border border-surface-container/60">
                    <div className="flex items-center gap-space-sm">
                      <span className="font-telemetry text-xs font-bold text-on-surface w-8">{d.digraph}</span>
                      <div className="w-16 h-1.5 bg-surface-container rounded-full overflow-hidden">
                        <div
                          className={`h-full ${d.type === 'primary' ? 'bg-primary' : 'bg-secondary'}`}
                          style={{ width: `${d.deltaPercent}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-telemetry text-xs font-semibold text-on-surface">{d.dwellMs} ms</span>
                      <span className="font-telemetry text-[10px] text-secondary ml-1">{d.varianceText}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-space-md flex items-center justify-between border-t border-surface-container mt-space-sm">
              <span className="font-telemetry text-xs text-outline">Mean Digraph Variance</span>
              <span className="font-telemetry text-xs font-semibold text-secondary">±3.8 ms</span>
            </div>
          </div>

          {/* Dwell Time Gaussian Bell Curve */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-space-sm">
                <div className="flex flex-col">
                  <span className="font-headline text-[11px] uppercase tracking-wider text-outline font-semibold">
                    Dwell Time Distribution
                  </span>
                  <span className="font-headline text-sm font-bold text-on-surface mt-0.5">
                    84ms Trained Peak
                  </span>
                </div>
                <span className="material-symbols-outlined text-secondary text-[20px]">show_chart</span>
              </div>
              <p className="font-body text-xs text-on-surface-variant pb-space-xs">
                Down-to-up contact time vs anomaly cutoff zones.
              </p>

              <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col items-center border border-surface-container">
                <svg className="w-full h-24 overflow-visible" viewBox="0 0 240 90">
                  <rect className="fill-error opacity-10" height="80" width="50" x="0" y="0" />
                  <rect className="fill-error opacity-10" height="80" width="60" x="180" y="0" />
                  <rect className="fill-secondary-container opacity-20" height="80" width="130" x="50" y="0" />
                  <line stroke="#c4c5d7" strokeDasharray="2,2" strokeWidth="1" x1="0" x2="240" y1="80" y2="80" />
                  <line stroke="#ba1a1a" strokeDasharray="3,3" strokeWidth="1" x1="50" x2="50" y1="10" y2="80" />
                  <line stroke="#ba1a1a" strokeDasharray="3,3" strokeWidth="1" x1="180" x2="180" y1="10" y2="80" />
                  <path d="M 10 80 Q 70 78 95 40 Q 115 5 120 5 Q 125 5 145 40 Q 170 78 230 80" fill="none" stroke="#006c4a" strokeWidth="2.5" />
                  <circle className="fill-secondary" cx="120" cy="5" r="3.5" />
                  <line stroke="#006c4a" strokeDasharray="2,2" strokeWidth="1" x1="120" x2="120" y1="5" y2="80" />
                </svg>
                <div className="w-full flex justify-between font-telemetry text-[11px] text-outline mt-1 px-1">
                  <span className="text-error font-medium">&lt;50ms</span>
                  <span className="text-secondary font-semibold">84ms (Baseline)</span>
                  <span className="text-error font-medium">&gt;140ms</span>
                </div>
              </div>
            </div>
            <div className="pt-space-sm flex items-center justify-between border-t border-surface-container mt-space-sm">
              <span className="font-telemetry text-xs text-outline">Intruder Anomaly Delta</span>
              <span className="font-telemetry text-xs text-secondary font-medium">&gt; 3.2 σ divergence</span>
            </div>
          </div>

          {/* Flight Time Variance Scatter Matrix */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-space-sm">
                <div className="flex flex-col">
                  <span className="font-headline text-[11px] uppercase tracking-wider text-outline font-semibold">
                    Flight Time Variance
                  </span>
                  <span className="font-headline text-sm font-bold text-on-surface mt-0.5">
                    Cadence Stability
                  </span>
                </div>
                <span className="material-symbols-outlined text-primary text-[20px]">scatter_plot</span>
              </div>
              <p className="font-body text-xs text-on-surface-variant pb-space-xs">
                Interval between key-release and subsequent keystroke down.
              </p>

              <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col items-center border border-surface-container">
                <div className="w-full h-24 relative bg-surface-container-lowest rounded p-1 overflow-hidden border border-surface-container">
                  <div className="absolute top-6 bottom-6 left-0 right-0 bg-secondary-container/20"></div>
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-secondary opacity-40"></div>
                  {/* Scatter Dots */}
                  {[8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96].map((x, i) => (
                    <div
                      key={i}
                      className="absolute w-1.5 h-1.5 rounded-full bg-secondary"
                      style={{ left: `${x}%`, top: `${48 + ((i % 3) - 1) * 6}%` }}
                    />
                  ))}
                  <div className="absolute left-[60%] top-[12%] w-1.5 h-1.5 rounded-full bg-tertiary" title="Micropause filtered"></div>
                </div>
                <div className="w-full flex justify-between font-telemetry text-[11px] text-outline mt-1 px-1">
                  <span>T-60s</span>
                  <span className="text-on-surface-variant font-medium">Mean: 112ms</span>
                  <span>Now</span>
                </div>
              </div>
            </div>
            <div className="pt-space-sm flex items-center justify-between border-t border-surface-container mt-space-sm">
              <span className="font-telemetry text-xs text-outline">Erratic Pauses Flagged</span>
              <span className="font-telemetry text-xs font-semibold text-on-surface">0 anomalies / 2h</span>
            </div>
          </div>

          {/* Hand Dominance Balance Scale */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-space-sm">
                <div className="flex flex-col">
                  <span className="font-headline text-[11px] uppercase tracking-wider text-outline font-semibold">
                    Hand Dominance Balance
                  </span>
                  <span className="font-headline text-sm font-bold text-on-surface mt-0.5">
                    51% L / 49% R
                  </span>
                </div>
                <span className="material-symbols-outlined text-primary text-[20px]">pan_tool</span>
              </div>
              <p className="font-body text-xs text-on-surface-variant pb-space-xs">
                Symmetry breakdown across split keyboard physical planes.
              </p>

              <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-space-sm border border-surface-container">
                <div className="flex items-center justify-between text-on-surface font-telemetry text-xs font-medium">
                  <span>Left: 51.2%</span>
                  <span>Right: 48.8%</span>
                </div>
                <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden flex">
                  <div className="h-full bg-primary transition-all" style={{ width: '51.2%' }}></div>
                  <div className="h-full bg-secondary transition-all" style={{ width: '48.8%' }}></div>
                </div>
                <div className="grid grid-cols-2 gap-space-xs text-center font-telemetry text-xs">
                  <div className="bg-surface-container-lowest py-1 rounded border border-surface-container">
                    <span className="text-outline text-[10px] block">L-Avg Hold</span>
                    <span className="text-on-surface font-semibold">85.4 ms</span>
                  </div>
                  <div className="bg-surface-container-lowest py-1 rounded border border-surface-container">
                    <span className="text-outline text-[10px] block">R-Avg Hold</span>
                    <span className="text-on-surface font-semibold">83.1 ms</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="pt-space-sm flex items-center justify-between border-t border-surface-container mt-space-sm">
              <span className="font-telemetry text-xs text-outline">Equilibrium Status</span>
              <span className="font-telemetry text-xs text-secondary font-medium">Near-Ideal Symmetry</span>
            </div>
          </div>
        </div>
      </div>

      {/* Policy Engine & Hardware Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
        {/* Left: Policy Rules */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container flex flex-col gap-space-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-headline text-[11px] uppercase tracking-wider text-outline font-semibold">
                Autonomous Enforcement
              </span>
              <h3 className="font-headline text-base font-bold text-on-surface mt-0.5">
                Zero-Trust Continuous Policy Engine
              </h3>
            </div>
            <span className="material-symbols-outlined text-primary text-[24px]">policy</span>
          </div>
          <p className="font-body text-xs text-on-surface-variant">
            Configure real-time biometric policy actions. Keystroke telemetry triggers instant local enforcement without outbound cloud latency.
          </p>

          <div className="flex flex-col gap-space-md">
            {/* Rule 1 */}
            <div className="bg-surface-container-low p-space-md rounded-lg flex items-center justify-between gap-space-md border border-surface-container">
              <div className="flex items-start gap-space-md">
                <div className="w-8 h-8 rounded bg-surface-container-lowest flex items-center justify-center text-primary mt-0.5 shadow-sm flex-shrink-0 border border-surface-container">
                  <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-headline text-xs font-semibold text-on-surface">
                    Trigger Step-Up Auth if Confidence &lt; 85% for 15 Keystrokes
                  </span>
                  <p className="font-body text-[11px] text-on-surface-variant mt-0.5">
                    Prompts for hardware FIDO2 security key without terminating open work buffers.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPolicyStepUp((p) => !p)}
                className={`w-11 h-6 rounded-full relative p-0.5 cursor-pointer flex-shrink-0 transition-colors ${
                  policyStepUp ? 'bg-primary' : 'bg-surface-container-highest'
                }`}
              >
                <span className={`w-5 h-5 bg-white rounded-full block transform transition-transform shadow-sm ${
                  policyStepUp ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Rule 2 */}
            <div className="bg-surface-container-low p-space-md rounded-lg flex items-center justify-between gap-space-md border border-surface-container">
              <div className="flex items-start gap-space-md">
                <div className="w-8 h-8 rounded bg-surface-container-lowest flex items-center justify-center text-error mt-0.5 shadow-sm flex-shrink-0 border border-surface-container">
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-headline text-xs font-semibold text-on-surface">
                    Instant Screen Lock on Total Biometric Mismatch (&lt; 40%)
                  </span>
                  <p className="font-body text-[11px] text-on-surface-variant mt-0.5">
                    Instantly zeroes out in-memory access tokens and locks OS session upon unauthorized physical takeover.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPolicyInstantLock((p) => !p)}
                className={`w-11 h-6 rounded-full relative p-0.5 cursor-pointer flex-shrink-0 transition-colors ${
                  policyInstantLock ? 'bg-primary' : 'bg-surface-container-highest'
                }`}
              >
                <span className={`w-5 h-5 bg-white rounded-full block transform transition-transform shadow-sm ${
                  policyInstantLock ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Rule 3 */}
            <div className="bg-surface-container-low p-space-md rounded-lg flex items-center justify-between gap-space-md border border-surface-container">
              <div className="flex items-start gap-space-md">
                <div className="w-8 h-8 rounded bg-surface-container-lowest flex items-center justify-center text-secondary mt-0.5 shadow-sm flex-shrink-0 border border-surface-container">
                  <span className="material-symbols-outlined text-[18px]">autorenew</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-headline text-xs font-semibold text-on-surface">
                    Adaptive Baseline Learning (Slow ambient drift recalibration)
                  </span>
                  <p className="font-body text-[11px] text-on-surface-variant mt-0.5">
                    Accounts for natural fatigue, circadian speed variations, and minor hand posture transitions gradually.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPolicyAdaptive((p) => !p)}
                className={`w-11 h-6 rounded-full relative p-0.5 cursor-pointer flex-shrink-0 transition-colors ${
                  policyAdaptive ? 'bg-primary' : 'bg-surface-container-highest'
                }`}
              >
                <span className={`w-5 h-5 bg-white rounded-full block transform transition-transform shadow-sm ${
                  policyAdaptive ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>

          <div className="pt-space-xs flex items-center justify-between text-outline text-xs">
            <span className="font-telemetry flex items-center gap-space-2xs text-secondary">
              <span className="material-symbols-outlined text-[14px]">shield</span> Cryptographic Policy Signature Validated
            </span>
            <button
              type="button"
              onClick={() => { setPolicyStepUp(true); setPolicyInstantLock(true); setPolicyAdaptive(true); }}
              className="font-headline text-xs text-primary font-semibold hover:underline"
            >
              Restore Factory Zero-Trust Defaults
            </button>
          </div>
        </div>

        {/* Right: Hardware Driver Telemetry */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-space-sm">
              <span className="font-headline text-[11px] uppercase tracking-wider text-outline font-semibold">
                Local Sensor Pipeline
              </span>
              <span className="font-telemetry text-xs text-secondary font-medium">Direct Kernel Link</span>
            </div>
            <h3 className="font-headline text-base font-bold text-on-surface">Hardware Driver Telemetry</h3>
            <p className="font-body text-xs text-on-surface-variant mt-0.5 pb-space-lg">
              KeySign hooks into the OS HID driver stack directly below application-level listeners.
            </p>

            <div className="flex flex-col gap-space-sm">
              <div className="flex items-center justify-between py-space-xs px-space-sm bg-surface-container-low rounded border border-surface-container">
                <span className="font-headline text-xs text-on-surface">Active Physical Input</span>
                <span className="font-telemetry text-xs text-on-surface font-semibold">MacBook Pro Magic Keyboard (Internal)</span>
              </div>
              <div className="flex items-center justify-between py-space-xs px-space-sm bg-surface-container-low rounded border border-surface-container">
                <span className="font-headline text-xs text-on-surface">Clock Timestamp Precision</span>
                <span className="font-telemetry text-xs text-secondary font-semibold">Nanosecond Monotonic (mach_time)</span>
              </div>
              <div className="flex items-center justify-between py-space-xs px-space-sm bg-surface-container-low rounded border border-surface-container">
                <span className="font-headline text-xs text-on-surface">Content Scrubbing Status</span>
                <span className="font-telemetry text-xs text-secondary font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span> Character Zeroed
                </span>
              </div>
              <div className="flex items-center justify-between py-space-xs px-space-sm bg-surface-container-low rounded border border-surface-container">
                <span className="font-headline text-xs text-on-surface">Local Memory Enclave</span>
                <span className="font-telemetry text-xs text-primary font-semibold">Secure Enclave RAM (Encrypted)</span>
              </div>
            </div>
          </div>

          <div className="mt-space-xl p-space-md bg-surface-container rounded-lg flex items-center gap-space-md border border-surface-container">
            <span className="material-symbols-outlined text-primary text-[28px]">lock_clock</span>
            <div className="flex flex-col">
              <span className="font-headline text-xs font-bold text-on-surface">Continuous Heartbeat OK</span>
              <span className="font-telemetry text-[11px] text-on-surface-variant">Last verifiable proof generated at 14:02:18 UTC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Trail & Verification Events */}
      <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container flex flex-col gap-space-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
          <div>
            <span className="font-headline text-[11px] uppercase tracking-wider text-outline font-semibold">
              Immutable Behavioral Log
            </span>
            <h3 className="font-headline text-base font-bold text-on-surface mt-0.5">
              Recent Verification Checkpoints &amp; Context Events
            </h3>
          </div>
          <div className="flex items-center gap-space-sm">
            <span className="font-headline text-xs text-outline">Filter:</span>
            <span className="px-space-sm py-space-2xs bg-surface-container-low rounded text-on-surface font-headline text-xs font-medium border border-surface-container">
              All Contexts
            </span>
            <button className="p-space-xs text-outline hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[18px]">download</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-outline font-headline text-[11px] uppercase tracking-wider bg-surface-container-low border-b border-surface-container">
                <th className="py-space-sm px-space-md rounded-l">Timestamp (UTC)</th>
                <th className="py-space-sm px-space-md">Application Context</th>
                <th className="py-space-sm px-space-md">Sample Buffer</th>
                <th className="py-space-sm px-space-md">Match Score</th>
                <th className="py-space-sm px-space-md">Variance Vector</th>
                <th className="py-space-sm px-space-md text-right rounded-r">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/60 text-xs font-body">
              {mockIdentityAuditEvents.map((row, i) => (
                <tr key={i} className="hover:bg-surface-container-low/40 transition-colors">
                  <td className="py-space-md px-space-md font-telemetry text-on-surface-variant whitespace-nowrap">
                    {row.timestamp}
                  </td>
                  <td className="py-space-md px-space-md font-headline font-semibold text-on-surface">
                    {row.context}
                  </td>
                  <td className="py-space-md px-space-md font-telemetry text-on-surface-variant">
                    {row.sampleBuffer}
                  </td>
                  <td className="py-space-md px-space-md font-telemetry font-bold text-secondary">
                    {row.matchScore}
                  </td>
                  <td className="py-space-md px-space-md font-telemetry text-on-surface-variant">
                    {row.varianceVector}
                  </td>
                  <td className="py-space-md px-space-md text-right">
                    <span className="px-space-xs py-0.5 rounded text-[11px] font-telemetry bg-secondary-container text-on-secondary-container font-semibold inline-block">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
