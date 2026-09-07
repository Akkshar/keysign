import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useBiometrics } from '../../context/BiometricsContext';
import { featureLabel } from '../threats/featureLabels';
import { fetchAlerts } from '../../lib/keysign';

/**
 * The operator's alert card, as a notification in the corner: it slides in at
 * the top right when the Threat head raises a silent alert and never covers
 * what is being typed. It shows what the typing said straight away and, a few
 * seconds later, what the camera said (backend/actions.py decides the final
 * call: intruder / duress / kept local). Opens from "Preview the alert card"
 * too. Dismisses itself after a while unless the pointer is over it.
 */
const AUTO_DISMISS_MS = 25_000;
const CAMERA_POLL_MS = [2500, 5000, 8000, 12000];

type FaceInfo = {
  match?: boolean | null; face?: boolean | null; enrolled?: number; similarity?: number | null;
  distance?: number | null; reason?: string; pushed?: boolean; final_kind?: string | null; frames?: number;
  method?: string; channel?: string; sent?: boolean;
};

export const AlertCard: React.FC = () => {
  const { alertCardOpen, setAlertCardOpen, setActiveArea, live } = useBiometrics();
  const reduce = useReducedMotion();
  const th = live.tick?.heads?.threat;
  const last = th?.last_alert ?? null;
  const declared = live.declaredUser || live.tick?.user || 'the declared user';
  const identity = live.tick?.heads?.identity;
  const [face, setFace] = useState<FaceInfo | null>(null);
  const [row, setRow] = useState<any | null>(null);      // this alert's own row from the log
  const hover = useRef(false);

  const typedKind = last?.kind ?? th?.kind ?? 'duress';
  const preview = !last;
  const finalKind = face?.final_kind === undefined ? null : face.final_kind;   // null until the backend has decided
  const kind = finalKind ?? typedKind;
  const when = last ? new Date(last.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;
  const drivers = ((row?.drivers ?? th?.drivers ?? []) as [string, number][]).slice(0, 2);
  const distance = row?.distance ?? th?.distance ?? null;
  const heldTicks = row?.sustained_ticks ?? th?.sustained_ticks ?? 0;
  const load = typeof row?.load === "number" ? row.load : th?.load;

  // The camera's verdict lands a few seconds after the alert: poll the alert log for it.
  useEffect(() => {
    if (!alertCardOpen || !last) { setFace(null); setRow(null); return; }
    let stop = false;
    const timers = CAMERA_POLL_MS.map((ms) => setTimeout(async () => {
      if (stop) return;
      try {
        const rows = await fetchAlerts(5);
        const hit = rows.find((a) => Math.abs((a.ts ?? 0) - last.ts) < 1.5);
        if (hit && !stop) setRow(hit);
        if (hit?.face && !stop) setFace(hit.face as FaceInfo);
      } catch { /* backend offline: the card keeps the typing's verdict */ }
    }, ms));
    return () => { stop = true; timers.forEach(clearTimeout); };
  }, [alertCardOpen, last?.ts]);

  // Self-dismiss, unless the operator is reading it.
  useEffect(() => {
    if (!alertCardOpen) return;
    const id = setInterval(() => { if (!hover.current) { setAlertCardOpen(false); } }, AUTO_DISMISS_MS);
    return () => clearInterval(id);
  }, [alertCardOpen, setAlertCardOpen]);

  const title = preview ? 'What an alert looks like' : kind === 'intruder' ? 'Intruder' : kind === 'duress' ? 'Duress' : 'Kept local';
  const what = preview
    ? 'A card like this appears here, at the edge, when the Threat head fires. Nothing opens in front of the typing.'
    : kind === 'intruder'
      ? (typedKind === 'duress'
        ? `The typing looked like ${declared} under duress, but the camera saw someone else at the keyboard.`
        : `Someone is typing under ${declared}'s name and the identity head disagrees${identity?.user && identity.user !== declared ? ` (closest match: ${identity.user})` : ''}.`)
      : kind === 'duress'
        ? (typedKind === 'intruder'
          ? `The typing drifted far enough that the identity head lost ${declared}, but the camera says ${declared} is in the chair and the load is high: ${declared} under pressure, not an impostor.`
          : `${declared} is typing, more than 3σ from their calm baseline and under high load, for long enough to rule out a stumble.`)
        : `The typing disagreed with ${declared}, but the camera saw ${declared} at the keyboard. Nothing was pushed.`;

  const sim = typeof face?.similarity === 'number' ? ` (${face.similarity.toFixed(2)})` : '';
  const cameraLine = preview
    ? 'A short webcam burst is checked against the enrolled owner; the answer decides intruder, duress, or kept local.'
    : face == null
      ? 'Checking the webcam against the enrolled owner…'
      : face.match === true ? `The owner is at the keyboard${sim}${face.frames ? `, best of ${face.frames} frames` : ''}.`
      : face.match === false ? `Not the owner${sim}.`
      : face.face === false ? 'No face in frame; the typing decides.'
      : !face.enrolled ? 'Owner face not enrolled (Settings); the typing decides.'
      : `${face.reason || 'The camera could not tell'}; the typing decides.`;

  const whereLine = preview
    ? `A push to the phone over ntfy${th?.channel ? ` (channel ${th.channel})` : ''}, a tray notification on this machine, and the screen lock for a confirmed intruder.`
    : face?.pushed === true
      ? (face.sent
        ? `Pushed to the phone as ${kind}${kind === 'intruder' ? ', and this machine is locking' : ''}.`
        : `Raised as ${kind} and written to the local alert log. No phone channel is configured (KEYSIGN_NTFY_TOPIC), so it went no further.`)
    : face?.pushed === false ? 'Kept on this machine; nothing was pushed and nothing locked.'
    : 'Waiting for the camera before deciding.';

  const close = () => setAlertCardOpen(false);
  const goToThreats = () => { setActiveArea('threats'); setAlertCardOpen(false); };
  const tone = preview ? 'text-on-surface' : kind === 'intruder' ? 'text-error' : kind === 'duress' ? 'text-tertiary' : 'text-secondary';
  const edge = preview ? 'border-outline-variant' : kind === 'intruder' ? 'border-error/60' : kind === 'duress' ? 'border-tertiary/60' : 'border-secondary/60';

  return (
    <AnimatePresence>
      {alertCardOpen && (
        <motion.aside
          role="status"
          aria-live="polite"
          aria-labelledby="alert-card-title"
          initial={{ opacity: 0, x: reduce ? 0 : 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduce ? 0 : 40 }}
          transition={{ duration: reduce ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          onMouseEnter={() => { hover.current = true; }}
          onMouseLeave={() => { hover.current = false; }}
          className={`fixed top-24 right-6 z-50 w-[22rem] max-w-[calc(100vw-3rem)] bg-surface-container-lowest rounded-xl p-space-xl shadow-2xl border-l-4 ${edge} border border-outline-variant flex flex-col gap-space-md pointer-events-auto`}
        >
          <div className="flex items-start justify-between gap-space-md">
            <div className="flex flex-col gap-space-2xs">
              <span className="font-telemetry text-xs uppercase tracking-wider text-on-surface-variant">
                {preview ? 'Preview · no alert has fired this session' : `Silent alert · ${when}`}
              </span>
              <h2 id="alert-card-title" className={`font-serif text-2xl font-medium tracking-tight ${tone}`}>{title}</h2>
            </div>
            <button type="button" onClick={close} aria-label="Dismiss"
              className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <p className="font-body text-sm text-on-surface">{what}</p>

          <dl className="flex flex-col gap-space-sm font-body text-sm">
            <div className="flex flex-col gap-space-2xs">
              <dt className="text-on-surface-variant text-xs">The numbers</dt>
              <dd className="font-telemetry text-on-surface text-xs">
                {distance != null ? `${distance.toFixed(2)}σ from calm` : 'no window yet'}
                {heldTicks ? ` · held ${heldTicks} ticks` : ''}
                {typeof load === 'number' ? ` · load ${Math.round(load * 100)}/100` : ''}
                {drivers.length ? ` · ${drivers.map(([f, z]) => `${featureLabel(f)} ${z > 0 ? '+' : ''}${z.toFixed(1)}σ`).join(', ')}` : ''}
              </dd>
            </div>
            <div className="flex flex-col gap-space-2xs">
              <dt className="text-on-surface-variant text-xs">Camera</dt>
              <dd className="text-on-surface">{cameraLine}</dd>
            </div>
            <div className="flex flex-col gap-space-2xs">
              <dt className="text-on-surface-variant text-xs">Where it went</dt>
              <dd className="text-on-surface">{whereLine}</dd>
            </div>
          </dl>

          <div className="flex items-center justify-end gap-space-md pt-space-2xs">
            <button type="button" onClick={goToThreats} className="font-body text-sm text-primary hover:underline">
              Open the Threat view
            </button>
            <button type="button" onClick={close}
              className="px-space-md py-space-xs rounded-lg bg-on-surface text-surface font-body text-sm font-medium">
              Dismiss
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
