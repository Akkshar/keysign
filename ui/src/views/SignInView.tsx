import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { CalibrationWizard } from '../components/onboarding/CalibrationWizard';
import { useBiometrics } from '../context/BiometricsContext';

/**
 * The gate. Shown when sign-in is configured and nobody is signed in, and
 * again (as the "link your typing profile" step) right after a first sign-in.
 * One card, one job per screen, plain words. Sign-in talks to Firebase;
 * everything else on this page talks to the local backend.
 */
export const SignInView: React.FC = () => {
  const { status, account, link } = useAuth();
  const needsLink = status === 'signed-in' && account && (!link || !link.user);
  const forTheAppWindow = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('signin');
  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="mb-8 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-[19px]">keyboard_alt</span>
            </div>
            <span className="font-serif text-2xl font-medium tracking-tight">KeySign</span>
          </div>
          <p className="text-sm text-on-surface-variant">
            {needsLink
              ? `Signed in as ${account?.email}. One more step: which typing profile is yours?`
              : 'Your typing is a signature. Sign in to score it against your own baseline.'}
          </p>
          {forTheAppWindow && !needsLink && (
            <p className="text-sm text-primary">
              Sign in here, then go back to the KeySign window: it picks this up on its own.
            </p>
          )}
          {forTheAppWindow && needsLink && (
            <p className="text-sm text-primary">Choose your profile, then go back to the KeySign window.</p>
          )}
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-6 shadow-sm">
          {needsLink ? <LinkProfile /> : <SignInForm />}
        </div>
        <p className="mt-6 text-[11px] text-on-surface-variant leading-relaxed">
          Sign-in is the only part of KeySign that talks to the internet: your email and password (or the Google
          sign-in) go to Firebase. Keystrokes, baselines and alerts stay on this machine.
        </p>
      </motion.div>
    </div>
  );
};

const inputCls = 'w-full rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-amber-500/40';
const primaryCls = 'w-full rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const secondaryCls = 'w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface text-sm font-medium py-2.5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2';

const SignInForm: React.FC = () => {
  const {
    signIn, signUp, signInWithGoogle, continueAsOperator, error, busy,
    googleNeedsBrowser, signInViaBrowser, waitingForBrowser, browserSignInUrl, chromeAvailable, cancelBrowserWait,
  } = useAuth();
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void (mode === 'in' ? signIn(email, password) : signUp(email, password));
  };
  return (
    <div className="space-y-4">
      {/* In the app window Google's sign-in cannot run: pop-ups go to the system browser and
          Firebase's redirect flow does not survive Chromium's storage partitioning. So the
          browser signs in and this window picks the account up from the local backend. */}
      <button
        type="button"
        onClick={() => void (googleNeedsBrowser ? signInViaBrowser() : signInWithGoogle())}
        disabled={busy || waitingForBrowser}
        className={secondaryCls}
      >
        <GoogleMark />
        {googleNeedsBrowser ? 'Continue with Google in your browser' : 'Continue with Google'}
      </button>
      {waitingForBrowser && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5 space-y-2" role="status">
          <p className="text-xs text-on-surface">
            A browser is open. Finish signing in there and this window will follow, on its own.
          </p>
          <p className="text-xs text-on-surface-variant">
            Sign in with the browser you use Google in. If that is not the one that opened, put this address in it:
          </p>
          <code className="block select-all font-telemetry text-[11px] text-on-surface bg-surface-container-low rounded px-2 py-1 break-all">
            {browserSignInUrl || 'http://localhost:8000/?signin=1'}
          </code>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(browserSignInUrl || '').then(() => setCopied(true)).catch(() => setCopied(false));
              }}
              className="text-[11px] text-primary hover:underline"
            >
              {copied ? 'Address copied' : 'Copy the address'}
            </button>
            {chromeAvailable && (
              <button type="button" onClick={() => void signInViaBrowser('chrome')} className="text-[11px] text-primary hover:underline">
                Open it in Chrome instead
              </button>
            )}
            <button type="button" onClick={cancelBrowserWait} className="text-[11px] text-on-surface-variant hover:underline">
              Stop waiting
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
        <span className="h-px flex-1 bg-outline-variant/50" />or with email<span className="h-px flex-1 bg-outline-variant/50" />
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-on-surface">Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-on-surface">Password</span>
          <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </label>
        {error && <p className="text-xs text-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className={primaryCls}>
          {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <div className="flex items-center justify-between text-xs text-on-surface-variant">
        <button type="button" className="hover:underline" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
        <button type="button" className="hover:underline" onClick={continueAsOperator} title="Skip sign-in; pick the declared user from the dropdown instead">
          Continue as operator
        </button>
      </div>
    </div>
  );
};

