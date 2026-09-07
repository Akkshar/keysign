import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useBiometrics } from '../../context/BiometricsContext';
import { enrol, setCalibrating, type EnrolSummary } from '../../lib/enrol';

/**
 * Calibration: ten sentences, and the person typing them has a profile of their own.
 *
 * Five typed calmly become their baseline (the centre and spread every head measures
 * against); five typed at speed set their high-load cut-off, so the State head knows what
 * *their* pressure looks like rather than the team's. The keystrokes go to the local backend
 * as timings only, never the letters. The numbers on the last screen are the ones the backend
 * measured, not decoration.
 *
 * Alerts are held off while this is open: someone typing ten sentences at speed under the
 * last person's name is exactly what the Threat head is built to notice, and locking the
 * laptop in a reviewer's face would be a poor introduction.
 */

const CALM_SENTENCES = [
  'The morning dew settles quietly across the forest moss.',
  'Breathe steadily and allow each finger to find its natural rhythm.',
  'Gentle ocean waves lap against the sandy shore under a warm sun.',
  'Quiet footsteps wander slowly along the shaded mountain path.',
  'Soft ambient sunlight filters through the tall library windows.',
];

const STRESSED_SENTENCES = [
  'Immediately dispatch emergency response units to all primary sectors!',
  'Critical system failure detected in auxiliary cooling line seven!',
  'Execute the emergency manual override sequence before timeout expires!',
  'High priority intruder alarm triggered across the server facility perimeter!',
  'Accelerate data recovery immediately to prevent catastrophic packet loss!',
];

type KeyEvent = { type: 'down' | 'up'; key: string; code: string; t: number };
type Sample = { condition: 'calm' | 'stress'; prompt: string; events: KeyEvent[] };

