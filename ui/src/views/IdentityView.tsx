import React from 'react';
import { useBiometrics } from '../context/BiometricsContext';
import { mockDigraphTimings } from '../data/mockIdentity';
import { RadialGauge } from '../components/common/RadialGauge';
import { AnimatedCounter } from '../components/common/AnimatedCounter';
import { Reveal, Swap } from '../components/motion/Reveal';
import { CardSpotlight } from '../components/motion/CardSpotlight';
import { ZBars } from '../components/state/ZBars';

/**
 * Identity: who is typing. Everything on this view except the digraph
 * example comes from the latest backend tick (live.tick) or the declared
 * user's baseline on disk.
 */

const titleCase = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

type Mode = 'offline' | 'idle' | 'warming' | 'unknown' | 'mismatch' | 'match';

export const IdentityView: React.FC = () => {
  const { userProfile, liveConfidence, liveDwell, liveFlight, live } = useBiometrics();

  const tick = live.tick;
  const idn = tick?.heads?.identity;
  const declared = live.declaredUser || tick?.user || '';
  const detected = idn?.user || null;
  const distance = tick?.distance ?? null;
  const baselineUser = tick?.baseline?.user || declared;

  const mode: Mode = !live.connected ? 'offline'
    : !tick?.features ? 'idle'
    : idn?.warming_up ? 'warming'
    : idn?.unknown ? 'unknown'
    : idn && idn.matches_declared === false ? 'mismatch'
    : 'match';

  const headline =
    mode === 'offline' ? 'No backend'
    : mode === 'idle' ? 'No one typing'
    : mode === 'warming' ? 'Identifying'
    : mode === 'unknown' ? 'Unknown'
    : titleCase(detected || declared || 'Unknown');

  const headlineClass =
    mode === 'unknown' ? 'text-error'
    : mode === 'mismatch' ? 'text-tertiary'
    : mode === 'match' ? 'text-primary'
    : 'text-on-surface-variant';

  const subline =
    mode === 'offline' ? userProfile.title
    : mode === 'idle' ? 'Type anywhere in this window. Timings go to the backend on this machine, characters do not.'
    : mode === 'warming' ? `Keep typing. ${tick?.n_keys ?? 0} keys in the window so far.`
    : mode === 'unknown' ? `Does not match anyone enrolled${idn?.closest ? ` · closest is ${titleCase(idn.closest)}` : ''}.`
    : mode === 'mismatch' ? `Typing under ${titleCase(declared)}'s name, but the rhythm is ${titleCase(detected || '')}'s.`
    : `Matches the declared user, ${titleCase(declared)}.`;

  const probs = Object.entries(idn?.probs || {})
    .filter(([, p]) => typeof p === 'number')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const moved = (tick?.top || []).slice(0, 5);
  // before the first tick, userProfile is the placeholder: fall back to the baseline list from the backend's hello
  const info = live.users.find((u) => u.user === declared);
  const enrolled = userProfile.enrolledSamples || info?.n_samples || 0;
  const hasBaseline = enrolled > 0;
  const hasBaselineNumbers = hasBaseline && userProfile.meanDwell > 0;
  const recorded = info?.created_at ? new Date(info.created_at).toLocaleString() : userProfile.lastRecalibrated;

  return (
    <Reveal className="flex flex-col w-full gap-space-2xl">
      {/* Hero: the answer */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-xl items-stretch">
        <CardSpotlight className="xl:col-span-8">
          <div className="h-full bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant flex flex-col justify-between gap-space-xl">
            <div>
              <span className="font-telemetry text-[11px] uppercase tracking-wider text-outline">
                Identity · {mode === 'offline' ? 'offline' : 'live'}
              </span>
              <h1 className={`font-serif font-medium tracking-tight text-5xl sm:text-6xl leading-none mt-space-sm ${headlineClass}`}>
                <Swap value={headline}>{headline}</Swap>
              </h1>
              <p className="font-body text-sm text-on-surface-variant mt-space-md max-w-2xl">{subline}</p>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-space-md border-t border-outline-variant pt-space-lg">
              <div>
                <dt className="font-body text-xs text-on-surface-variant">Declared</dt>
                <dd className="font-body text-sm text-on-surface mt-0.5">{declared ? titleCase(declared) : '—'}</dd>
              </div>
              <div>
                <dt className="font-body text-xs text-on-surface-variant">Detected</dt>
                <dd className="font-body text-sm text-on-surface mt-0.5">
                  <Swap value={detected || mode}>{mode === 'unknown' ? 'Unknown' : detected ? titleCase(detected) : '—'}</Swap>
                </dd>
              </div>
              <div>
                <dt className="font-body text-xs text-on-surface-variant">Confidence</dt>
                <dd className="text-sm text-on-surface mt-0.5">
                  <AnimatedCounter value={liveConfidence} decimals={0} suffix="%" />
                </dd>
              </div>
              <div>
                <dt className="font-body text-xs text-on-surface-variant">From {baselineUser ? `${titleCase(baselineUser)}'s` : 'the'} baseline</dt>
                <dd className="text-sm text-on-surface mt-0.5">
                  {distance == null ? <span className="font-telemetry">—</span> : <AnimatedCounter value={distance} decimals={2} suffix="σ" />}
                </dd>
              </div>
            </dl>
          </div>
        </CardSpotlight>

        <CardSpotlight className="xl:col-span-4">
          <div className="h-full bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant flex flex-col items-center justify-between text-center gap-space-md">
            <span className="w-full text-left font-telemetry text-[11px] uppercase tracking-wider text-outline">Confidence</span>
            <RadialGauge
              score={liveConfidence}
              size={190}
              label="Confidence"
              subtext={tick?.n_keys ? `${tick.n_keys} keys in window` : undefined}
            />
            <p className="font-body text-xs text-on-surface-variant">
              {mode === 'warming' ? 'Too few keys to vote yet.'
                : mode === 'match' || mode === 'mismatch' || mode === 'unknown'
                  ? `Classifier vote on the last ${tick?.window_s ?? 10} s of typing.`
                  : 'Fills in once someone types.'}
            </p>
          </div>
        </CardSpotlight>
      </div>

      {/* Who it could be + what moved */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-xl items-start">
        <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant">
          <span className="font-telemetry text-[11px] uppercase tracking-wider text-outline">Live</span>
          <h3 className="font-body text-sm font-medium text-on-surface mt-0.5">Who it could be</h3>
          <p className="font-body text-xs text-on-surface-variant mt-0.5 mb-space-lg">Probability per enrolled person from the identity classifier.</p>
          {probs.length ? (
            <ul className="flex flex-col gap-space-sm">
              {probs.map(([name, p]) => {
                const isTop = name === detected && mode !== 'unknown';
                return (
                  <li key={name} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-space-sm">
                    <span className={`font-body text-xs truncate ${isTop ? 'text-on-surface font-medium' : 'text-on-surface-variant'}`}>{titleCase(name)}</span>
                    <div className="h-2 rounded-full bg-surface-container-low overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isTop ? 'bg-primary' : 'bg-outline-variant'}`}
                        style={{ width: `${Math.round(p * 100)}%` }}
                      />
                    </div>
                    <AnimatedCounter value={p * 100} decimals={0} suffix="%" className="text-xs text-on-surface text-right" />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="font-body text-xs text-on-surface-variant">
              {live.users.length ? `${live.users.length} people enrolled. Probabilities appear once the classifier votes.` : 'No one enrolled on this machine yet.'}
            </p>
          )}
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant">
          <span className="font-telemetry text-[11px] uppercase tracking-wider text-outline">Live</span>
          <h3 className="font-body text-sm font-medium text-on-surface mt-0.5">What moved</h3>
          <p className="font-body text-xs text-on-surface-variant mt-0.5 mb-space-lg">
            Features furthest from {baselineUser ? `${titleCase(baselineUser)}'s` : 'the'} calm baseline, in standard deviations.
          </p>
          <ZBars items={moved} emptyText="Nothing to compare yet." />
        </div>
      </div>

      {/* Baseline vs now + digraph example */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant">
          <span className="font-telemetry text-[11px] uppercase tracking-wider text-outline">Baseline</span>
          <h3 className="font-body text-sm font-medium text-on-surface mt-0.5">{declared ? `${titleCase(declared)}'s` : 'The'} calm baseline vs now</h3>
          <p className="font-body text-xs text-on-surface-variant mt-0.5 mb-space-lg">
            {hasBaseline
              ? `Built from ${enrolled} recorded samples on this machine. Keystrokes never leave it.`
              : 'No baseline on this machine for the declared user. Record 10 or more calm samples on the capture page.'}
          </p>
          <div className="grid grid-cols-2 gap-space-md">
            <div className="rounded-lg bg-surface-container-low p-space-md">
              <span className="font-body text-xs text-on-surface-variant">Key hold</span>
              <div className="flex items-baseline gap-space-sm mt-space-xs">
                <AnimatedCounter value={liveDwell} decimals={0} suffix=" ms" className="text-2xl text-on-surface" />
                <span className="font-telemetry text-xs text-on-surface-variant">
                  {hasBaselineNumbers ? `baseline ${userProfile.meanDwell} ± ${userProfile.dwellStdDev}` : hasBaseline ? 'baseline loads on first tick' : 'no baseline'}
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-surface-container-low p-space-md">
              <span className="font-body text-xs text-on-surface-variant">Gap between keys</span>
              <div className="flex items-baseline gap-space-sm mt-space-xs">
                <AnimatedCounter value={liveFlight} decimals={0} suffix=" ms" className="text-2xl text-on-surface" />
                <span className="font-telemetry text-xs text-on-surface-variant">
                  {hasBaselineNumbers ? `baseline ${userProfile.meanFlight} ± ${userProfile.flightStdDev}` : hasBaseline ? 'baseline loads on first tick' : 'no baseline'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-space-xl gap-y-space-xs mt-space-lg font-body text-xs text-on-surface-variant">
            <span>Model: {userProfile.modelVersion}</span>
            {hasBaseline && <span>Baseline recorded {recorded}</span>}
          </div>
        </div>

        <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant">
          <span className="font-telemetry text-[11px] uppercase tracking-wider text-outline">Illustrative</span>
          <h3 className="font-body text-sm font-medium text-on-surface mt-0.5">What a digraph is</h3>
          <p className="font-body text-xs text-on-surface-variant mt-0.5 mb-space-lg">
            The time from one key to the next for a common pair. Example values, not yours: the live model works on aggregate timing features.
          </p>
          <ul className="flex flex-col gap-space-xs">
            {mockDigraphTimings.map((d) => (
              <li key={d.digraph} className="flex items-center justify-between gap-space-sm">
                <span className="font-telemetry text-xs text-on-surface w-10">{d.digraph}</span>
                <div className="flex-1 h-1.5 rounded-full bg-surface-container-low overflow-hidden">
                  <div className="h-full bg-outline-variant rounded-full" style={{ width: `${d.deltaPercent}%` }} />
                </div>
                <span className="font-telemetry text-xs text-on-surface-variant w-28 text-right">~{d.dwellMs} ms · {d.varianceText}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Reveal>
  );
};
