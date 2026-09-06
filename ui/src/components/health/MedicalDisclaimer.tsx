import React from 'react';

interface MedicalDisclaimerProps {
  onLearnMore?: () => void;
  className?: string;
}

export const MedicalDisclaimer: React.FC<MedicalDisclaimerProps> = ({ onLearnMore, className = '' }) => {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/50 text-xs text-on-surface-variant ${className}`}
      data-purpose="medical-disclaimer"
    >
      <p className="leading-normal">
        <strong className="font-semibold text-on-surface">Not a diagnosis.</strong> KeySign reads typing
        rhythm only. If you notice a lasting change in how you type or feel, talk to a physician; a
        screening signal is a reason to ask, not an answer.
      </p>
      {onLearnMore && (
        <button
          type="button"
          onClick={onLearnMore}
          className="text-on-surface-variant hover:text-primary font-medium whitespace-nowrap transition-colors"
        >
          Learn more →
        </button>
      )}
    </div>
  );
};
