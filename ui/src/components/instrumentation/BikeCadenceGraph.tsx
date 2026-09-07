import React, { useEffect, useState, useRef, useCallback } from 'react';

interface BikeCadenceGraphProps {
  className?: string;
}

/**
 * Interactive, lag-free bicycle navigating the Neuromotor Cadence graph.
 * Steer and pedal using Arrow Keys (← / →) or on-screen touch pedals.
 */
export const BikeCadenceGraph: React.FC<BikeCadenceGraphProps> = ({
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // SVG Virtual Canvas Dimensions
  const width = 800;
  const height = 240;

  // Lightweight state kept in ref for 60 FPS requestAnimationFrame with zero lag
  const bikeState = useRef({
    x: 80,
    vx: 0,
    wheelAngle: 0,
    isGas: false,
    isBrake: false,
  });

  // UI state synchronized for rendering
  const [renderState, setRenderState] = useState({
    x: 80,
    y: 120,
    angle: 0,
    wheelAngle: 0,
    speedKmH: 0,
    isGas: false,
    isBrake: false,
  });

  // Cadence terrain profile: y = f(x)
  // Generates hill and valley contours for the bike to ride on
  const getElevationY = useCallback((x: number): number => {
    const w1 = Math.sin(x * 0.016) * 36;
    const w2 = Math.cos(x * 0.034) * 20;
    const w3 = Math.sin(x * 0.007 + 1.2) * 26;
    return 120 + w1 + w2 + w3;
  }, []);

  // Keyboard controls listener (ArrowLeft / ArrowRight / A / D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        bikeState.current.isGas = true;
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        bikeState.current.isBrake = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        bikeState.current.isGas = false;
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        bikeState.current.isBrake = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 60 FPS lightweight smooth physics loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      const state = bikeState.current;

      // Acceleration & Braking
      const accel = 22.0;
      const brakeForce = 32.0;

      if (state.isGas) {
        state.vx += accel * dt;
      } else if (state.isBrake) {
        // Brake decelerates the bike smoothly to 0 without reversing backwards
        state.vx = Math.max(0, state.vx - brakeForce * dt);
        if (state.vx < 0.05) {
          state.vx = 0;
        }
      }

      // Slope gravity influence (accelerates downhill, resists uphill)
      // When brake is held, brake calipers hold the bike stationary
      const delta = 4;
      const prevY = getElevationY(Math.max(0, state.x - delta));
      const nextY = getElevationY(Math.min(width, state.x + delta));
      const slopeAngleRad = Math.atan2(nextY - prevY, delta * 2);

      if (!state.isBrake) {
        const slopeGravity = Math.sin(slopeAngleRad) * 8.0;
        state.vx += slopeGravity * dt;

        // Natural rolling friction & aerodynamic damping
        state.vx *= Math.pow(0.93, dt * 60);
      }

      // Speed limits: bike only moves forward, cannot reverse or go backwards
      const maxSpeed = 16.0;
      state.vx = Math.max(0, Math.min(maxSpeed, state.vx));

      // Snappy stop when coasting at negligible speed
      if (!state.isGas && state.vx < 0.03) {
        state.vx = 0;
      }

      // Update position along graph
      state.x += state.vx * 60 * dt;

      // Infinite smooth loop across graph
      if (state.x > width - 15) {
        state.x = 20;
      } else if (state.x < 15) {
        state.x = width - 20;
      }

      // Wheel rotation
      state.wheelAngle += state.vx * 16;

      const currentY = getElevationY(state.x);
      const slopeAngleDeg = (slopeAngleRad * 180) / Math.PI;

      setRenderState({
        x: state.x,
        y: currentY,
        angle: slopeAngleDeg,
        wheelAngle: state.wheelAngle,
        speedKmH: Math.round(Math.abs(state.vx) * 3.6 * 1.4),
        isGas: state.isGas,
        isBrake: state.isBrake,
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [getElevationY]);

  // Generate SVG path string for the topography
  const numPoints = 80;
  const pathPoints: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * width;
    const y = getElevationY(x);
    pathPoints.push([x, y]);
  }

  const dCurve = pathPoints.reduce((acc, [x, y], idx) => {
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  const dArea = `${dCurve} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div
      ref={containerRef}
      className={`w-full flex flex-col gap-3 select-none rounded-xl border border-stone-200 dark:border-stone-700 bg-[#fdfcf9] dark:bg-[#151513] p-4 sm:p-6 shadow-sm relative overflow-hidden ${className}`}
      tabIndex={0}
      title="Use Arrow Keys (← / →) or on-screen pedals to move the bike smoothly along the cadence graph"
    >
      {/* Top Header & Instrumentation Readout */}
      <div className="flex flex-col gap-2 border-b border-stone-200 dark:border-stone-700 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse" />
          <h3 className="font-serif text-lg font-medium text-stone-900 dark:text-stone-100">
            Neuromotor Cadence & Flight Dispersion
          </h3>
        </div>

        {/* Live Speedometer & Altitude Telemetry - Permanently beneath the title */}
        <div className="flex items-center gap-2.5 sm:gap-4 font-mono text-xs text-stone-500 dark:text-stone-400 flex-wrap">
          <span className="tabular-nums">
            Speed: <strong className="text-stone-900 dark:text-stone-100 text-sm font-bold">{renderState.speedKmH} km/h</strong>
          </span>
          <span>•</span>
          <span className="tabular-nums">
            Cadence Alt: <strong className="text-stone-800 dark:text-stone-200">{Math.round(renderState.y)}ms</strong>
          </span>
          <span>•</span>
          <span className="tabular-nums">
            Slope: <strong className="text-stone-800 dark:text-stone-200">{renderState.angle > 0 ? '+' : ''}{renderState.angle.toFixed(1)}°</strong>
          </span>
          <span>•</span>
          <span
            className={`font-semibold min-w-[70px] ${
              renderState.isGas
                ? 'text-amber-600'
                : renderState.isBrake
                ? 'text-red-600'
                : 'text-stone-400'
            }`}
          >
            {renderState.isGas ? 'GAS PEDAL' : renderState.isBrake ? 'BRAKE' : 'GLIDING'}
          </span>
        </div>
      </div>

      {/* Interactive SVG Canvas with Smooth Bike */}
      <div className="relative w-full h-[220px] sm:h-[260px] overflow-hidden rounded-lg bg-stone-50/50 dark:bg-stone-900/30">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="hillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#d97706" stopOpacity="0.32" />
              <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Reference Grid Lines */}
          <line x1="0" y1="60" x2={width} y2="60" stroke="#78716c" strokeOpacity="0.15" strokeDasharray="4 4" />
          <text x="8" y="56" fill="#78716c" fontSize="9" fontFamily="monospace" opacity="0.6">180ms Peak Inter-Key Flight</text>

          <line x1="0" y1="120" x2={width} y2="120" stroke="#78716c" strokeOpacity="0.15" strokeDasharray="4 4" />
          <text x="8" y="116" fill="#78716c" fontSize="9" fontFamily="monospace" opacity="0.6">112ms Nominal Baseline</text>

          <line x1="0" y1="180" x2={width} y2="180" stroke="#78716c" strokeOpacity="0.15" strokeDasharray="4 4" />
          <text x="8" y="176" fill="#78716c" fontSize="9" fontFamily="monospace" opacity="0.6">60ms Rapid Burst Cadence</text>

          {/* Shaded Area under Curve */}
          <path d={dArea} fill="url(#hillGradient)" />

          {/* Main Topography Cadence Line (Road / Hill) */}
          <path
            d={dCurve}
            fill="none"
            stroke="#d97706"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-sm"
          />

          {/* Bicycle Group Riding Directly on the Terrain */}
          <g transform={`translate(${renderState.x}, ${renderState.y})`}>
            {/* Rotate bike body according to the local ground slope */}
            <g transform={`rotate(${renderState.angle}) translate(0, -13)`}>
              {/* Rear Wheel */}
              <g transform="translate(-10, 8)">
                <circle cx="0" cy="0" r="5.5" fill="none" stroke="#292524" strokeWidth="1.8" />
                <circle cx="0" cy="0" r="1.4" fill="#78716c" />
                {/* Rotating Spokes */}
                <g transform={`rotate(${renderState.wheelAngle})`}>
                  <line x1="-5.5" y1="0" x2="5.5" y2="0" stroke="#78716c" strokeWidth="0.9" />
                  <line x1="0" y1="-5.5" x2="0" y2="5.5" stroke="#78716c" strokeWidth="0.9" />
                  <line x1="-3.8" y1="-3.8" x2="3.8" y2="3.8" stroke="#78716c" strokeWidth="0.7" />
                  <line x1="-3.8" y1="3.8" x2="3.8" y2="-3.8" stroke="#78716c" strokeWidth="0.7" />
                </g>
              </g>

              {/* Front Wheel */}
              <g transform="translate(10, 8)">
                <circle cx="0" cy="0" r="5.5" fill="none" stroke="#292524" strokeWidth="1.8" />
                <circle cx="0" cy="0" r="1.4" fill="#78716c" />
                {/* Rotating Spokes */}
                <g transform={`rotate(${renderState.wheelAngle})`}>
                  <line x1="-5.5" y1="0" x2="5.5" y2="0" stroke="#78716c" strokeWidth="0.9" />
                  <line x1="0" y1="-5.5" x2="0" y2="5.5" stroke="#78716c" strokeWidth="0.9" />
                  <line x1="-3.8" y1="-3.8" x2="3.8" y2="3.8" stroke="#78716c" strokeWidth="0.7" />
                  <line x1="-3.8" y1="3.8" x2="3.8" y2="-3.8" stroke="#78716c" strokeWidth="0.7" />
                </g>
              </g>

              {/* Bicycle Red Diamond Frame */}
              <line x1="-10" y1="8" x2="-2" y2="0" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" />
              <line x1="-10" y1="8" x2="0" y2="8" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" />
              <line x1="-2" y1="0" x2="0" y2="8" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" />
              <line x1="-2" y1="0" x2="6" y2="0" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" />
              <line x1="0" y1="8" x2="7" y2="0" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" />
              <line x1="10" y1="8" x2="7" y2="-2" stroke="#292524" strokeWidth="2" strokeLinecap="round" />

              {/* Handlebars */}
              <path d="M 6 -2 L 8 -4 L 10 -3" fill="none" stroke="#292524" strokeWidth="1.6" strokeLinecap="round" />

              {/* Saddle */}
              <path d="M -5 -0.5 L 0 -0.5" stroke="#1c1917" strokeWidth="2.4" strokeLinecap="round" />

              {/* Cyclist Pedaling Character */}
              <line x1="-2" y1="-1" x2="4" y2="-8" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="4" y1="-8" x2="8" y2="-3.5" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="5.5" cy="-12" r="3.2" fill="#ea580c" />
              <path
                d="M -2 -1 L 2 3 L 0 7"
                fill="none"
                stroke="#1c1917"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </g>
        </svg>
      </div>

      {/* Bottom Controls Bar: Keyboard Guide + On-Screen Touch Pedals */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-stone-200 dark:border-stone-700 font-mono text-xs">
        <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
          <span className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 font-bold text-[11px]">←</span>
          <span className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 font-bold text-[11px]">→</span>
          <span>Arrow keys or A / D to steer and pedal along the cadence graph</span>
        </div>

        {/* Tactile On-Screen Pedals */}
        <div className="flex items-center gap-2">
          <button
            onMouseDown={() => (bikeState.current.isBrake = true)}
            onMouseUp={() => (bikeState.current.isBrake = false)}
            onMouseLeave={() => (bikeState.current.isBrake = false)}
            onTouchStart={() => (bikeState.current.isBrake = true)}
            onTouchEnd={() => (bikeState.current.isBrake = false)}
            className={`px-3.5 py-1.5 rounded-md border text-xs font-mono font-bold transition-all cursor-pointer select-none active:scale-95 ${
              renderState.isBrake
                ? 'bg-red-600 text-white border-red-700 shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700 hover:bg-stone-200'
            }`}
          >
            BRAKE
          </button>

          <button
            onMouseDown={() => (bikeState.current.isGas = true)}
            onMouseUp={() => (bikeState.current.isGas = false)}
            onMouseLeave={() => (bikeState.current.isGas = false)}
            onTouchStart={() => (bikeState.current.isGas = true)}
            onTouchEnd={() => (bikeState.current.isGas = false)}
            className={`px-4 py-1.5 rounded-md border text-xs font-mono font-bold transition-all cursor-pointer select-none active:scale-95 ${
              renderState.isGas
                ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                : 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-200'
            }`}
          >
            GAS ACCEL →
          </button>
        </div>
      </div>
    </div>
  );
};
