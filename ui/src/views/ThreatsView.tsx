import React, { useEffect, useState } from 'react';
import { useBiometrics } from '../context/BiometricsContext';
import { fetchAlerts } from '../lib/keysign';
import { DuressModal } from '../components/telemetry/DuressModal';

export const ThreatsView: React.FC = () => {
  const {
    live,
    neuromotorGauges,
    setDuressModalOpen,
    liveDwell,
    liveFlight,
    onKeyAction,
  } = useBiometrics();

  // Real silent alerts raised by the Threat head (backend/notify.py), newest first.
  const alertsTotal = live.tick?.heads?.threat?.alerts_total ?? 0;
  const [alerts, setAlerts] = useState<any[]>([]);
  useEffect(() => {
    let stop = false;
    const load = () => fetchAlerts(20).then((a) => { if (!stop) setAlerts([...a].reverse()); }).catch(() => {});
    load();
    const id = setInterval(load, 10000);
    return () => { stop = true; clearInterval(id); };
  }, [alertsTotal, live.connected]);
  const rows = alerts.map((a) => ({
    timestamp: new Date(a.ts * 1000).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' }),
    classification: a.kind === 'intruder' ? 'Intruder · identity mismatch' : 'Duress · sustained deviation',
    signature: (a.drivers || []).map(([f, z]: [string, number]) => `${f} ${z > 0 ? '+' : ''}${z.toFixed(1)}σ`).join(' · ') || 'sustained deviation from baseline',
    score: `${(a.distance ?? 0).toFixed(1)}σ · ${a.sustained_ticks ?? 0} ticks`,
    scoreColor: 'text-error',
    dotColor: a.kind === 'intruder' ? 'bg-error' : 'bg-tertiary',
    evaluation: a.identity ? `typing matched ${a.identity} (${Math.round((a.identity_confidence ?? 0) * 100)}%)` : 'declared user',
    evalIcon: a.kind === 'intruder' ? 'person_off' : 'rotating_light',
    raw: a,
  }));

  return (
    <div className="flex flex-col w-full gap-space-2xl">
      {/* Status & Incident Hero Banner */}
      <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-space-xl shadow-sm border border-surface-container">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-space-lg">
          <div className="flex items-start gap-space-lg">
            <div className="relative flex-shrink-0 w-16 h-16 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20">
              <span className="material-symbols-outlined text-[36px] fill">verified_user</span>
              <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-secondary ring-4 ring-surface-container-lowest animate-pulse"></span>
            </div>
            <div className="flex flex-col gap-space-2xs">
              <div className="flex items-center gap-space-sm flex-wrap">
                <span className="font-headline text-2xl font-bold text-on-surface">
                  Threat Engine: {neuromotorGauges.threatStatus}
                </span>
                <span
                  className={`px-space-sm py-space-2xs rounded-full font-telemetry text-xs uppercase tracking-wider font-semibold ${
                    neuromotorGauges.threatStatus === 'ALL CLEAR'
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-red-500/20 text-error animate-pulse'
                  }`}
                >
                  {neuromotorGauges.threatLevel}
                </span>
                <span className="px-space-sm py-space-2xs rounded-full bg-surface-container text-on-surface-variant font-telemetry text-xs border border-surface-container">
                  Kernel v4.19-RT
                </span>
              </div>
              <p className="font-body text-xs text-on-surface-variant max-w-4xl leading-relaxed">
                KeySign monitors involuntary neuromotor stress indicators: erratic flight time spikes, extreme dwell time jitter, rhythmic collapse, and panic correction patterns without recording keystroke characters or semantic contents.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-space-md self-start lg:self-center flex-shrink-0">
            <div className="flex flex-col text-right hidden sm:flex">
              <span className="font-headline text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">
                Entropy Buffer
              </span>
              <span className="font-telemetry text-sm text-on-surface font-semibold">
                99.98% Coherent
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDuressModalOpen(true)}
              className="flex items-center gap-space-xs px-space-lg py-space-sm rounded-lg bg-primary hover:bg-primary-dark text-white font-headline text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span>Simulate Attack</span>
            </button>
          </div>
        </div>
      </div>

      {/* Realtime Neuromotor Sensor Gauges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-lg">
        {/* Metric 1: Cadence Jitter */}
        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm border border-surface-container">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-space-2xs">
              <span className="font-headline text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
                Neuromotor Metric 01
              </span>
              <span className="font-headline text-sm font-bold text-on-surface">Cadence Jitter</span>
            </div>
            <span className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary border border-surface-container">
              <span className="material-symbols-outlined text-[18px]">graphic_eq</span>
            </span>
          </div>
          <div className="my-space-md">
            <div className="flex items-baseline justify-between mb-space-xs">
              <span className="font-telemetry text-2xl text-on-surface font-bold">
                {neuromotorGauges.cadenceJitter.toFixed(2)}
              </span>
              <span className="font-telemetry text-xs text-secondary font-medium">Safe &lt; 0.35</span>
            </div>
            <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  neuromotorGauges.cadenceJitter > 0.35 ? 'bg-error' : 'bg-secondary'
                }`}
                style={{ width: `${Math.min(neuromotorGauges.cadenceJitter * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="flex items-center justify-between font-telemetry text-xs text-on-surface-variant pt-space-xs border-t border-surface-container">
            <span>High-frequency tremor</span>
            <span className="text-secondary font-medium">
              {neuromotorGauges.cadenceJitter > 0.35 ? 'Critical Jitter' : 'Nominal'}
            </span>
          </div>
        </div>

        {/* Metric 2: Panic Bursting */}
        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm border border-surface-container">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-space-2xs">
              <span className="font-headline text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
                Neuromotor Metric 02
              </span>
              <span className="font-headline text-sm font-bold text-on-surface">Panic Bursting</span>
            </div>
            <span className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary border border-surface-container">
              <span className="material-symbols-outlined text-[18px]">speed</span>
            </span>
          </div>
          <div className="my-space-md">
            <div className="flex items-baseline justify-between mb-space-xs">
              <span className="font-telemetry text-2xl text-on-surface font-bold">
                {neuromotorGauges.panicBursting.toFixed(2)}
              </span>
              <span className="font-telemetry text-xs text-secondary font-medium">Safe &lt; 0.40</span>
            </div>
            <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  neuromotorGauges.panicBursting > 0.4 ? 'bg-error' : 'bg-secondary'
                }`}
                style={{ width: `${Math.min(neuromotorGauges.panicBursting * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="flex items-center justify-between font-telemetry text-xs text-on-surface-variant pt-space-xs border-t border-surface-container">
            <span>Rapid-error back-delete</span>
            <span className="text-secondary font-medium">
              {neuromotorGauges.panicBursting > 0.4 ? 'Panic Sequence' : 'Relaxed'}
            </span>
          </div>
        </div>

        {/* Metric 3: Flight Variance */}
        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm border border-surface-container">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-space-2xs">
              <span className="font-headline text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
                Neuromotor Metric 03
              </span>
              <span className="font-headline text-sm font-bold text-on-surface">Flight Variance</span>
            </div>
            <span className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary border border-surface-container">
              <span className="material-symbols-outlined text-[18px]">ssid_chart</span>
            </span>
          </div>
          <div className="my-space-md">
            <div className="flex items-baseline justify-between mb-space-xs">
              <div className="flex items-baseline gap-space-2xs">
                <span className="font-telemetry text-2xl text-on-surface font-bold">
                  {neuromotorGauges.flightVariance}
                </span>
                <span className="font-telemetry text-xs text-outline">ms</span>
              </div>
              <span className="font-telemetry text-xs text-secondary font-medium">Anomaly &gt; 65ms</span>
            </div>
            <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  neuromotorGauges.flightVariance > 65 ? 'bg-error' : 'bg-secondary'
                }`}
                style={{ width: `${Math.min((neuromotorGauges.flightVariance / 100) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="flex items-center justify-between font-telemetry text-xs text-on-surface-variant pt-space-xs border-t border-surface-container">
            <span>Key-up to key-down σ</span>
            <span className="text-secondary font-medium">±1.4ms drift</span>
          </div>
        </div>

        {/* Metric 4: Dwell Saturation */}
        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm border border-surface-container">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-space-2xs">
              <span className="font-headline text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
                Neuromotor Metric 04
              </span>
              <span className="font-headline text-sm font-bold text-on-surface">Dwell Saturation</span>
            </div>
            <span className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary border border-surface-container">
              <span className="material-symbols-outlined text-[18px]">compress</span>
            </span>
          </div>
          <div className="my-space-md">
            <div className="flex items-baseline justify-between mb-space-xs">
              <div className="flex items-baseline gap-space-2xs">
                <span className="font-telemetry text-2xl text-on-surface font-bold">
                  {neuromotorGauges.dwellSaturation}
                </span>
                <span className="font-telemetry text-xs text-outline">ms</span>
              </div>
              <span className="font-telemetry text-xs text-secondary font-medium">Hold Limit &gt; 220ms</span>
            </div>
            <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-secondary rounded-full transition-all duration-500"
                style={{ width: `${Math.min((neuromotorGauges.dwellSaturation / 220) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="flex items-center justify-between font-telemetry text-xs text-on-surface-variant pt-space-xs border-t border-surface-container">
            <span>Coercive freeze index</span>
            <span className="text-secondary font-medium">Uninhibited</span>
          </div>
        </div>
      </div>

      {/* Interactive Dual-Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* Left: Oscillography & Typing Chamber */}
        <div className="lg:col-span-8 flex flex-col gap-space-lg">
          <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container flex flex-col gap-space-md">
            <div className="flex items-center justify-between flex-wrap gap-space-sm">
              <div className="flex flex-col">
                <span className="font-headline text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Real-time Oscillography
                </span>
                <span className="font-headline text-base font-bold text-on-surface">
                  Neuromotor Cadence &amp; Flight Dispersion
                </span>
              </div>
              <div className="flex items-center gap-space-sm flex-wrap text-xs font-headline">
                <div className="flex items-center gap-space-2xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                  <span className="font-telemetry text-on-surface-variant">Baseline Match</span>
                </div>
                <div className="flex items-center gap-space-2xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
                  <span className="font-telemetry text-on-surface-variant">Fatigue Drift</span>
                </div>
                <div className="flex items-center gap-space-2xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-error"></span>
                  <span className="font-telemetry text-on-surface-variant">Duress Threshold</span>
                </div>
              </div>
            </div>

            {/* Oscillograph Canvas */}
            <div className="relative w-full h-56 bg-surface-container-low rounded-lg p-space-md overflow-hidden flex flex-col justify-between border border-surface-container">
              <div className="absolute left-0 right-0 top-10 flex items-center px-space-md pointer-events-none z-20">
                <span className="font-telemetry text-[11px] text-error bg-surface-container-lowest/90 px-space-xs rounded mr-space-xs border border-error/30 font-semibold">
                  Duress Trigger (65ms flight σ)
                </span>
                <div className="flex-1 h-px border-b border-dashed border-error/50"></div>
              </div>

              <div className="absolute left-0 right-0 top-24 flex items-center px-space-md pointer-events-none z-20">
                <span className="font-telemetry text-[11px] text-tertiary bg-surface-container-lowest/90 px-space-xs rounded mr-space-xs border border-tertiary/30 font-semibold">
                  Fatigue Tolerance Zone (35ms)
                </span>
                <div className="flex-1 h-px border-b border-tertiary/40"></div>
              </div>

              <svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 760 160">
                <path d="M0 40 H760 M0 80 H760 M0 120 H760" stroke="currentColor" className="text-outline-variant/30" strokeDasharray="3 3" strokeWidth="1" />
                <path d="M 0,135 Q 60,130 120,138 T 240,132 T 360,136 T 480,130 T 600,137 T 760,134 L 760,160 L 0,160 Z" fill="#059669" fillOpacity="0.12" />
                <path
                  d="M 0,135 Q 60,128 120,134 T 240,129 T 360,135 T 480,127 T 600,133 T 680,131 T 760,133"
                  stroke="#059669"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                />
                <circle className="animate-ping" cx="760" cy="133" fill="#059669" r="5" />
                <circle cx="760" cy="133" fill="#059669" r="4" />
              </svg>

              <div className="flex items-center justify-between font-telemetry text-xs text-outline z-10">
                <span>-60 sec window</span>
                <span>-40 sec</span>
                <span>-20 sec</span>
                <span className="text-secondary font-semibold">T-0 (Active Monitoring)</span>
              </div>
            </div>

            {/* Test Interactive Cadence Chamber */}
            <div className="bg-surface-container-low rounded-lg p-space-lg flex flex-col gap-space-sm border border-surface-container">
              <div className="flex items-center justify-between">
                <label className="font-headline text-xs text-on-surface font-semibold flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-[16px] text-primary">keyboard</span>
                  <span>Test Interactive Cadence Chamber</span>
                </label>
                <span className="font-telemetry text-xs text-on-surface-variant">
                  Flight: <strong className="text-on-surface">{liveFlight} ms</strong> • Dwell: <strong className="text-on-surface">{liveDwell} ms</strong>
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  onKeyDown={() => onKeyAction('down')}
                  onKeyUp={() => onKeyAction('up')}
                  placeholder="Type freely here to test live involuntary timing recognition..."
                  className="w-full px-space-lg py-space-md bg-surface-container-lowest rounded-lg font-body text-xs text-on-surface placeholder:text-outline outline-none focus:ring-2 focus:ring-primary shadow-sm border border-surface-container transition-all"
                />
                <span className="absolute right-space-md top-1/2 -translate-y-1/2 flex items-center gap-space-xs bg-surface-container px-space-sm py-space-2xs rounded text-primary font-telemetry text-[11px] border border-surface-container">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  RAM-Only Stream
                </span>
              </div>
              <p className="font-body text-xs text-on-surface-variant">
                Keystroke contents are scrubbed at the driver level before reaching analysis layers. Only scalar intervals (<span className="font-telemetry text-on-surface">t<sub>down</sub> - t<sub>up</sub></span>) are passed to RAM tensors.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Configured Duress Protocol */}
        <div className="lg:col-span-4 flex flex-col gap-space-lg">
          <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container flex flex-col gap-space-lg">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-space-2xs">
                <span className="font-headline text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Automated Shield
                </span>
                <span className="font-headline text-base font-bold text-on-surface">Configured Duress Protocol</span>
              </div>
              <span className="px-space-xs py-space-2xs rounded bg-surface-container text-primary font-telemetry text-xs font-semibold border border-surface-container">
                Auto-Armed
              </span>
            </div>
            <p className="font-body text-xs text-on-surface-variant leading-relaxed">
              If sustained involuntary distress patterns cross anomalous confidence thresholds (&gt;85%), KeySign initiates the following zero-friction silent workflow:
            </p>

            <div className="flex flex-col gap-space-md">
              {/* Action 1 */}
              <div className="flex items-start gap-space-md p-space-md bg-surface-container-low rounded-lg transition-all hover:bg-surface-container border border-surface-container">
                <div className="w-9 h-9 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm flex-shrink-0 border border-surface-container">
                  <span className="material-symbols-outlined text-[20px]">cell_tower</span>
                </div>
                <div className="flex flex-col gap-space-2xs flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-headline text-xs font-bold text-on-surface">Silent SOC Webhook</span>
                    <span className="font-telemetry text-[11px] text-secondary font-semibold">ACTIVE</span>
                  </div>
                  <p className="font-body text-[11px] text-on-surface-variant">
                    Sends high-priority silent SIG-DURESS packet with precision triangulation &amp; IP fingerprinting to SIEM.
                  </p>
                </div>
              </div>

              {/* Action 2 */}
              <div className="flex items-start gap-space-md p-space-md bg-surface-container-low rounded-lg transition-all hover:bg-surface-container border border-surface-container">
                <div className="w-9 h-9 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm flex-shrink-0 border border-surface-container">
                  <span className="material-symbols-outlined text-[20px]">masks</span>
                </div>
                <div className="flex flex-col gap-space-2xs flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-headline text-xs font-bold text-on-surface">Spoof Honey-Session</span>
                    <span className="font-telemetry text-[11px] text-secondary font-semibold">ACTIVE</span>
                  </div>
                  <p className="font-body text-[11px] text-on-surface-variant">
                    Silently swaps privileged production DB credentials with a synthetic honeynet replica; zero visual warning.
                  </p>
                </div>
              </div>

              {/* Action 3 */}
              <div className="flex items-start gap-space-md p-space-md bg-surface-container-low rounded-lg transition-all hover:bg-surface-container border border-surface-container">
                <div className="w-9 h-9 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm flex-shrink-0 border border-surface-container">
                  <span className="material-symbols-outlined text-[20px]">memory</span>
                </div>
                <div className="flex flex-col gap-space-2xs flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-headline text-xs font-bold text-on-surface">Audit RAM Snapshot</span>
                    <span className="font-telemetry text-[11px] text-secondary font-semibold">ACTIVE</span>
                  </div>
                  <p className="font-body text-[11px] text-on-surface-variant">
                    Freezes and cryptographically signs ephemeral behavioral telemetry tensors for forensic chain of custody.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-space-xs flex flex-col gap-space-xs">
              <div className="flex items-center justify-between font-headline text-xs text-on-surface-variant">
                <span>Fail-safe Verification</span>
                <span className="font-telemetry text-on-surface font-semibold">Double-Blind Multi-Vector</span>
              </div>
              <div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fatigue vs. Coercion Discrimination Banner */}
      <div className="rounded-xl bg-surface-container-low p-space-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-space-lg shadow-sm border border-surface-container">
        <div className="flex items-center gap-space-md">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/60 text-tertiary flex items-center justify-center flex-shrink-0 border border-amber-300/40">
            <span className="material-symbols-outlined text-[22px]">psychology_alt</span>
          </div>
          <div className="flex flex-col">
            <span className="font-headline text-xs font-bold text-on-surface">
              Fatigue vs. Coercion Discrimination Logic
            </span>
            <p className="font-body text-xs text-on-surface-variant leading-relaxed">
              KeySign enforces strict discriminant analysis. Standard cognitive exhaustion (afternoon fatigue, casual typos) degrades speed uniformly without inducing involuntary tremor jitter. Scarlet alerts are locked exclusively to true panic signatures.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-space-sm flex-shrink-0">
          <span className="font-telemetry text-xs text-on-surface-variant">False Negative Target:</span>
          <span className="px-space-sm py-space-2xs rounded bg-surface-container-lowest text-primary font-telemetry text-xs font-bold shadow-sm border border-surface-container">
            &lt; 0.001%
          </span>
        </div>
      </div>

      {/* Historical Incident Log */}
      <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-container flex flex-col gap-space-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm">
          <div>
            <span className="font-headline text-[11px] uppercase tracking-wider text-outline font-semibold">
              Audit Archive
            </span>
            <h3 className="font-headline text-base font-bold text-on-surface">Recent Anomaly &amp; Stress Telemetry</h3>
          </div>
          <div className="flex items-center gap-space-xs">
            <button
              type="button"
              onClick={() => window.open('http://localhost:8000/api/alerts', '_blank')}
              className="px-space-md py-space-xs rounded bg-surface-container-low hover:bg-surface-container text-on-surface font-headline text-xs transition-colors border border-surface-container font-semibold"
            >
              Export Forensic Log
            </button>
            <button className="p-space-xs rounded bg-surface-container-low hover:bg-surface-container text-on-surface-variant transition-colors border border-surface-container">
              <span className="material-symbols-outlined text-[18px]">filter_list</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-headline text-[11px] uppercase tracking-wider border-b border-surface-container">
                <th className="py-space-md px-space-lg rounded-l">Timestamp</th>
                <th className="py-space-md px-space-md">Event Classification</th>
                <th className="py-space-md px-space-md">Distress Signature</th>
                <th className="py-space-md px-space-md">Threat Score</th>
                <th className="py-space-md px-space-md">Engine Evaluation</th>
                <th className="py-space-md px-space-lg rounded-r text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/60 font-body text-xs">
              {rows.length === 0 && (
                <tr><td colSpan={6} className="py-space-lg px-space-lg text-on-surface-variant font-body text-xs">No silent alerts yet this session. They appear here the moment the engine escalates to Level 3.</td></tr>
              )}
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="py-space-lg px-space-lg font-telemetry text-on-surface font-medium whitespace-nowrap">
                    {row.timestamp}
                  </td>
                  <td className="py-space-lg px-space-md">
                    <div className="flex items-center gap-space-sm">
                      <span className={`w-2 h-2 rounded-full ${row.dotColor}`}></span>
                      <span className="font-headline font-semibold text-on-surface">{row.classification}</span>
                    </div>
                  </td>
                  <td className="py-space-lg px-space-md text-on-surface-variant">
                    {row.signature}
                  </td>
                  <td className={`py-space-lg px-space-md font-telemetry font-bold ${row.scoreColor}`}>
                    {row.score}
                  </td>
                  <td className="py-space-lg px-space-md">
                    <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-surface-container text-on-surface-variant font-telemetry text-[11px] border border-surface-container">
                      <span className="material-symbols-outlined text-[14px]">{row.evalIcon}</span>
                      {row.evaluation}
                    </span>
                  </td>
                  <td className="py-space-lg px-space-lg text-right">
                    <button
                      type="button"
                      onClick={() => alert(JSON.stringify(row.raw, null, 2))}
                      className="font-headline text-xs text-primary font-semibold hover:underline"
                    >
                      Inspect Vector
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Container */}
      <DuressModal />
    </div>
  );
};
