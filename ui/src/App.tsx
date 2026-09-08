import React, { useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { BiometricsProvider, useBiometrics } from './context/BiometricsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HandoffDone, SignInView } from './views/SignInView';
import { setCalibrating } from './lib/enrol';
import { TopNav } from './components/layout/TopNav';
import { TypewriterWatermark } from './components/layout/TypewriterWatermark';

import { MainOverviewFlow } from './views/MainOverviewFlow';
import { LiveDemoView } from './views/LiveDemoView';
import { OverviewView } from './views/OverviewView';
import { HealthSignalsView } from './views/HealthSignalsView';
import { LiveMonitoringView } from './views/LiveMonitoringView';
import { HistoryView } from './views/HistoryView';
import { PrivacyView } from './views/PrivacyView';
import { IdentityView } from './views/IdentityView';
import { StateView } from './views/StateView';
import { ThreatsView } from './views/ThreatsView';
import { DriftView } from './views/DriftView';
import { SettingsView } from './views/SettingsView';
import { FirstRunView } from './views/FirstRunView';
import { AlertCard } from './components/telemetry/AlertCard';
import { FallingKeys } from './components/motion/FallingKeys';

import { motion, AnimatePresence } from 'framer-motion';

/**
 * Hold the machine's alerts while an onboarding screen is up. It is a heartbeat, not a
 * switch: the backend's hold expires on its own, so a page that goes away cannot leave the
 * machine deaf (backend/enrol.py).
 */
const useHoldAlerts = (on: boolean) => {
  useEffect(() => {
    if (!on) return;
    void setCalibrating(true);
    const id = setInterval(() => { void setCalibrating(true); }, 60_000);
    return () => { clearInterval(id); void setCalibrating(false); };
  }, [on]);
};


/**
 * Sign-in gate: with Firebase configured, nobody gets the dashboard without an account (or
 * operator mode). While this is on screen the machine holds its alerts: whoever is typing at
 * a sign-in screen is not the person the baseline belongs to, so scoring them raises intruder
 * alerts, opens the camera and can lock the laptop in a new person's face.
 */
const Gate: React.FC = () => {
  const { status, link } = useAuth();
  const atTheGate = status === 'signed-out' || (status === 'signed-in' && (!link || !link.user));
  useHoldAlerts(atTheGate);
  if (status === 'loading') return <div className="min-h-screen bg-background" />;
  if (status === 'signed-out') return <SignInView />;
  if (status === 'signed-in' && (!link || !link.user)) return <SignInView />;
  // This page was opened only so the desktop window could sign in (?signin=1). That is done:
  // say so and close, rather than leaving a second dashboard running in the browser.
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('signin')) return <HandoffDone />;
  return <MainContent />;
};

const MainContent: React.FC = () => {
  const { activeArea, onKeyAction, live } = useBiometrics();

  // Global keystroke listener: typing anywhere on the site interacts with the 3D typewriter and telemetry.
  // The timings also stream to the local backend (see BiometricsContext), which is what the heads score.
  useEffect(() => {
    const handleGlobalDown = (e: KeyboardEvent) => {
      // Don't intercept function shortcuts or browser hotkeys
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      onKeyAction('down', e);
    };

    const handleGlobalUp = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      onKeyAction('up', e);
    };

    window.addEventListener('keydown', handleGlobalDown);
    window.addEventListener('keyup', handleGlobalUp);
    return () => {
      window.removeEventListener('keydown', handleGlobalDown);
      window.removeEventListener('keyup', handleGlobalUp);
    };
  }, [onKeyAction]);

  // Nobody enrolled on this machine: every head measures against a personal baseline, so
  // there is nothing to show and one thing worth doing. Settings stays reachable, because
  // that is where the backend's own state and the face enrolment live.
  const noProfile = live.connected && live.users.length === 0;

  const renderActiveView = () => {
    if (noProfile && activeArea !== 'settings' && activeArea !== 'privacy') return <FirstRunView />;
    switch (activeArea) {
      case 'introduction':
        return <MainOverviewFlow />;
      case 'overview':
        return <OverviewView />;
      case 'health-signals':
        return <HealthSignalsView />;
      case 'monitoring':
        return <LiveMonitoringView />;
      case 'history':
        return <HistoryView />;
      case 'privacy':
        return <PrivacyView />;
      case 'identity':
        return <IdentityView />;
      case 'state':
        return <StateView />;
      case 'threats':
        return <ThreatsView />;
      case 'drift':
        return <DriftView />;
      case 'live-demo':
        return <LiveDemoView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <OverviewView />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-body theme-transition flex relative overflow-x-hidden">
      {/* Ambient layer, pointer-events off so nothing under it changes.
          The starfield and the shooting stars used to live here. They went for two reasons:
          the stars' cores blew out to white and read as blips flickering over the dark page,
          and a twinkling galaxy behind a keystroke-security tool is decoration that belongs
          to some other product. What is left is keycaps drifting down at about a tenth
          opacity, which at least says what this thing is about. */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <FallingKeys />
      </div>

      {/* Ambient Misty Vintage Typewriter Watermark Layer */}
      <TypewriterWatermark />

      <TopNav />
      <AlertCard />

      {/* Main Viewport Container */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">

        {/* Scrollable Content Canvas */}
        <main className="relative pt-24 min-h-screen w-full px-6 sm:px-10 lg:px-14 max-w-7xl mx-auto theme-transition">
          {/* No exit animation: with mode="wait" the outgoing view could hang the switch while
              the WebGL typewriter and the live tick stream keep re-rendering. */}
          <motion.div
            key={activeArea}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {renderActiveView()}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BiometricsProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </BiometricsProvider>
    </ThemeProvider>
  );
};

export default App;
