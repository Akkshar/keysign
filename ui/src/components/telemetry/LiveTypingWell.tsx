import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBiometrics } from '../../context/BiometricsContext';

interface LiveTypingWellProps {
  variant?: 'compact' | 'full';
  placeholder?: string;
  className?: string;
}

export const LiveTypingWell: React.FC<LiveTypingWellProps> = ({
  variant = 'compact',
  placeholder = 'Type here to sample your personal typing cadence...',
  className = '',
}) => {
  const { onKeyAction, liveDwell, liveFlight } = useBiometrics();
  const [inputText, setInputText] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [keystrokeCount, setKeystrokeCount] = useState(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = () => {
    setIsActive(true);
    setKeystrokeCount((prev) => prev + 1);
    onKeyAction('down');
    if (idleTimer.current) clearTimeout(idleTimer.current);
  };

  const handleKeyUp = () => {
    onKeyAction('up');
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setIsActive(false);
    }, 1200);
  };

  if (variant === 'compact') {
    return (
      <div className={`bg-surface-container-low p-space-md rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md border border-surface-container relative ${className}`}>
        <div className="flex items-center gap-space-sm">
          <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-secondary beacon-pulse' : 'bg-secondary/60'} flex-shrink-0 transition-all`} />
          <div>
            <span className="font-headline text-xs font-semibold text-on-surface flex items-center gap-1.5">
              Live Typing Test Field
              {isActive && (
                <span className="text-[10px] font-telemetry bg-secondary/15 text-secondary px-1.5 py-0.2 rounded font-medium">
                  {keystrokeCount} pulses
                </span>
              )}
            </span>
            <p className="font-body text-xs text-on-surface-variant">
              Type anywhere in the window to observe continuous vector computation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-space-sm w-full md:w-auto relative">
          {/* Floating ephemeral tuple alert */}
          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: -26, scale: 1 }}
                exit={{ opacity: 0, y: -32 }}
                transition={{ duration: 0.25 }}
                className="absolute -top-3 left-2 z-20 pointer-events-none bg-surface-container-highest/95 backdrop-blur px-2 py-0.5 rounded shadow text-[10px] font-telemetry text-secondary font-semibold border border-secondary/20 flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping"></span>
                +1 tuple captured • ASCII masked
              </motion.div>
            )}
          </AnimatePresence>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            placeholder={placeholder}
            className="bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/60 font-body text-xs px-space-md py-space-xs rounded-lg shadow-sm border border-surface-container focus:outline-none focus:ring-2 focus:ring-primary w-full md:w-80 transition-all"
          />
          <motion.span
            layout
            className={`font-telemetry text-xs px-space-sm py-space-xs rounded-lg shadow-sm whitespace-nowrap border border-surface-container transition-all ${
              isActive
                ? 'text-primary bg-primary-fixed/30 border-primary/40 font-semibold'
                : 'text-secondary bg-surface-container-lowest'
            }`}
          >
            {isActive ? `${liveDwell}ms dwell | ${liveFlight}ms flight` : 'Passive Baseline Safe'}
          </motion.span>
        </div>
      </div>
    );
  }

  // Full sandbox view
  return (
    <div className={`flex flex-col gap-space-md ${className}`}>
      <div className="relative flex flex-col">
        <textarea
          rows={3}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          placeholder={placeholder}
          className="w-full bg-surface-container-lowest p-space-lg font-telemetry text-sm text-on-surface rounded-lg shadow-inner border border-surface-container focus:outline-none focus:ring-2 focus:ring-primary transition-all placeholder:text-outline resize-none"
        />
        <div className="absolute bottom-space-sm right-space-sm flex items-center gap-space-xs bg-surface-container-low px-space-sm py-space-2xs rounded text-outline font-telemetry text-xs border border-surface-container">
          <span className="material-symbols-outlined text-[14px]">timer</span>
          <span className="text-secondary font-medium">{liveFlight}ms flight avg</span>
        </div>
      </div>
    </div>
  );
};
