import React from 'react';

interface MedicalDisclaimerProps {
  onLearnMore?: () => void;
  className?: string;
}

export const MedicalDisclaimer: React.FC<MedicalDisclaimerProps> = ({ onLearnMore, className = '' }) => {
  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-100/75 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-400 ${className}`}
      data-purpose="medical-disclaimer"
    >
      <div className="flex items-center gap-2.5">
        <svg
          className="w-4 h-4 text-slate-400 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          These signals are for screening and monitoring only. They do not provide a medical diagnosis.
        </span>
      </div>
      <button
        onClick={onLearnMore}
        className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap ml-4 text-xs"
      >
        <span>Learn more</span>
        <span>→</span>
      </button>
    </div>
  );
};
