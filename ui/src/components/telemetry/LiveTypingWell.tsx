import React, { useState, useRef } from 'react';
import { useBiometrics } from '../../context/BiometricsContext';
import { AnimatedCounter } from '../common/AnimatedCounter';

interface LiveTypingWellProps {
  variant?: 'compact' | 'full';
  placeholder?: string;
  rows?: number;
  className?: string;
}

/**
 * A place to type. The timings are picked up by the global key listener in
 * App.tsx (which streams them to the backend), so this component only tracks
 * whether the field is in use and shows the two numbers that matter.
 */
export const LiveTypingWell: React.FC<LiveTypingWellProps> = ({
  variant = 'compact',
  placeholder = 'Type here. Any sentence works; the rhythm is what is measured.',
  rows = 4,
  className = '',
}) => {
  const { liveDwell, liveFlight } = useBiometrics();
  const [inputText, setInputText] = useState('');
  const [isActive, setIsActive] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const touch = () => {
    setIsActive(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIsActive(false), 1200);
  };

  if (variant === 'compact') {
    return (
      <div className={`bg-surface-container-lowest p-space-md rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md border border-outline-variant/40 ${className}`}>
        <div className="flex items-center gap-space-sm">
          <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-secondary' : 'bg-outline-variant'}`} />
          <div>
            <span className="font-body text-sm font-medium text-on-surface">Type here</span>
            <p className="font-body text-xs text-on-surface-variant">Or anywhere on the page. Only timings are measured.</p>
          </div>
        </div>
        <div className="flex items-center gap-space-sm w-full md:w-auto">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={touch}
            placeholder={placeholder}
            className="bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 font-body text-xs px-space-md py-space-xs rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 w-full md:w-72 transition-all"
          />
          <span className="font-telemetry text-xs text-on-surface-variant whitespace-nowrap">
            <AnimatedCounter value={liveDwell} className="text-on-surface" /> ms hold ·{' '}
            <AnimatedCounter value={liveFlight} className="text-on-surface" /> ms gap
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <textarea
        rows={rows}
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={touch}
        placeholder={placeholder}
        className="w-full bg-surface-container-low p-space-lg pb-10 font-body text-sm text-on-surface rounded-xl border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-on-surface-variant/60 resize-none"
      />
      <div className="absolute bottom-3 right-3 flex items-center gap-space-sm font-telemetry text-[11px] text-on-surface-variant">
        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-secondary' : 'bg-outline-variant'}`} />
        <span>
          <AnimatedCounter value={liveDwell} className="text-on-surface" /> ms hold ·{' '}
          <AnimatedCounter value={liveFlight} className="text-on-surface" /> ms gap
        </span>
      </div>
    </div>
  );
};
