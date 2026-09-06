import React from 'react';
import { Reveal } from '../components/motion/Reveal';
import { CardSpotlight } from '../components/motion/CardSpotlight';

/**
 * Privacy, stated as what the code does. Sources: ui/src/lib/keysign.ts
 * (what the browser sends), backend/app.py and backend/heads.py (what the
 * backend computes and writes), backend/README.md (alerts, recording, Gemini).
 */

const stages = [
  {
    title: 'Browser',
    sub: 'this page, or capture/index.html',
    lines: [
      'Listens to keydown and keyup.',
      'Sends key name, key code and a millisecond timestamp per event, batched every 250 ms.',
      'Only to ws://localhost:8000. Nothing else is contacted from the page.',
    ],
  },
  {
    title: 'Backend',
    sub: 'FastAPI on localhost:8000',
    lines: [
      'Keeps the last 10 seconds of events per session and turns them into 28 timing features.',
      'Measures distance to your baseline; runs the identity model (a scikit-learn RandomForest on 22 timing features), the state score and the threat rule.',
      'Broadcasts one tick per session to this dashboard over the same local socket.',
    ],
  },
  {
    title: 'Disk',
    sub: 'the repo\'s data/ folder',
    lines: [
      'data/baselines/<user>.json: one baseline per person (feature means and spreads).',
      'data/sessions/<date>_<session>.jsonl: every live session, raw events plus each tick. KEYSIGN_RECORD=0 turns this off.',
      'data/alerts.jsonl: silent alerts the threat head raised.',
    ],
  },
];

export const PrivacyView: React.FC = () => {
  return (
    <Reveal className="flex flex-col w-full gap-8 pb-12">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-on-surface">
          Keystrokes never leave this machine
        </h1>
        <p className="font-body text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
          There is no cloud in the loop. The browser talks to a backend on localhost, the backend writes plain
          files into the repo, and the two optional outbound messages carry a label and a number, never a key.
          This page lists exactly what moves where.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-0">
        {stages.map((s, i) => (
          <div key={s.title} className="relative flex">
            <div className="flex-1 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 space-y-3">
              <div>
                <h2 className="font-serif text-xl font-medium text-on-surface">{s.title}</h2>
                <p className="text-xs text-on-surface-variant font-telemetry">{s.sub}</p>
              </div>
              <ul className="space-y-2">
                {s.lines.map((l) => (
                  <li key={l} className="font-body text-sm text-on-surface leading-relaxed pl-3 border-l border-outline-variant/60">
                    {l}
                  </li>
                ))}
              </ul>
            </div>
            {i < stages.length - 1 && (
              <div className="hidden md:flex items-center px-2 text-on-surface-variant/60 select-none" aria-hidden>
                →
              </div>
            )}
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <CardSpotlight className="bg-surface-container-lowest border border-outline-variant/60">
          <div className="p-6 space-y-4">
            <h2 className="font-serif text-xl font-medium text-on-surface">What can leave the machine</h2>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Both are off unless an environment variable is set on the backend. Neither carries keystrokes or text.
            </p>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-on-surface">Silent phone alert (ntfy)</dt>
                <dd className="text-sm text-on-surface-variant leading-relaxed">
                  Needs <code className="font-telemetry text-xs">KEYSIGN_NTFY_TOPIC</code>. The push carries the alert kind
                  (intruder or duress), the user label, the baseline distance and the time. At most one per minute per
                  session, after three consecutive ticks above threshold.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-on-surface">State explanation (Gemini)</dt>
                <dd className="text-sm text-on-surface-variant leading-relaxed">
                  Needs <code className="font-telemetry text-xs">GEMINI_API_KEY</code>. Sends the state label, the load
                  number and the names of the features that moved, at most every 20 seconds, to get one plain sentence
                  back. Without a key a template sentence is used.
                </dd>
              </div>
            </dl>
          </div>
        </CardSpotlight>

        <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 space-y-4">
          <h2 className="font-serif text-xl font-medium text-on-surface">What we don't do</h2>
          <ul className="space-y-2.5">
            {[
              'No account, no login, no server outside this machine.',
              'No upload of keystrokes, features, baselines or session files, ever.',
              'No deep learning and no remote model: the identity model is a RandomForest trained from a CSV in the repo.',
              'No encryption claims. The files are plain JSON on your disk, protected by your OS and nothing else.',
              'No reading of what you type in other apps. Capture is the page you have open and the capture page only.',
              'No diagnosis. Health signals are a research roadmap and are not computed.',
            ].map((l) => (
              <li key={l} className="font-body text-sm text-on-surface leading-relaxed pl-3 border-l border-outline-variant/60">
                {l}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="text-xs text-on-surface-variant leading-relaxed max-w-3xl">
        One thing worth knowing: the backend receives key names, not just timings, and the session recording keeps
        them. That is what makes a misjudged demo run reusable as training data, and it also means what you typed in
        a live session can be read back from your own <code className="font-telemetry">data/sessions/</code> folder.
        Delete the file, or set <code className="font-telemetry">KEYSIGN_RECORD=0</code>, if you don't want that.
      </p>
    </Reveal>
  );
};
