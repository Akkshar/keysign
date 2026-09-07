import React, { useEffect, useState } from 'react';
import { useBiometrics } from '../context/BiometricsContext';
import { clearFaceSamples, fetchFaceStatus } from '../lib/webcam';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Reveal } from '../components/motion/Reveal';

/**
 * Settings. Only controls that change something on this dashboard live here
 * (who the baseline is measured against, the window reset, the theme). What
 * the backend tunes is listed as read-only with where it is set, so nobody
 * mistakes a slider for a security control.
 */
export const SettingsView: React.FC = () => {
  const { live } = useBiometrics();
  const { theme, toggleTheme } = useTheme();

  return (
    <Reveal className="flex flex-col w-full gap-8 pb-12">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-on-surface">Settings</h1>
        <p className="font-body text-sm sm:text-base text-on-surface-variant max-w-2xl leading-relaxed">
          Four things this dashboard can change. Everything else is a constant in the backend and is listed below
          so you know where to look.
        </p>
      </div>

      <AccountSection />

      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label htmlFor="settings-user" className="text-sm font-medium text-on-surface">Measure against</label>
            <p className="text-xs text-on-surface-variant">
              Whose baseline the distance and the threat rule use. Baselines found on disk:{' '}
              <span className="font-telemetry">{live.users.length}</span>.
            </p>
          </div>
          <select
            id="settings-user"
            value={live.declaredUser}
            onChange={(e) => live.setDeclaredUser(e.target.value)}
            className="bg-surface-container-low border border-outline-variant/60 rounded-lg px-3 py-2 text-sm text-on-surface font-body min-w-[14rem]"
          >
            <option value="">No one selected</option>
            {live.users.map((u) => (
              <option key={u.user} value={u.user}>
                {u.user} · {u.n_samples} samples
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6 border-t border-outline-variant/40">
          <div>
            <span className="text-sm font-medium text-on-surface">Start a fresh window</span>
            <p className="text-xs text-on-surface-variant">
              Clears the backend's 10-second buffer for this session. Use it when someone new sits down.
            </p>
          </div>
          <button
            type="button"
            onClick={live.reset}
            disabled={!live.connected}
            className="px-4 py-2 rounded-lg border border-outline-variant/60 bg-surface-container-low text-sm text-on-surface hover:border-outline disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Reset window
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6 border-t border-outline-variant/40">
          <div>
            <span className="text-sm font-medium text-on-surface">Photo on intruder alert</span>
            <p className="text-xs text-on-surface-variant">
              The camera stays off. When the Threat head raises an intruder alert it opens for one frame, the backend
              checks the face against your enrolled face and grabs the screen, and the images go with the phone push
              only if the face is not yours. Never for duress. Stored in data/alert_photos on this machine.
              {live.cameraError ? ` Camera: ${live.cameraError}.` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { void live.setPhotoOnIntruder(!live.photoOnIntruder); }}
            className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
              live.photoOnIntruder
                ? 'border-primary bg-primary text-white hover:bg-primary/90'
                : 'border-outline-variant/60 bg-surface-container-low text-on-surface hover:border-outline'
            }`}
          >
            {live.photoOnIntruder ? 'On · camera open' : 'Off'}
          </button>
        </div>

        <FaceEnrolment />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6 border-t border-outline-variant/40">
          <div>
            <span className="text-sm font-medium text-on-surface">Theme</span>
            <p className="text-xs text-on-surface-variant">Currently {theme}.</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="px-4 py-2 rounded-lg border border-outline-variant/60 bg-surface-container-low text-sm text-on-surface hover:border-outline transition-colors"
          >
            Switch to {theme === 'dark' ? 'light' : 'dark'}
          </button>
        </div>
      </section>

      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-serif text-xl font-medium text-on-surface">Set on the backend</h2>
          <p className="text-xs text-on-surface-variant">
            Read-only here. A UI for these is coming later; for now they are constants or environment variables.
          </p>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-3 text-sm">
          <dt className="text-on-surface">Backend address</dt>
          <dd className="font-telemetry text-xs text-on-surface-variant">
            {live.connected ? 'localhost:8000 · connected' : 'localhost:8000 · not connected'}
          </dd>
          <dt className="text-on-surface">Phone alert topic</dt>
          <dd className="font-telemetry text-xs text-on-surface-variant">KEYSIGN_NTFY_TOPIC (env)</dd>
          <dt className="text-on-surface">Session recording</dt>
          <dd className="font-telemetry text-xs text-on-surface-variant">KEYSIGN_RECORD=0 to disable (env)</dd>
          <dt className="text-on-surface">Threat thresholds and the unknown-user distance</dt>
          <dd className="font-telemetry text-xs text-on-surface-variant">backend/heads.py</dd>
          <dt className="text-on-surface">Window length and tick rate</dt>
          <dd className="font-telemetry text-xs text-on-surface-variant">backend/app.py</dd>
        </dl>
      </section>
    </Reveal>
  );
};


/** Owner face enrolment for the intruder photo check. Five frames, ~2 s, stored as face crops on this machine. */
const FaceEnrolment: React.FC = () => {
  const { live } = useBiometrics();
  const [n, setN] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const user = live.declaredUser;
  useEffect(() => {
    if (!user || !live.connected) { setN(null); return; }
    fetchFaceStatus(user).then((s) => setN(s.n_samples)).catch(() => setN(null));
  }, [user, live.connected]);
  const enrol = async () => {
    if (!user) return;
    setBusy(true); setMsg('Look at the camera…');
    const r = await live.enrolFace(user, 5);
    setBusy(false);
    setN(r.n_samples);
    setMsg(r.ok ? `Stored ${r.n_samples} face samples for ${user}.` : `No face captured${r.reason ? `: ${r.reason}` : ''}.`);
  };
  const clear = async () => {
    if (!user) return;
    await clearFaceSamples(user); setN(0); setMsg(`Cleared ${user}'s face samples.`);
  };
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6 border-t border-outline-variant/40">
      <div>
        <span className="text-sm font-medium text-on-surface">Your face, for the intruder check</span>
        <p className="text-xs text-on-surface-variant">
          {user ? `${user}: ` : ''}{n == null ? 'not enrolled' : n === 0 ? 'no face samples yet' : `${n} face samples on this machine`}.
          {' '}Five frames from the webcam, cropped to the face and kept in data/faces. A photo taken at an alert is
          compared with these; if it matches, it stays here.{msg ? ` ${msg}` : ''}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button type="button" onClick={enrol} disabled={busy || !user || !live.connected}
          className="px-4 py-2 rounded-lg border border-outline-variant/60 bg-surface-container-low text-sm text-on-surface hover:border-outline disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {busy ? 'Capturing…' : n ? 'Add 5 more frames' : 'Enrol my face'}
        </button>
        {!!n && (
          <button type="button" onClick={clear} disabled={busy}
            className="px-3 py-2 rounded-lg border border-outline-variant/60 text-sm text-on-surface-variant hover:border-outline transition-colors">
            Clear
          </button>
        )}
      </div>
    </div>
  );
};


/** Who is signed in, which typing profile the account is linked to, sign out. */
const AccountSection: React.FC = () => {
  const auth = useAuth();
  const { live } = useBiometrics();
  if (auth.status === 'unconfigured') {
    return (
      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 space-y-2">
        <h2 className="font-serif text-xl font-medium text-on-surface">Account</h2>
        <p className="text-xs text-on-surface-variant">
          Sign-in is not configured, so the declared user is the dropdown below. To enable email and Google sign-in,
          copy <code className="font-telemetry">ui/.env.example</code> to <code className="font-telemetry">ui/.env</code>, fill in the Firebase web
          config, and restart the dev server.
        </p>
      </section>
    );
  }
  if (auth.status !== 'signed-in' || !auth.account) {
    return (
      <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 space-y-3">
        <h2 className="font-serif text-xl font-medium text-on-surface">Account</h2>
        <p className="text-xs text-on-surface-variant">Operator mode: nobody is signed in; the declared user is the dropdown below.</p>
        <button type="button" onClick={() => { sessionStorage.removeItem('keysign.ui.operator'); window.location.reload(); }}
          className="px-4 py-2 rounded-lg border border-outline-variant/60 bg-surface-container-low text-sm text-on-surface hover:border-outline transition-colors">
          Sign in
        </button>
      </section>
    );
  }
  const a = auth.account;
  return (
    <section className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        {a.photo ? <img src={a.photo} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover" />
          : <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center text-sm font-medium">{(a.name || a.email)[0]?.toUpperCase()}</div>}
        <div>
          <h2 className="font-serif text-xl font-medium text-on-surface">{a.name || a.email}</h2>
          <p className="text-xs text-on-surface-variant">{a.email} · signed in with {a.provider === 'google' ? 'Google' : 'email'}</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-outline-variant/40">
        <div>
          <span className="text-sm font-medium text-on-surface">Your typing profile</span>
          <p className="text-xs text-on-surface-variant">
            The baseline this account is scored against. {auth.link?.user ? `Linked to ${auth.link.user}${auth.link.has_baseline ? '' : ' (no baseline yet: record samples on the capture page and rebuild)'}.` : 'Not linked yet.'}
          </p>
        </div>
        <select
          value={auth.link?.user || ''}
          onChange={(e) => { if (e.target.value) void auth.linkProfile(e.target.value); }}
          className="bg-surface-container-low border border-outline-variant/60 rounded-lg px-3 py-2 text-sm text-on-surface font-body min-w-[14rem]"
        >
          <option value="">Choose a profile…</option>
          {live.users.map((u) => <option key={u.user} value={u.user}>{u.user} · {u.n_samples} samples</option>)}
          {auth.link?.user && !live.users.some((u) => u.user === auth.link?.user) && <option value={auth.link.user}>{auth.link.user} · not enrolled yet</option>}
        </select>
      </div>
      {auth.error && <p className="text-xs text-error">{auth.error}</p>}
      <div className="flex justify-end pt-2">
        <button type="button" onClick={() => void auth.signOut()} className="px-4 py-2 rounded-lg border border-outline-variant/60 text-sm text-on-surface-variant hover:border-outline transition-colors">
          Sign out
        </button>
      </div>
    </section>
  );
};