export const CalibrationWizard: React.FC<{ onDone?: (user: string) => void; onCancel?: () => void }> = ({ onDone, onCancel }) => {
  const { account, linkProfile } = useAuth();
  const { live } = useBiometrics();

  const [name, setName] = useState<string>(account?.name || '');
  const [started, setStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<EnrolSummary | null>(null);

  const samples = useRef<Sample[]>([]);
  const events = useRef<KeyEvent[]>([]);
  const down = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const isCalm = currentStep < 5;
  const sentence = isCalm ? CALM_SENTENCES[currentStep] : STRESSED_SENTENCES[currentStep - 5];

  // Hold the machine's alerts off for as long as this is on screen.
  useEffect(() => {
    if (!started) return;
    void setCalibrating(true);
    return () => { void setCalibrating(false); };
  }, [started]);

  useEffect(() => {
    if (started) inputRef.current?.focus();
    events.current = [];
    down.current.clear();
  }, [currentStep, started]);

  const record = (type: 'down' | 'up', e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key === ' ' ? ' ' : e.key;
    if (key.length !== 1 && !['Backspace', 'Delete', 'Enter', 'Shift', ' '].includes(key)) return;
    if (type === 'down') {
      if (down.current.has(e.code)) return;              // the OS repeating a held key
      down.current.add(e.code);
    } else {
      down.current.delete(e.code);
    }
    events.current.push({ type, key, code: e.code, t: performance.now() });
  };

  const finishSentence = async () => {
    samples.current.push({
      condition: isCalm ? 'calm' : 'stress',
      prompt: sentence,
      events: [...events.current],
    });
    if (currentStep < 9) {
      setCurrentStep((s) => s + 1);
      setTypedText('');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await enrol({ user: name.trim(), email: account?.email, samples: samples.current });
      setSummary(r);
      live.setDeclaredUser(r.user);                       // measure against them from here on
      // The account is linked when they leave this screen, not now: linking flips the gate,
      // which would replace these numbers with the dashboard before anyone had read them.
    } catch (e: any) {
      setError(String(e?.message || e));
      setCurrentStep(0);
      samples.current = [];
      setTypedText('');
    } finally {
      setBusy(false);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTypedText(val);
    if (val.length >= sentence.length) setTimeout(() => { void finishSentence(); }, 120);
  };

  const rendered = useMemo(() => sentence.split('').map((char, i) => {
    const done = i < typedText.length;
    const right = done && typedText[i] === char;
    return (
      <span key={i} className={`relative inline-block transition-colors rounded-xs px-[1px] ${
        !done ? 'text-on-surface-variant/70'
          : right ? 'text-stone-900 bg-amber-400 font-semibold'
          : 'text-white bg-error font-semibold'}`}>
        {i === typedText.length && <span className="absolute -left-[1.5px] top-0 bottom-0 w-[2px] bg-amber-500 animate-pulse" />}
        {char === ' ' ? ' ' : char}
      </span>
    );
  }), [sentence, typedText]);

  // ---- the name, before any typing ----
  if (!started) {
    return (
      <Shell title="Set up your typing profile"
             sub="Ten sentences, about two minutes. Five typed normally become your baseline; five typed at speed teach it what your pressure looks like.">
        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-on-surface">The name for this profile</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="As it should read on the dashboard"
              className="w-full rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {account?.email && <span className="block text-[11px] text-on-surface-variant">Linked to {account.email}.</span>}
          </label>
          <p className="text-xs text-on-surface-variant">
            Only the timing of your keys is kept: how long each is held and the gaps between them. The letters are
            not stored, and nothing leaves this machine. Alerts are paused until you finish.
          </p>
          {error && <p className="text-xs text-error" role="alert">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={name.trim().length < 2}
              onClick={() => setStarted(true)}
              className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
            >
              Start calibration
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel} className="text-xs text-on-surface-variant hover:underline">
                Not now
              </button>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // ---- the result ----
  if (summary) {
    const rows: [string, string][] = [
      ['Calm hold time', `${summary.hold_mean_ms} ms`],
      ['Under pressure', summary.stress_hold_mean_ms != null
        ? `${summary.stress_hold_mean_ms} ms (${summary.stress_hold_change_pct! > 0 ? '+' : ''}${summary.stress_hold_change_pct}%)`
        : 'not measured'],
      ['Gap between keys', `${summary.flight_mean_ms} ms`],
      ['Baseline tightness', `${summary.spread}σ typical`],
    ];
    return (
      <Shell title="Your baseline is built"
             sub={`${summary.calm_samples} calm and ${summary.stress_samples} pressured sentences. From the next key you type, KeySign measures against ${summary.user}.`}>
        <div className="space-y-5">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-surface-container-low font-telemetry text-xs">
            {rows.map(([k, v]) => (
              <div key={k} className="space-y-1">
                <dt className="text-on-surface-variant text-[10px] uppercase tracking-wider">{k}</dt>
                <dd className="text-on-surface text-sm">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-on-surface-variant">
            Ten sentences is a small baseline: it is enough to score you, and it tightens every time you
            calibrate again. The identity model is being retrained in the background so it can tell you
            from the others; until it finishes, Identity may call you unknown, which is the honest answer.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              if (account?.email) { try { await linkProfile(summary.user); } catch { /* the backend linked it already */ } }
              setBusy(false);
              onDone?.(summary.user);
            }}
            className="px-5 py-2.5 rounded-lg bg-on-surface text-surface text-sm font-medium disabled:opacity-50"
          >
            Open the dashboard
          </button>
        </div>
      </Shell>
    );
  }

  // ---- typing ----
  return (
    <Shell
      title="Personal baseline calibration"
      sub={isCalm
        ? 'Type normally and comfortably. This is your relaxed rhythm.'
        : 'Now type with urgency, as fast as you can. This is what pressure does to it.'}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 font-telemetry text-xs">
          <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold uppercase tracking-wider border ${
            isCalm ? 'bg-secondary/10 text-secondary border-secondary/40' : 'bg-tertiary/10 text-tertiary border-tertiary/40'}`}>
            {isCalm ? 'Calm baseline' : 'Under pressure'}
          </span>
          <span className="text-on-surface-variant">Sentence {currentStep + 1} of 10</span>
        </div>

        <div className="flex items-center gap-1.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-xs transition-all ${
              i < currentStep ? (i < 5 ? 'bg-secondary' : 'bg-tertiary')
                : i === currentStep ? (isCalm ? 'bg-secondary/70 scale-y-125' : 'bg-tertiary/70 scale-y-125')
                : 'bg-outline-variant/40'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            onClick={() => inputRef.current?.focus()}
            className="relative rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-5 cursor-text"
          >
            <div className="font-telemetry text-lg leading-relaxed tracking-wide break-words">{rendered}</div>
            <input
              ref={inputRef}
              type="text"
              value={typedText}
              onChange={onChange}
              onKeyDown={(e) => record('down', e)}
              onKeyUp={(e) => record('up', e)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-text"
              autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
              aria-label={`Calibration sentence ${currentStep + 1} of 10`}
            />
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between font-telemetry text-[10.5px] text-on-surface-variant">
          <span>{typedText.length} / {sentence.length} characters</span>
          <span>Alerts are paused while you calibrate</span>
        </div>

        {busy && <p className="text-sm text-on-surface" role="status">Building your baseline…</p>}
        {error && <p className="text-xs text-error" role="alert">{error}</p>}
      </div>
    </Shell>
  );
};

const Shell: React.FC<{ title: string; sub: string; children: React.ReactNode }> = ({ title, sub, children }) => (
  <div className="w-full max-w-2xl mx-auto py-10 px-6 flex flex-col gap-6">
    <div className="space-y-2">
      <h1 className="font-serif text-3xl font-medium tracking-tight text-on-surface">{title}</h1>
      <p className="text-sm text-on-surface-variant">{sub}</p>
    </div>
    <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-sm">{children}</div>
  </div>
);
