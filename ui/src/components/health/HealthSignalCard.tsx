import React from 'react';

/**
 * A research-roadmap signal. Nothing here is computed from the typist's data:
 * every card carries the same neutral "Roadmap" status, never a verdict.
 */
export interface HealthCondition {
  id: string;
  name: string;
  /** One sentence: what the signal would watch in the timing features. */
  watches: string;
  /** One sentence: what the published evidence is, hedged honestly. */
  evidence: string;
  /** One sentence: what a person should do with it (see a physician). */
  action: string;
  /** The teammate's non-diagnostic notice, shown on the detail pane. */
  clinicalNotice: string;
  iconSvg: React.ReactNode;
}

interface HealthSignalCardProps {
  condition: HealthCondition;
  onClick?: () => void;
  selected?: boolean;
}

export const HealthSignalCard: React.FC<HealthSignalCardProps> = ({ condition, onClick, selected = false }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      data-purpose="signal-card"
      className={`group w-full text-left rounded-xl p-4 border transition-colors duration-200 flex flex-col justify-between min-h-[140px] bg-surface-container-lowest ${
        selected
          ? 'border-primary/50'
          : 'border-outline-variant/60 hover:border-outline'
      }`}
    >
      <div className="space-y-3">
        <div className="w-9 h-9 rounded-xl bg-surface-container-low text-on-surface-variant flex items-center justify-center">
          {condition.iconSvg}
        </div>
        <h3 className="text-sm font-serif font-medium text-on-surface leading-snug">
          {condition.name}
        </h3>
      </div>

      <div className="flex items-center justify-between pt-3">
        <span className="text-[11px] font-telemetry uppercase tracking-wider text-on-surface-variant">
          Roadmap
        </span>
        <span className="text-xs text-on-surface-variant/60 group-hover:text-primary transition-colors">›</span>
      </div>
    </button>
  );
};