const LinkProfile: React.FC = () => {
  const { account, linkProfile, signOut, error, busy } = useAuth();
  const { live } = useBiometrics();
  const [calibrating, setCalibrating] = useState(false);
  // The machine already measures against someone; offer that first so this is one click.
  const suggested = live.declaredUser && live.users.some((u) => u.user === live.declaredUser)
    ? live.declaredUser
    : live.users.length === 1 ? live.users[0].user : '';
  const [choice, setChoice] = useState<string>(suggested);
  useEffect(() => { setChoice((c) => c || suggested); }, [suggested]);
  const [newName, setNewName] = useState<string>(account?.name || '');
  const isNew = choice === '__new__';
  const name = isNew ? newName.trim() : choice;
  // Nobody signing in for the first time has a profile here: offer to build one rather than
  // asking them to pick from a list of strangers. (After the hooks above: an early return
  // before them changes the hook count and React unmounts the tree.)
  if (calibrating) return <CalibrationWizard onCancel={() => setCalibrating(false)} />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-on-surface">
        Signed in as <span className="font-medium">{account?.email}</span>.
      </p>
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
        <p className="text-sm text-on-surface">New here? Type ten sentences and KeySign learns your rhythm.</p>
        <button type="button" onClick={() => setCalibrating(true)}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">
          Set up my typing profile
        </button>
        <p className="text-[11px] text-on-surface-variant">About two minutes. Timings only; the letters are never stored.</p>
      </div>
      <p className="text-xs text-on-surface-variant">Or pick a profile that is already on this machine:</p>
      {!live.connected && (
        <p className="text-xs text-tertiary">The local backend is not running, so the enrolled profiles cannot be listed yet. Start it with <code className="font-telemetry">uv run python -m backend</code>.</p>
      )}
      <label className="block space-y-1">
        <span className="text-xs font-medium text-on-surface">Your typing profile</span>
        <select value={choice} onChange={(e) => setChoice(e.target.value)} className={inputCls}>
          <option value="">Choose…</option>
          {live.users.map((u) => <option key={u.user} value={u.user}>{u.user} · {u.n_samples} samples</option>)}
          <option value="__new__">I haven't enrolled yet</option>
        </select>
      </label>
      {isNew && (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-on-surface">Name for the new profile</span>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} placeholder="As you want it shown on the dashboard" />
          <span className="block text-[11px] text-on-surface-variant">Then record 10+ calm samples under this name on the capture page (http://localhost:8080) and rebuild.</span>
        </label>
      )}
      {error && <p className="text-xs text-error" role="alert">{error}</p>}
      <button type="button" disabled={busy || !name} onClick={() => void linkProfile(name)} className={primaryCls}>
        {busy ? 'Linking…' : 'Link and continue'}
      </button>
      <button type="button" onClick={() => void signOut()} className="w-full text-xs text-on-surface-variant hover:underline">Sign out</button>
    </div>
  );
};

/**
 * The end of the browser's part in the hand-off. This page was opened by the desktop window
 * only so Google's sign-in could run in a browser; once the local backend has the account,
 * the window carries on and this can go away. Browsers only let a page close itself when a
 * script opened it, so the card also says it in words.
 */
export const HandoffDone: React.FC = () => {
  const { account, link } = useAuth();
  const [closing, setClosing] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.close();
        window.open('', '_self')?.close();             // some browsers only allow it this way
      } catch { /* not ours to close */ }
      setTimeout(() => setClosing(false), 800);        // still here: ask for the click
    }, 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center space-y-4">
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-[19px]">keyboard_alt</span>
          </div>
          <span className="font-serif text-2xl font-medium tracking-tight">KeySign</span>
        </div>
        <h1 className="font-serif text-2xl font-medium">Signed in{account?.email ? ` as ${account.email}` : ''}.</h1>
        <p className="text-sm text-on-surface-variant">
          {link?.user
            ? `The KeySign window has it and is scoring ${link.user}'s typing. `
            : 'The KeySign window has it. '}
          {closing ? 'Closing this window…' : 'Nothing else happens here: close this window and carry on in KeySign.'}
        </p>
        <button
          type="button"
          onClick={() => { try { window.close(); } catch { /* ignore */ } }}
          className="px-4 py-2 rounded-lg bg-on-surface text-surface text-sm font-medium"
        >
          Close this window
        </button>
      </div>
    </div>
  );
};

const GoogleMark: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.3 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6z" />
    <path fill="#34A853" d="M24 48c6.2 0 11.6-2 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.7-3.8-13.6-9.2l-7.8 6C6.5 42.6 14.6 48 24 48z" />
  </svg>
);
