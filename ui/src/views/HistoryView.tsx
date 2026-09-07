import React from 'react';
import { illustrativeSessions } from '../data/mockOverview';
import { Reveal } from '../components/motion/Reveal';

/**
 * History. The backend records every live session to data/sessions/*.jsonl,
 * but there is no endpoint yet that summarises them, so this view is a
 * labelled sketch of what the log will look like. Nothing here is measured.
 */
const headLabel: Record<string, string> = {
  session: 'Session',
  identity: 'Identity',
  state: 'State',
  threat: 'Threat',
};

export const HistoryView: React.FC = () => {
  return (
    <Reveal className="flex flex-col w-full gap-8 pb-12">
      <div className="space-y-2">
        <span className="text-xs font-telemetry tracking-wider uppercase text-on-surface-variant font-semibold">
          Illustrative
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-on-surface">
          History
        </h1>
        <p className="font-body text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
          Every live session is already written to <code className="font-telemetry text-xs">data/sessions/</code> on
          this machine (raw key events plus each tick's features and head outputs). A summary of those files is
          the next step; until then this timeline is a sketch, not a record.
        </p>
      </div>

      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 sm:p-8">
        <ol className="relative border-l border-outline-variant/60 ml-2 space-y-6">
          {illustrativeSessions.map((s) => (
            <li key={s.id} className="pl-6 relative">
              <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-surface-container-highest border border-outline-variant" />
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="font-telemetry text-xs text-on-surface-variant">{s.when}</span>
                <span className="text-[11px] uppercase tracking-wider text-on-surface-variant/70">{headLabel[s.head]}</span>
              </div>
              <p className="font-body text-sm text-on-surface mt-1 leading-relaxed">{s.note}</p>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-xs text-on-surface-variant leading-relaxed max-w-2xl">
        To look at real sessions now: <code className="font-telemetry">uv run python -m backend.sessions list</code> shows
        the files, and <code className="font-telemetry">score &lt;file&gt;</code> prints the distance per tick against every baseline.
      </p>
    </Reveal>
  );
};
