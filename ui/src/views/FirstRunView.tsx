import React, { useState } from 'react';
import { useBiometrics } from '../context/BiometricsContext';
import { CalibrationWizard } from '../components/onboarding/CalibrationWizard';
import { Reveal } from '../components/motion/Reveal';

/**
 * What a machine with nobody enrolled on it should show.
 *
 * Every head measures against a personal baseline, so on a fresh install there is nothing
 * to measure against and the dashboard would be a wall of dashes. This says so plainly and
 * offers the one thing worth doing: ten sentences, and the machine knows your rhythm.
 *
 * It appears whenever the backend reports zero baselines, which is exactly the state a
 * fresh clone is in (data/ is personal and is not in the repository).
 */

const PANEL = 'rounded-xl border border-stone-200 dark:border-stone-700 bg-[#fdfcf9] dark:bg-[#151513] shadow-sm';

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <div className="flex gap-4">
    <span className="font-telemetry text-xs text-on-surface-variant pt-0.5 w-5 shrink-0">{String(n).padStart(2, '0')}</span>
    <div className="space-y-1">
      <h3 className="font-serif text-base font-medium text-on-surface">{title}</h3>
      <p className="font-body text-sm text-on-surface-variant leading-relaxed">{children}</p>
    </div>
  </div>
);

export const FirstRunView: React.FC = () => {
  const { live } = useBiometrics();
  const [calibrating, setCalibrating] = useState(false);

  if (calibrating) {
    return <CalibrationWizard onCancel={() => setCalibrating(false)} onDone={() => setCalibrating(false)} />;
  }

  return (
    <Reveal className="w-full max-w-3xl mx-auto flex flex-col gap-8 py-6">
      <div className="space-y-3">
        <span className="font-telemetry text-xs uppercase tracking-wider text-on-surface-variant">
          Nobody is enrolled on this machine
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-on-surface leading-tight">
          KeySign has nothing to compare you against yet.
        </h1>
        <p className="font-body text-sm sm:text-base text-on-surface-variant leading-relaxed max-w-2xl">
          Every part of this works by measuring your typing against your own baseline, so the first
          thing it needs is a few minutes of your typing. Ten sentences is enough to start: five
          typed calmly, five typed in a hurry, so it learns both ends of your range.
        </p>
      </div>

      <div className={`${PANEL} p-6 space-y-5`}>
        <Step n={1} title="Type ten sentences">
          They take about two minutes. Type them the way you normally would; a first calibration
          is always a little stiff, and the summary at the end tells you how tight your rhythm
          actually was.
        </Step>
        <Step n={2} title="The baseline exists immediately">
          Hold and flight times, the pauses, how often you correct yourself. The Threat and State
          heads start measuring against it the moment the wizard finishes.
        </Step>
        <Step n={3} title="Identity needs company">
          Telling two people apart needs at least two people enrolled. On a machine with one
          profile, KeySign still knows when the typing stops looking like yours; it just cannot
          put another name to it. Calibrate a second person and that turns on by itself.
        </Step>
        <Step n={4} title="Add your face, if you want the camera check">
          Settings has a button that takes eight frames from the webcam. That is what lets an
          alert tell "somebody else is typing" from "you, typing oddly", and nothing is pushed
          or locked without it having looked.
        </Step>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setCalibrating(true)}
          disabled={!live.connected}
          className="px-6 py-3 rounded-xl bg-primary text-white font-body font-medium text-sm transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          Start calibrating
        </button>
        <span className="font-body text-xs text-on-surface-variant">
          {live.connected
            ? 'Everything stays on this machine. The sentences are timed, not stored as text.'
            : 'Waiting for the backend: uv run python -m agent'}
        </span>
      </div>
    </Reveal>
  );
};
