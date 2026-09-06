import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useBiometrics } from '../../context/BiometricsContext';
import { featureLabel } from '../threats/featureLabels';

/**
 * The operator's alert card. Opens when the Threat head raises a silent alert
 * (BiometricsContext watches alerts_total) or from "Preview the alert card".
 * The typist's screen shows nothing; the push went to a phone.
 */
export const DuressModal: React.FC = () => {
  const { duressModalOpen, setDuressModalOpen, setActiveArea, live } = useBiometrics();
  const reduce = useReducedMotion();
  const th = live.tick?.heads?.threat;
  const last = th?.last_alert ?? null;
  const declared = live.declaredUser || live.tick?.user || 'the declared user';
  const identity = live.tick?.heads?.identity;

  const kind = last?.kind ?? th?.kind ?? 'duress';
  const preview = !last;
  const when = last ? new Date(last.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;
  const drivers = ((th?.drivers ?? []) as [string, number][]).slice(0, 2);

  const title = preview ? 'What an alert looks like' : kind === 'intruder' ? 'Intruder' : 'Duress';
  const what = kind === 'intruder'
    ? `Someone is typing under ${declared}'s name and the identity head disagrees${identity?.user && identity.user !== declared ? ` (closest match: ${identity.user})` : ''}.`
    : `${declared} is typing, but more than 3σ from their calm baseline for long enough to rule out a stumble.`;

  const close = () => setDuressModalOpen(false);
  const goToThreats = () => { setActiveArea('threats'); setDuressModalOpen(false); };

  return (
    <AnimatePresence>
      {duressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-space-md">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={close}
            className="fixed inset-0 bg-black/50"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="duress-title"
            initial={{ opacity: 0, y: reduce ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : 8 }}
            transition={{ duration: reduce ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 bg-surface-container-lowest rounded-2xl max-w-lg w-full p-space-2xl shadow-2xl border border-surface-container flex flex-col gap-space-lg"
          >
            <div className="flex items-start justify-between gap-space-md">
              <div className="flex flex-col gap-space-xs">
                <span className="font-telemetry text-xs uppercase tracking-wider text-on-surface-variant">
                  {preview ? 'Preview · no alert has fired this session' : `Silent alert · ${when}`}
                </span>
                <h2 id="duress-title" className={`font-serif text-3xl font-medium tracking-tight ${preview ? 'text-on-surface' : 'text-error'}`}>
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <dl className="flex flex-col gap-space-md font-body text-sm">
              <div className="flex flex-col gap-space-2xs">
                <dt className="text-on-surface-variant">What happened</dt>
                <dd className="text-on-surface">{what}</dd>
              </div>
              <div className="flex flex-col gap-space-2xs">
                <dt className="text-on-surface-variant">The numbers</dt>
                <dd className="font-telemetry text-on-surface">
                  {th?.distance != null ? `${th.distance.toFixed(2)}σ from calm` : 'no window yet'}
                  {th?.sustained_ticks ? ` · held ${th.sustained_ticks} ticks` : ''}
                  {drivers.length ? ` · ${drivers.map(([f, z]) => `${featureLabel(f)} ${z > 0 ? '+' : ''}${z.toFixed(1)}σ`).join(', ')}` : ''}
                </dd>
              </div>
              <div className="flex flex-col gap-space-2xs">
                <dt className="text-on-surface-variant">Where it went</dt>
                <dd className="text-on-surface">
                  {preview
                    ? `A push to the phone over ntfy${th?.channel ? ` (channel ${th.channel})` : ''}. Nothing changes on the typist's screen.`
                    : last?.sent
                      ? `Pushed to the phone over ntfy (channel ${last.channel}). Nothing changed on the typist's screen.`
                      : 'The push did not go out (no channel reachable). It is logged on this machine.'}
                </dd>
              </div>
              <div className="flex flex-col gap-space-2xs">
                <dt className="text-on-surface-variant">What to do</dt>
                <dd className="text-on-surface">
                  Check the phone. Reach the person on another channel before touching this session; this card is for the operator, not the typist.
                </dd>
              </div>
            </dl>

            <div className="flex items-center justify-end gap-space-md pt-space-xs">
              <button
                type="button"
                onClick={goToThreats}
                className="font-body text-sm text-primary hover:underline"
              >
                Open the Threat view
              </button>
              <button
                type="button"
                onClick={close}
                className="px-space-lg py-space-sm rounded-lg bg-on-surface text-surface font-body text-sm font-medium"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
