import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useBiometrics } from '../context/BiometricsContext';
import { BACKEND_HTTP, fetchAlerts } from '../lib/keysign';
import { alertPhotoUrl } from '../lib/webcam';
import { DuressModal } from '../components/telemetry/DuressModal';
import { Reveal, Swap } from '../components/motion/Reveal';
import { CardSpotlight } from '../components/motion/CardSpotlight';
import { AnimatedCounter } from '../components/common/AnimatedCounter';
import { TickClock } from '../components/threats/TickClock';
import { DriverBars } from '../components/threats/DriverBars';
import { featureLabel } from '../components/threats/featureLabels';

/**
 * Threat: is something wrong right now? The operator's view of the Threat head.
 * One clock decides the alert: SUSTAIN_TICKS consecutive windows (~3 s) more
 * than 3σ from the declared user's calm baseline (backend/heads.py
 * THREAT_PERSIST). If identity disagrees with the declared user while that
 * happens it is an intruder, otherwise duress. The mismatch clock shows how
 * long identity has disagreed. Either fires a silent push to a phone;
 * nothing appears on the typist's screen.
 */
const MISMATCH_TICKS = 6;
const SUSTAIN_TICKS = 6;

type Level = 'ok' | 'warn' | 'alert' | 'none';
const LEVEL_WORD: Record<Level, string> = { ok: 'Nominal', warn: 'Caution', alert: 'Alert', none: 'Standby' };
const LEVEL_TONE: Record<Level, string> = { ok: 'text-secondary', warn: 'text-tertiary', alert: 'text-error', none: 'text-on-surface-variant' };

