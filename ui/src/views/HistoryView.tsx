import React, { useEffect, useState } from 'react';
import { Reveal } from '../components/motion/Reveal';
import { BACKEND_HTTP } from '../lib/keysign';

/**
 * Every session this machine has scored, from the recordings it already keeps.
 *
 * This used to be a labelled sketch, because there was no endpoint that summarised
 * data/sessions/*.jsonl. There is one now (/api/sessions), so the page shows the real
 * thing: when, who the session was declared as, how many keys, who the identity head
 * named on how many windows, and what the Threat head did about it.
 *
 * The recordings hold timings and a coarse key class, never the characters, so nothing
 * here can show what anybody typed. It is counts.
 */

interface Alert { ts?: number; kind?: string; identity?: string | null; distance?: number }

interface Session {
  file: string;
  when: string;
  declared: string | null;
  source: string;
  keys: number;
  ticks: number;
  seconds: number | null;
  called: Record<string, number>;
  levels: Record<string, number>;
  alerts: Alert[];
  mean_distance: number | null;
  mean_load: number | null;
}

interface Totals {
  sessions: number; keys: number; ticks: number; alerts: number;
  since: string | null; files: number; minutes: number;
}

const PANEL = 'rounded-xl border border-outline-variant bg-surface-container-lowest';

