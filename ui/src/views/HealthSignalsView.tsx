import React, { useState } from 'react';
import { mockHealthConditions } from '../data/healthConditions';
import { HealthCondition, HealthSignalCard } from '../components/health/HealthSignalCard';
import { MedicalDisclaimer } from '../components/health/MedicalDisclaimer';
import { Reveal } from '../components/motion/Reveal';
import { CardSpotlight } from '../components/motion/CardSpotlight';

/**
 * Research roadmap. Six screening signals the Drift head could grow into once
 * there are months of typing from the same person. Nothing on this page is
 * computed from the typist's data, so every card carries the same neutral
 * "Roadmap" status and no verdict colour.
 */
export const HealthSignalsView: React.FC = () => {
  const [selected, setSelected] = useState<HealthCondition>(mockHealthConditions[0]);

  return (
    <Reveal className="flex flex-col w-full gap-8 pb-12">
      <div className="space-y-2">
        <span className="text-xs font-telemetry tracking-wider uppercase text-primary font-semibold">
          Research roadmap · illustrative, not computed from your data
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-on-surface">
          Health signals
        </h1>
        <p className="font-body text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
          The same hold, flight and rhythm features that drive the four heads have been studied as
          long-term health signals. These six are where that research points. Each would need months of
          one person's typing, and none of them diagnose anything.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 grid grid-cols-2 gap-3">
          {mockHealthConditions.map((c) => (
            <HealthSignalCard
              key={c.id}
              condition={c}
              selected={selected.id === c.id}
              onClick={() => setSelected(c)}
            />
          ))}
        </div>

        <div className="lg:col-span-7">
          <CardSpotlight className="bg-surface-container-lowest border border-outline-variant/60">
            <div key={selected.id} className="p-6 sm:p-8 space-y-6">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-outline-variant/40">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-surface-container-low text-on-surface-variant flex items-center justify-center">
                    {selected.iconSvg}
                  </div>
                  <h2 className="font-serif text-2xl font-medium text-on-surface">{selected.name}</h2>
                </div>
                <span className="text-[11px] font-telemetry uppercase tracking-wider text-on-surface-variant pt-2">
                  Roadmap
                </span>
              </div>

              <dl className="space-y-5">
                <div className="space-y-1">
                  <dt className="text-xs font-medium text-on-surface-variant">What it would watch</dt>
                  <dd className="font-body text-sm text-on-surface leading-relaxed">{selected.watches}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium text-on-surface-variant">What the evidence is</dt>
                  <dd className="font-body text-sm text-on-surface leading-relaxed">{selected.evidence}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium text-on-surface-variant">What to do with it</dt>
                  <dd className="font-body text-sm text-on-surface leading-relaxed">{selected.action}</dd>
                </div>
              </dl>

              <p className="text-xs text-on-surface-variant leading-relaxed border-l-2 border-outline-variant pl-3">
                {selected.clinicalNotice}
              </p>
            </div>
          </CardSpotlight>
        </div>
      </div>

      <MedicalDisclaimer />
    </Reveal>
  );
};
