import React from 'react';
import { useBiometrics } from '../context/BiometricsContext';
import { useTheme } from '../context/ThemeContext';
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
          Three things this dashboard can change. Everything else is a constant in the backend and is listed below
          so you know where to look.
        </p>
      </div>

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
              Keeps the webcam open and, when the Threat head raises an intruder alert, stores one frame with the alert
              and sends it with the phone push. Never for duress. Stored in data/alert_photos on this machine.
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
