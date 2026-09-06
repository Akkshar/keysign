import React from 'react';
import { motion } from 'framer-motion';

interface BackgroundLinesProps {
  className?: string;
}

export const BackgroundLines: React.FC<BackgroundLinesProps> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden opacity-30 dark:opacity-15 select-none ${className}`}
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 1440 600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <motion.path
          d="M-100 280 C 300 120, 600 440, 1000 260 C 1200 180, 1400 320, 1600 240"
          stroke="url(#neural-gradient-1)"
          strokeWidth="1.5"
          strokeDasharray="8 8"
          initial={{ pathOffset: 0 }}
          animate={{ pathOffset: 1 }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        />
        <motion.path
          d="M-80 340 C 250 200, 700 480, 1050 300 C 1300 220, 1450 380, 1600 300"
          stroke="url(#neural-gradient-2)"
          strokeWidth="1.2"
          initial={{ pathOffset: 0 }}
          animate={{ pathOffset: -1 }}
          transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
        />
        <motion.path
          d="M-50 180 C 350 320, 650 140, 1100 360 C 1350 420, 1500 220, 1600 180"
          stroke="url(#neural-gradient-1)"
          strokeWidth="1"
          strokeDasharray="4 6"
          initial={{ pathOffset: 0 }}
          animate={{ pathOffset: 1 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
        />
        <defs>
          <linearGradient id="neural-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="neural-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#818cf8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.1" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
