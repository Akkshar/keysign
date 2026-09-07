import React from 'react';

interface PrivacyBadgeProps {
  variant?: 'pill' | 'card' | 'inline';
  className?: string;
}

export const PrivacyBadge: React.FC<PrivacyBadgeProps> = ({ variant = 'pill', className = '' }) => {
  if (variant === 'card') {
    return (
      <div className={`bg-surface-container-lowest rounded-xl p-space-sm shadow-[0_1px_8px_rgba(0,0,0,0.04)] border border-outline-variant flex flex-col gap-space-xs ${className}`}>
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-secondary text-[16px]">lock</span>
          <span className="font-headline text-xs text-on-surface font-semibold">Privacy Guarantee</span>
        </div>
        <div className="flex items-start gap-space-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-1 flex-shrink-0 animate-ping"></span>
          <p className="font-body text-xs text-on-surface-variant leading-tight">
            Typed content is never recorded. Processing happens locally.
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-space-xs text-xs font-telemetry text-secondary ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
        <span>Processing locally • Keystroke content never recorded</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-space-xs bg-surface-container-low px-space-md py-space-xs rounded-full border border-outline-variant ${className}`}>
      <span className="w-2 h-2 rounded-full bg-secondary animate-pulse flex-shrink-0"></span>
      <span className="font-telemetry text-xs text-on-surface font-medium">
        Processing locally • Keystroke content never recorded
      </span>
    </div>
  );
};
