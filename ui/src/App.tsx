import React, { useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { BiometricsProvider, useBiometrics } from './context/BiometricsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SignInView } from './views/SignInView';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { TypewriterWatermark } from './components/layout/TypewriterWatermark';

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
import { AlertCard } from './components/telemetry/AlertCard';
import { ShootingStars } from './components/motion/ShootingStars';

import { motion, AnimatePresence } from 'framer-motion';

/** Sign-in gate: with Firebase configured, nobody gets the dashboard without an account (or operator mode). */
const Gate: React.FC = () => {
  const { status, link } = useAuth();
  if (status === 'loading') return <div className="min-h-screen bg-background" />;
  if (status === 'signed-out') return <SignInView />;
  if (status === 'signed-in' && (!link || !link.user)) return <SignInView />;
  return <MainContent />;
};

const MainContent: React.FC = () => {
  const { activeArea, onKeyAction } = useBiometrics();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

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

  const renderActiveView = () => {
    switch (activeArea) {
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
      case 'settings':
        return <SettingsView />;
      default:
        return <OverviewView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-body theme-transition flex relative overflow-x-hidden">
      {/* Ambient shooting stars (Aceternity) across every page; pointer-events off so nothing under it changes */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <ShootingStars
          minSpeed={14}
          maxSpeed={30}
          minDelay={1200}
          maxDelay={3600}
          starColor={isDark ? '#38bdf8' : '#6366f1'}
          trailColor={isDark ? '#818cf8' : '#a5b4fc'}
        />
      </div>

      {/* Ambient Misty Vintage Typewriter Watermark Layer */}
      <TypewriterWatermark />

      {/* Fixed Left Sidebar with KeySign Brand & Clinical Navigation */}
      <Sidebar />
      <AlertCard />

      {/* Main Viewport Container */}
      <div className="pl-64 flex-1 flex flex-col min-w-0 relative z-10">
        {/* Fixed Header with Monitoring Pill, Theme Toggle, Profile */}
        <Header />

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
