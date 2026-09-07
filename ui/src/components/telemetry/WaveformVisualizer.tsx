import React from 'react';
import { useBiometrics } from '../../context/BiometricsContext';

export const WaveformVisualizer: React.FC = () => {
  const { liveDwell, liveFlight } = useBiometrics();

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container p-space-xl flex flex-col gap-space-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[22px]">monitor_heart</span>
            <h2 className="font-headline text-lg font-bold text-on-surface">
              Live Temporal Dynamics Visualizer
            </h2>
          </div>
          <p className="font-body text-xs text-on-surface-variant mt-0.5">
            Microsecond dwell vs. flight latency profile: Target Profile vs Ingestion Stream
          </p>
        </div>

        <div className="flex items-center gap-space-md flex-wrap">
          <div className="flex items-center gap-space-xs">
            <span className="w-3 h-1.5 rounded-full bg-primary"></span>
            <span className="font-headline text-xs text-on-surface-variant">Registered Baseline</span>
          </div>
          <div className="flex items-center gap-space-xs">
            <span className="w-3 h-1.5 rounded-full bg-secondary"></span>
            <span className="font-headline text-xs text-on-surface-variant">Live Ingestion</span>
          </div>
          <div className="bg-surface-container-low px-space-sm py-space-2xs rounded text-on-surface font-telemetry text-xs border border-surface-container">
            Sampling: 1,000Hz
          </div>
        </div>
      </div>

      {/* Comparative Waveform Chart */}
      <div className="bg-surface-container-low rounded-lg p-space-lg flex flex-col gap-space-md relative overflow-hidden border border-surface-container">
        <div className="relative w-full h-56 flex flex-col justify-end">
          <svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 960 200">
            {/* Background Gridlines */}
            <line className="text-outline-variant/30" stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" x1="0" x2="960" y1="40" y2="40" />
            <line className="text-outline-variant/30" stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" x1="0" x2="960" y1="90" y2="90" />
            <line className="text-outline-variant/30" stroke="currentColor" strokeDasharray="4 4" strokeWidth="1" x1="0" x2="960" y1="140" y2="140" />

            {/* Dwell Time Fill/Stroke Baseline (Blue dashed) */}
            <path
              className="text-primary/40"
              d="M0 130 Q 60 110, 120 125 T 240 100 T 360 135 T 480 85 T 600 120 T 720 95 T 840 130 T 960 110"
              fill="none"
              stroke="currentColor"
              strokeDasharray="6 3"
              strokeWidth="2.5"
            />

            {/* Dwell Time Live Ingestion (Emerald solid) with dynamic curves */}
            <path
              className="text-secondary transition-all duration-300"
              d={`M0 132 Q 60 ${108 + (liveDwell - 84) * 0.2}, 120 122 T 240 103 T 360 ${132 - (liveFlight - 112) * 0.1} T 480 87 T 600 118 T 720 93 T 840 133 T 960 108`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            />

            {/* Pulsating Signal Anchor Points */}
            <circle cx="120" cy="122" r="3.5" className="fill-secondary animate-ping" opacity="0.6" />
            <circle cx="120" cy="122" r="3" className="fill-secondary" />
            <circle cx="480" cy="87" r="3.5" className="fill-secondary animate-ping" opacity="0.6" />
            <circle cx="480" cy="87" r="3" className="fill-secondary" />
            <circle cx="720" cy="93" r="3.5" className="fill-secondary animate-ping" opacity="0.6" />
            <circle cx="720" cy="93" r="3" className="fill-secondary" />

            {/* Flight Latency Step Bars */}
            <rect className="fill-primary/20" height="42" rx="2" width="16" x="70" y="140" />
            <rect className="fill-secondary" height="46" rx="1.5" width="8" x="74" y="136" />
            <rect className="fill-primary/20" height="62" rx="2" width="16" x="190" y="120" />
            <rect className="fill-secondary" height="64" rx="1.5" width="8" x="194" y="118" />
            <rect className="fill-primary/20" height="32" rx="2" width="16" x="310" y="150" />
            <rect className="fill-secondary" height="34" rx="1.5" width="8" x="314" y="148" />
            <rect className="fill-primary/20" height="87" rx="2" width="16" x="430" y="95" />
            <rect className="fill-secondary" height="85" rx="1.5" width="8" x="434" y="97" />
            <rect className="fill-primary/20" height="52" rx="2" width="16" x="550" y="130" />
            <rect className="fill-secondary" height="54" rx="1.5" width="8" x="554" y="128" />
            <rect className="fill-primary/20" height="72" rx="2" width="16" x="670" y="110" />
            <rect className="fill-secondary" height="74" rx="1.5" width="8" x="674" y="108" />
            <rect className="fill-primary/20" height="37" rx="2" width="16" x="790" y="145" />
            <rect className="fill-secondary" height="39" rx="1.5" width="8" x="794" y="143" />
            <rect className="fill-primary/20" height="57" rx="2" width="16" x="900" y="125" />
            <rect className="fill-secondary" height="60" rx="1.5" width="8" x="904" y="122" />
          </svg>

          {/* Oscilloscope Horizontal Sweep Scanner */}
          <div className="absolute inset-y-0 w-24 pointer-events-none bg-gradient-to-r from-transparent via-secondary/15 to-transparent animate-scan-sweep" />

          {/* Dynamic Micro-cursor line */}
          <div className="absolute top-2 bottom-2 left-3/4 w-0.5 bg-primary pointer-events-none flex flex-col justify-between items-center transition-all duration-300">
            <span className="bg-primary text-white font-telemetry text-[10px] px-1.5 py-0.5 rounded -translate-y-2 shadow-sm whitespace-nowrap flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
              Live Vector Δ 0.03ms
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-primary -translate-y-1 shadow-sm ring-2 ring-surface-container-low"></span>
          </div>
        </div>

        {/* Real-Time Metrics Strip below chart */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm pt-space-sm">
          <div className="bg-surface-container-lowest p-space-sm rounded-lg border border-surface-container flex flex-col">
            <span className="font-headline text-[11px] text-on-surface-variant uppercase font-medium">Mean Dwell Time (Hold)</span>
            <span className="font-telemetry text-sm font-semibold text-on-surface mt-0.5">
              {liveDwell}ms <span className="text-secondary font-normal">σ=4.1</span>
            </span>
          </div>
          <div className="bg-surface-container-lowest p-space-sm rounded-lg border border-surface-container flex flex-col">
            <span className="font-headline text-[11px] text-on-surface-variant uppercase font-medium">Mean Flight Time (Transit)</span>
            <span className="font-telemetry text-sm font-semibold text-on-surface mt-0.5">
              {liveFlight}ms <span className="text-secondary font-normal">σ=6.8</span>
            </span>
          </div>
          <div className="bg-surface-container-lowest p-space-sm rounded-lg border border-surface-container flex flex-col">
            <span className="font-headline text-[11px] text-on-surface-variant uppercase font-medium">Vector Entropy</span>
            <span className="font-telemetry text-sm font-semibold text-on-surface mt-0.5">
              0.962 H <span className="text-primary font-normal">(Optimal)</span>
            </span>
          </div>
          <div className="bg-surface-container-lowest p-space-sm rounded-lg border border-surface-container flex flex-col">
            <span className="font-headline text-[11px] text-on-surface-variant uppercase font-medium">Inference Latency</span>
            <span className="font-telemetry text-sm font-semibold text-secondary mt-0.5">
              0.38ms <span className="text-on-surface-variant font-normal">Local RAM</span>
            </span>
          </div>
        </div>
      </div>

      {/* Zero Content Guarantee Banner */}
      <div className="bg-surface-container-low px-space-md py-space-sm rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm border border-surface-container">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-primary text-[20px]">verified_user</span>
          <span className="font-telemetry text-xs text-on-surface">
            <strong className="font-medium text-primary">Extracted Features:</strong> [Dwell Time (ms)], [Flight Latency (ms)], [Di-graph Rhythm], [Cadence Pause]
          </span>
        </div>
        <div className="flex items-center gap-space-xs font-telemetry text-xs text-secondary bg-surface-container-lowest px-space-sm py-1 rounded shadow-sm border border-surface-container whitespace-nowrap">
          <span className="material-symbols-outlined text-[15px]">visibility_off</span>
          <span>Raw Keystroke ASCII: <strong>[NOT MONITORED / ZERO ACCESS]</strong></span>
        </div>
      </div>
    </div>
  );
};