const mins = (s: number | null) =>
  s == null ? '–' : s >= 90 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`;

const Stat: React.FC<{ label: string; value: React.ReactNode; note?: string }> = ({ label, value, note }) => (
  <div className="px-4 py-3">
    <span className="font-telemetry text-[10px] uppercase tracking-wider text-on-surface-variant block">{label}</span>
    <span className="font-serif text-2xl font-medium text-on-surface tabular-nums leading-none">{value}</span>
    {note && <span className="font-body text-[11px] text-on-surface-variant block mt-1">{note}</span>}
  </div>
);

export const HistoryView: React.FC = () => {
  const [rows, setRows] = useState<Session[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch(`${BACKEND_HTTP}/api/sessions?n=40`)
        .then((r) => r.json())
        .then((d) => { if (!stop) { setRows(d.sessions || []); setTotals(d.totals || null); setError(null); } })
        .catch((e) => { if (!stop) setError(String(e)); });
    load();
    const id = setInterval(load, 15_000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  return (
    <Reveal className="flex flex-col w-full gap-8 pb-12">
      <div className="space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-on-surface">History</h1>
        <p className="font-body text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
          Every session this machine has scored, read back from its own recordings. The files hold
          timings and a coarse key class, letter, digit, punctuation, navigation, never the characters,
          so what follows is counts. Nothing here left the machine.
        </p>
      </div>

      {totals && (
        <section className={`${PANEL} grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-outline-variant`}>
          <Stat label="Sessions" value={totals.sessions} note={totals.since ? `since ${totals.since}` : undefined} />
          <Stat label="Keys scored" value={totals.keys.toLocaleString()} note={`${totals.ticks.toLocaleString()} windows`} />
          <Stat label="Time" value={`${Math.round(totals.minutes)}`} note="minutes of typing" />
          <Stat label="Alerts raised" value={totals.alerts} note="silent, then decided" />
        </section>
      )}

      {error && (
        <p className="font-body text-sm text-on-surface-variant">
          Could not read the sessions ({error}). Is the backend running?
        </p>
      )}

      {rows && rows.length === 0 && !error && (
        <div className={`${PANEL} p-8 text-center space-y-1`}>
          <p className="font-body text-sm text-on-surface">Nothing recorded yet.</p>
          <p className="font-body text-xs text-on-surface-variant">
            A session appears here the first time somebody types with the agent running.
          </p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <section className={`${PANEL} overflow-hidden`}>
          <div className="hidden sm:grid grid-cols-[9.5rem_1fr_5rem_5rem_7rem_5rem] gap-3 px-5 py-2.5 border-b border-outline-variant font-telemetry text-[10px] uppercase tracking-wider text-on-surface-variant">
            <span>When</span><span>Declared / read as</span>
            <span className="text-right">Keys</span><span className="text-right">Length</span>
            <span className="text-right">Mean distance</span><span className="text-right">Alerts</span>
          </div>
          {rows.map((s) => {
            const names = Object.entries(s.called);
            const top = names.slice(0, 2);
            const isOpen = open === s.file;
            return (
              <div key={s.file} className="border-b border-outline-variant last:border-0">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : s.file)}
                  className="w-full text-left grid grid-cols-2 sm:grid-cols-[9.5rem_1fr_5rem_5rem_7rem_5rem] gap-x-3 gap-y-1 px-5 py-3 hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <span className="font-telemetry text-xs text-on-surface-variant">{s.when}</span>
                  <span className="font-body text-sm text-on-surface truncate">
                    {s.declared || 'unknown'}
                    {top.length > 0 && (
                      <span className="text-on-surface-variant">
                        {' · read as '}
                        {top.map(([who, n], i) => (
                          <span key={who}>{i > 0 && ', '}{who} <span className="font-telemetry text-[11px]">{n}</span></span>
                        ))}
                        {names.length > 2 && <span className="text-on-surface-variant"> +{names.length - 2}</span>}
                      </span>
                    )}
                    {s.source === 'agent' && (
                      <span className="ml-2 font-telemetry text-[10px] uppercase tracking-wider text-on-surface-variant">agent</span>
                    )}
                  </span>
                  <span className="font-telemetry text-xs text-on-surface text-right tabular-nums">{s.keys}</span>
                  <span className="font-telemetry text-xs text-on-surface-variant text-right tabular-nums">{mins(s.seconds)}</span>
                  <span className="font-telemetry text-xs text-on-surface-variant text-right tabular-nums">
                    {s.mean_distance == null ? '–' : `${s.mean_distance.toFixed(2)}σ`}
                  </span>
                  <span className={`font-telemetry text-xs text-right tabular-nums ${s.alerts.length ? 'text-error dark:text-error-dark' : 'text-on-surface-variant'}`}>
                    {s.alerts.length || '–'}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 space-y-3 bg-surface-container-low/60">
                    <div className="flex flex-wrap gap-x-6 gap-y-1 font-body text-xs text-on-surface-variant pt-2">
                      <span>{s.ticks} scored windows</span>
                      {s.mean_load != null && <span>mean load {Math.round(s.mean_load * 100)}/100</span>}
                      {Object.entries(s.levels).map(([lvl, n]) => (
                        <span key={lvl}>{n} at {lvl}</span>
                      ))}
                      <span className="font-telemetry text-[11px]">{s.file}</span>
                    </div>
                    {s.alerts.length > 0 && (
                      <div className="space-y-1">
                        {s.alerts.map((a, i) => (
                          <div key={i} className="font-telemetry text-xs text-on-surface flex flex-wrap gap-x-4">
                            <span className="text-error dark:text-error-dark">{a.kind || 'alert'}</span>
                            <span className="text-on-surface-variant">
                              {a.ts ? new Date(a.ts * 1000).toLocaleTimeString() : ''}
                            </span>
                            <span>{a.identity || 'nobody named'}</span>
                            <span className="text-on-surface-variant">
                              {a.distance == null ? '' : `${Number(a.distance).toFixed(2)}σ`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {names.length > 0 && (
                      <div className="font-body text-xs text-on-surface-variant">
                        Windows per name: {names.map(([w, n]) => `${w} ${n}`).join(' · ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      <p className="font-body text-xs text-on-surface-variant leading-relaxed max-w-2xl">
        The same files from a terminal: <code className="font-telemetry">uv run python -m backend.sessions list</code> for
        the index, and <code className="font-telemetry">score &lt;file&gt;</code> to print the distance per window against
        every baseline on this machine.
      </p>
    </Reveal>
  );
};
