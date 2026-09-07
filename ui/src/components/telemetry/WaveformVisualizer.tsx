import React from 'react';
import { useBiometrics } from '../../context/BiometricsContext';

/**
 * Hold and flight for the last few dozen keystrokes.
 *
 * This panel used to draw a fixed decorative path with a hard-coded bar chart under it,
 * labelled "Registered Baseline vs Live Ingestion", and a metrics strip carrying a
 * sampling rate, a vector entropy and an inference latency that no part of the system
 * ever computed. A reviewer asking "what are those bars?" deserved a better answer than
 * "nothing". It now plots the pulses actually recorded in the browser and the window
 * statistics the backend actually sent, and shows nothing at all before anyone types.
 *
 * Note the honest limit: these are the keystrokes typed into this page. When the desktop
 * agent is capturing, the window statistics below still come from the backend, but the
 * per-key trace here stays empty, because the page is not the one seeing those keys.
 */

const PLOT_W = 960;
const PLOT_H = 200;
const PAD = 8;

const fmt = (v: number | undefined | null, digits = 0, unit = '') =>
  v == null || Number.isNaN(v) ? '–' : `${v.toFixed(digits)}${unit}`;

export const WaveformVisualizer: React.FC = () => {
  const { recentPulses, live } = useBiometrics();
  const f = live.tick?.features ?? null;

  // Only keystrokes measured in this window; no seeded or smoothed values.
  const pulses = recentPulses.slice(-48);
  const holds = pulses.map((p) => p.dwellMs);
  const flights = pulses.map((p) => p.flightMs);
  const hasTrace = pulses.length >= 4;

  const top = Math.max(200, ...holds, ...flights);
  const x = (i: number) => PAD + (i / Math.max(1, pulses.length - 1)) * (PLOT_W - PAD * 2);
  const y = (v: number) => PLOT_H - PAD - (v / top) * (PLOT_H - PAD * 2);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  // The person's own mean hold, from the baseline the backend is scoring against.
  const meanHold = f?.hold_mean;
  const meanFlight = f?.flight_mean;

  const stat = (label: string, value: React.ReactNode, note: string) => (
    <div className="bg-surface-container-lowest p-space-sm rounded-lg border border-outline-variant flex flex-col">
      <span className="font-headline text-[11px] text-on-surface-variant uppercase font-medium">{label}</span>
      <span className="font-telemetry text-sm font-semibold text-on-surface mt-0.5">{value}</span>
      <span className="font-body text-[10.5px] text-on-surface-variant mt-0.5">{note}</span>
    </div>
  );

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-xl flex flex-col gap-space-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[22px]">show_chart</span>
            <h2 className="font-headline text-lg font-bold text-on-surface">Hold and flight, key by key</h2>
          </div>
          <p className="font-body text-xs text-on-surface-variant mt-0.5">
            The last {pulses.length || 'few dozen'} keystrokes typed into this page, in milliseconds
          </p>
        </div>

        <div className="flex items-center gap-space-md flex-wrap">
          <div className="flex items-center gap-space-xs">
            <span className="w-3 h-1.5 rounded-full bg-primary" />
            <span className="font-headline text-xs text-on-surface-variant">Hold</span>
          </div>
          <div className="flex items-center gap-space-xs">
            <span className="w-3 h-1.5 rounded-full bg-secondary" />
            <span className="font-headline text-xs text-on-surface-variant">Flight</span>
          </div>
          <div className="bg-surface-container-low px-space-sm py-space-2xs rounded text-on-surface-variant font-telemetry text-xs border border-outline-variant">
            one point per key
          </div>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-lg p-space-lg flex flex-col gap-space-md relative overflow-hidden border border-outline-variant">
        <div className="relative w-full h-56 flex flex-col justify-end">
          {hasTrace ? (
            <svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}>
              {[0.25, 0.5, 0.75].map((g) => (
                <line
                  key={g}
                  className="text-outline-variant/30"
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                  x1="0"
                  x2={PLOT_W}
                  y1={PLOT_H * g}
                  y2={PLOT_H * g}
                />
              ))}

              {/* The window means the backend reported, as reference lines */}
              {meanHold != null && (
                <line className="text-primary/40" stroke="currentColor" strokeDasharray="7 4" strokeWidth="1.5"
                      x1="0" x2={PLOT_W} y1={y(meanHold)} y2={y(meanHold)} />
              )}
              {meanFlight != null && (
                <line className="text-secondary/40" stroke="currentColor" strokeDasharray="7 4" strokeWidth="1.5"
                      x1="0" x2={PLOT_W} y1={y(meanFlight)} y2={y(meanFlight)} />
              )}

              <path className="text-primary" d={path(holds)} fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinejoin="round" strokeLinecap="round" />
              <path className="text-secondary" d={path(flights)} fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinejoin="round" strokeLinecap="round" />

              {/* The most recent key */}
              <circle cx={x(pulses.length - 1)} cy={y(holds[holds.length - 1])} r="4" className="fill-primary" />
              <circle cx={x(pulses.length - 1)} cy={y(flights[flights.length - 1])} r="4" className="fill-secondary" />
            </svg>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-center">
              <span className="font-body text-sm text-on-surface-variant">Nothing to plot yet</span>
              <span className="font-body text-xs text-on-surface-variant/80 max-w-sm">
                Type anywhere on this page and each key adds a point. With the desktop agent capturing,
                the window statistics below still update; this trace does not, because the keys are
                going to another application.
              </span>
            </div>
          )}
        </div>

        {/* Window statistics, straight from the latest tick */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm pt-space-sm">
          {stat('Mean hold', <>{fmt(f?.hold_mean, 0, 'ms')}</>, `spread ${fmt(f?.hold_std, 1, 'ms')}`)}
          {stat('Mean flight', <>{fmt(f?.flight_mean, 0, 'ms')}</>, `spread ${fmt(f?.flight_std, 1, 'ms')}`)}
          {stat('Rhythm variance', <>{fmt(f?.rhythm_cv, 2)}</>, 'coefficient of variation')}
          {stat('Speed', <>{fmt(f?.speed_kps, 1)}</>, 'keys per second')}
        </div>
        <p className="font-body text-[11px] text-on-surface-variant">
          {f
            ? `From the last ${live.tick?.window_s ?? 10} second window, ${live.tick?.n_keys ?? 0} keys.`
            : 'Waiting for a window from the backend. Nothing above is filled in until one arrives.'}
        </p>
      </div>

      <div className="bg-surface-container-low px-space-md py-space-sm rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm border border-outline-variant">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-primary text-[20px]">visibility_off</span>
          <span className="font-body text-xs text-on-surface">
            What is measured: how long each key is held, the gap to the next, the pauses, and how often
            you correct yourself.
          </span>
        </div>
        <span className="font-body text-xs text-on-surface-variant whitespace-nowrap">
          What is not: the characters.
        </span>
      </div>
    </div>
  );
};
