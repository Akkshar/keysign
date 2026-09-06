import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBiometrics } from '../../context/BiometricsContext';
import { useTheme } from '../../context/ThemeContext';
import { RhythmStrip } from '../common/RhythmStrip';

export const Header: React.FC = () => {
  const { activeArea, isTyping, live } = useBiometrics();
  const { theme, toggleTheme } = useTheme();

  const getAreaLabel = () => {
    switch (activeArea) {
      case 'overview': return 'Overview';
      case 'health-signals': return 'Health Signals';
      case 'monitoring': return 'Live Monitoring';
      case 'identity': return 'Identity';
      case 'state': return 'State';
      case 'threats': return 'Threats';
      case 'drift': return 'Drift';
      case 'history': return 'History & Trends';
      case 'privacy': return 'Privacy & Enclave';
      default: return 'Overview';
    }
  };

  const initials = (live.declaredUser || '?').split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white/40 dark:bg-slate-900/50 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 z-40 flex items-center justify-between px-8 lg:px-12 theme-transition select-none">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2">
        <span className="font-serif font-medium text-slate-900 dark:text-slate-100 text-sm">KeySign</span>
        <span className="material-symbols-outlined text-[14px] text-slate-400">chevron_right</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={activeArea}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            transition={{ duration: 0.18 }}
            className="text-slate-600 dark:text-slate-400 text-xs font-medium"
          >
            {getAreaLabel()}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Right: Monitoring Pill, Theme Switcher & User Profile */}
      <div className="flex items-center gap-4 lg:gap-6">
        {/* The signature: your last keystrokes as a rhythm strip. Beats while you type. */}
        <div className="hidden md:flex items-center gap-3 pr-2 mr-2 border-r border-slate-200/70 dark:border-slate-700/60">
          <RhythmStrip />
          <span className={`hidden lg:inline whitespace-nowrap text-[11px] font-medium transition-colors ${isTyping ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`}>
            {isTyping ? 'typing' : 'your rhythm'}
          </span>
        </div>

        {/* Live Status Pill: reflects the local backend, not a decoration */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium shadow-sm ${
            live.connected
              ? 'bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-200/70 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50/90 dark:bg-rose-950/60 border-rose-200/70 dark:border-rose-800/60 text-rose-800 dark:text-rose-300'
          }`}
          data-purpose="monitoring-status"
          title={live.connected ? `backend connected · session ${live.sessionId}` : 'start it with: uv run python -m backend'}
        >
          <span className="relative flex h-2 w-2">
            {live.connected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${live.connected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
          </span>
          <span className="tracking-tight font-medium">
            {live.connected ? (live.streaming ? 'Live · on-device backend' : 'Backend connected') : 'No backend on :8000'}
          </span>
        </div>

        {/* Reset the backend window (someone new sits down) */}
        {live.connected && (
          <button
            type="button"
            onClick={live.reset}
            title="Clear the backend's typing window"
            className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-white/70 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">restart_alt</span>
            Reset
          </button>
        )}

        {/* Theme Toggle Button */}
        <motion.button
          onClick={toggleTheme}
          whileHover={{ scale: 1.05, rotate: 15 }}
          whileTap={{ scale: 0.9, rotate: 180 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          className="w-8 h-8 rounded-full bg-white/70 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200/70 dark:border-slate-700/60 transition-colors"
        >
          <motion.span
            key={theme}
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 90 }}
            transition={{ duration: 0.2 }}
            className="material-symbols-outlined text-[17px]"
          >
            {theme === 'light' ? 'dark_mode' : 'light_mode'}
          </motion.span>
        </motion.button>

        {/* Declared user: whose baseline the typing is measured against. Identity is judged from the typing itself. */}
        <div className="flex items-center gap-2.5 pl-2 group" data-purpose="user-profile" title="Declared user: whose baseline to measure against. The Identity head decides who is really typing.">
          <div className="w-8 h-8 rounded-full bg-slate-700 dark:bg-slate-600 text-white flex items-center justify-center font-medium text-xs shadow-sm ring-2 ring-white/80 dark:ring-slate-800">
            {initials}
          </div>
          <select
            value={live.declaredUser}
            onChange={(e) => live.setDeclaredUser(e.target.value)}
            className="text-xs font-medium bg-transparent text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/60 rounded-lg px-2 py-1 max-w-[180px] focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            {!live.users.length && <option value="">{live.connected ? 'no baselines yet' : 'no backend'}</option>}
            {live.users.map((u) => (
              <option key={u.user} value={u.user}>{u.user} · {u.n_samples} samples</option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
};