export const ThreatsView: React.FC = () => {
  const { live, setDuressModalOpen } = useBiometrics();
  const tick = live.tick;
  const th = tick?.heads?.threat;
  const level: Level = (th?.level as Level) ?? 'none';
  const declared = live.declaredUser || tick?.user || 'the declared user';

  // Identity-mismatch clock. The backend reports mismatch_ticks when it has it;
  // otherwise count consecutive mismatching ticks here.
  const localMismatch = useRef(0);
  const [mismatchTicks, setMismatchTicks] = useState(0);
  useEffect(() => {
    if (!tick) { localMismatch.current = 0; setMismatchTicks(0); return; }
    const reported = (th as any)?.mismatch_ticks;
    if (typeof reported === 'number') { setMismatchTicks(reported); return; }
    localMismatch.current = th?.identity_mismatch ? localMismatch.current + 1 : 0;
    setMismatchTicks(localMismatch.current);
  }, [tick, th]);

  const sustained = th?.sustained_ticks ?? 0;
  const distance = tick?.distance ?? null;
  const drivers = (th?.drivers ?? []).slice(0, 2) as [string, number][];
  const channel = th?.channel || 'not configured';

  const kindLine =
    !th ? (!live.connected ? 'Waiting for the local backend.' : !tick ? 'Waiting for typing. Type anywhere on this page.' : 'No baseline for the declared user yet. Enrol one on the capture page.')
    : level === 'alert' && th.kind === 'intruder' ? `Intruder: the identity head disagrees with ${declared}.`
    : level === 'alert' ? `Duress: ${declared} is typing, far from their calm baseline.`
    : level === 'warn' && th.identity_mismatch ? `Identity disagrees with ${declared}. Counting.`
    : level === 'warn' ? `Above the warn line. Counting whether it holds.`
    : `Typing matches ${declared}'s calm baseline.`;

  // Real silent alerts raised by the Threat head (backend/notify.py), newest first.
  const alertsTotal = live.tick?.heads?.threat?.alerts_total ?? 0;
  const [alerts, setAlerts] = useState<any[]>([]);
  useEffect(() => {
    let stop = false;
    const load = () => fetchAlerts(20).then((a) => { if (!stop) setAlerts([...a].reverse()); }).catch(() => {});
    load();
    const id = setInterval(load, 10000);
    return () => { stop = true; clearInterval(id); };
  }, [alertsTotal, live.connected, live.lastPhoto]);
  const rows = alerts.map((a) => ({
    timestamp: new Date(a.ts * 1000).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' }),
    kind: a.kind === 'intruder' ? 'Intruder' : 'Duress',
    signature: (a.drivers || []).map(([f, z]: [string, number]) => `${featureLabel(f)} ${z > 0 ? '+' : ''}${z.toFixed(1)}σ`).join(' · ') || 'sustained deviation from baseline',
    distance: `${(a.distance ?? 0).toFixed(1)}σ`,
    ticks: `${a.sustained_ticks ?? 0} ticks`,
    identity: a.identity ? `${a.identity} (${Math.round((a.identity_confidence ?? 0) * 100)}%)` : 'declared user',
    sent: a.face && typeof a.face.pushed === 'boolean'
      ? (a.face.pushed ? `pushed · ${a.face.reason || ''}`.trim() : `kept local · ${a.face.reason || 'owner at the keyboard'}`)
      : a.sent === false ? 'logged only' : a.sent === null ? 'pending camera check' : 'pushed',
    photo: a.photo ? alertPhotoUrl(a.photo) : null,
    screen: a.screen ? alertPhotoUrl(a.screen) : null,
    face: a.face ? (a.face.match === true ? 'matched owner' : a.face.match === false ? `not ${a.face.owner || 'the owner'}` : a.face.face === false ? 'no face' : 'not enrolled') + (a.face.frames ? ` (best of ${a.face.frames})` : '') : null,
    raw: a,
  }));

  return (
    <>
      <Reveal className="flex flex-col w-full gap-space-2xl">
        {/* Hero: the verdict and the two clocks */}
        <CardSpotlight color={level === 'alert' ? 'rgba(220, 38, 38, 0.10)' : level === 'warn' ? 'rgba(217, 119, 6, 0.10)' : 'rgba(5, 150, 105, 0.10)'}>
          <div className="bg-surface-container-lowest border border-surface-container rounded-2xl p-space-2xl flex flex-col gap-space-xl">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-space-lg">
              <div className="flex flex-col gap-space-xs">
                <span className="font-telemetry text-xs uppercase tracking-wider text-on-surface-variant">Threat · {live.connected ? 'live' : 'backend offline'}</span>
                <AnimatePresence mode="wait" initial={false}>
                  <Swap value={level} className={`font-serif text-6xl font-medium tracking-tight leading-none ${LEVEL_TONE[level]}`}>
                    {LEVEL_WORD[level]}
                  </Swap>
                </AnimatePresence>
                <p className="font-body text-base text-on-surface mt-space-sm max-w-xl">{kindLine}</p>
              </div>
              <div className="flex items-end gap-space-2xl">
                <div className="flex flex-col">
                  <span className="font-body text-sm text-on-surface-variant">Distance from calm</span>
                  <span className="font-telemetry text-3xl text-on-surface">
                    {distance == null ? <span className="text-on-surface-variant">–</span> : <AnimatedCounter value={distance} decimals={2} suffix="σ" />}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-body text-sm text-on-surface-variant">Alerts this session</span>
                  <span className="font-telemetry text-3xl text-on-surface"><AnimatedCounter value={alertsTotal} /></span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-xl">
              <TickClock label="Identity mismatch" ticks={mismatchTicks} of={MISMATCH_TICKS} fired={level === 'alert' && th?.kind === 'intruder'} />
              <TickClock label="Above 3σ from baseline" ticks={sustained} of={SUSTAIN_TICKS} fired={level === 'alert' && th?.kind === 'duress'} />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm pt-space-md border-t border-surface-container">
              <p className="font-body text-sm text-on-surface-variant">
                Alerts go to the phone, not this screen · channel: <span className="font-telemetry text-on-surface">{channel}</span>
              </p>
              <button
                type="button"
                onClick={() => setDuressModalOpen(true)}
                className="self-start font-body text-sm text-primary hover:underline"
              >
                Preview the alert card
              </button>
            </div>
          </div>
        </CardSpotlight>

        {/* What is pulling the window away from the baseline */}
        <div className="bg-surface-container-lowest border border-surface-container rounded-2xl p-space-xl flex flex-col gap-space-lg">
          <div className="flex flex-col gap-space-2xs">
            <h2 className="font-serif text-xl font-medium text-on-surface">Top drivers</h2>
            <p className="font-body text-sm text-on-surface-variant">
              The two features furthest from {declared}'s calm baseline in the current window, in that person's own σ.
            </p>
          </div>
          {drivers.length ? (
            <DriverBars drivers={drivers} />
          ) : (
            <p className="font-body text-sm text-on-surface-variant">Nothing to show until a window with a baseline arrives. Type anywhere on this page.</p>
          )}
        </div>

        {/* The real alert log */}
        <div className="bg-surface-container-lowest border border-surface-container rounded-2xl p-space-xl flex flex-col gap-space-lg">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-space-sm">
            <div className="flex flex-col gap-space-2xs">
              <h2 className="font-serif text-xl font-medium text-on-surface">Silent alerts</h2>
              <p className="font-body text-sm text-on-surface-variant">Every push the Threat head has sent, from data/alerts.jsonl on this machine.</p>
            </div>
            <button
              type="button"
              onClick={() => window.open(`${BACKEND_HTTP}/api/alerts`, '_blank')}
              className="self-start font-body text-sm text-primary hover:underline"
            >
              Open the raw log
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-on-surface-variant font-body text-xs border-b border-surface-container">
                  <th className="py-space-sm pr-space-lg font-medium">Time</th>
                  <th className="py-space-sm pr-space-lg font-medium">Kind</th>
                  <th className="py-space-sm pr-space-lg font-medium">Drivers</th>
                  <th className="py-space-sm pr-space-lg font-medium">Distance</th>
                  <th className="py-space-sm pr-space-lg font-medium">Held for</th>
                  <th className="py-space-sm pr-space-lg font-medium">Identity read</th>
                  <th className="py-space-sm pr-space-lg font-medium">Delivery</th>
                  <th className="py-space-sm pr-space-lg font-medium">Photo</th>
                  <th className="py-space-sm text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container font-body text-sm">
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="py-space-lg text-on-surface-variant">No silent alerts yet this session. A row appears the moment either clock fills.</td></tr>
                )}
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="py-space-md pr-space-lg font-telemetry text-on-surface whitespace-nowrap">{row.timestamp}</td>
                    <td className={`py-space-md pr-space-lg font-medium ${row.kind === 'Intruder' ? 'text-error' : 'text-tertiary'}`}>{row.kind}</td>
                    <td className="py-space-md pr-space-lg text-on-surface-variant">{row.signature}</td>
                    <td className="py-space-md pr-space-lg font-telemetry text-on-surface">{row.distance}</td>
                    <td className="py-space-md pr-space-lg font-telemetry text-on-surface">{row.ticks}</td>
                    <td className="py-space-md pr-space-lg text-on-surface-variant">{row.identity}</td>
                    <td className="py-space-md pr-space-lg text-on-surface-variant">{row.sent}</td>
                    <td className="py-space-md pr-space-lg">
                      {row.photo ? (
                        <span className="inline-flex items-center gap-2">
                          <a href={row.photo} target="_blank" rel="noreferrer" title={`Webcam frame when the alert fired · face: ${row.face ?? 'unchecked'}`}>
                            <img src={row.photo} alt="Webcam frame at the alert" className="h-10 w-14 object-cover rounded-md border border-outline-variant/60" />
                          </a>
                          <span className="flex flex-col text-[11px] leading-tight">
                            <span className={row.face === 'matched owner' ? 'text-secondary' : 'text-error'}>{row.face ?? 'unchecked'}</span>
                            {row.screen && <a href={row.screen} target="_blank" rel="noreferrer" className="text-primary hover:underline">screen</a>}
                          </span>
                        </span>
                      ) : (
                        <span className="text-on-surface-variant">{row.kind === 'Intruder' ? 'off' : '—'}</span>
                      )}
                    </td>
                    <td className="py-space-md text-right">
                      <button
                        type="button"
                        onClick={() => alert(JSON.stringify(row.raw, null, 2))}
                        className="font-body text-sm text-primary hover:underline"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <DuressModal />
    </>
  );
};
