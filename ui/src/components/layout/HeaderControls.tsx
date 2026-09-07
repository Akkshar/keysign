import React from 'react';
import { motion } from 'framer-motion';
import { useBiometrics } from '../../context/BiometricsContext';
import { useTheme } from '../../context/ThemeContext';
import { RhythmStrip } from '../common/RhythmStrip';
import { useAuth } from '../../context/AuthContext';

/**
 * The live controls: the rhythm strip, the backend pill, Reset, the theme toggle and whoever
 * the machine is measuring against. Shared by the sidebar header and the top navigation, so
 * there is one copy of the things that have to stay right.
 */
export const HeaderControls: React.FC = () => {
  const { isTyping, live, setActiveArea } = useBiometrics();
  const { theme, toggleTheme } = useTheme();
  const auth = useAuth();
  const initials = (live.declaredUser || '?').split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();

  return (
      <div className="flex items-center gap-4 lg:gap-6">
        {/* The signature: your last keystrokes as a rhythm strip. Beats while you type. */}
        <div className="hidden 2xl:flex items-center gap-3 pr-2 mr-2 border-r border-stone-200/70 dark:border-stone-700/60">
          <RhythmStrip />
          <span className={`hidden lg:inline whitespace-nowrap text-[11px] font-medium transition-colors ${isTyping ? 'text-amber-600 dark:text-amber-300' : 'text-stone-400 dark:text-stone-500'}`}>
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
            className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-white/70 dark:bg-stone-800/80 border border-stone-200/70 dark:border-stone-700/60 text-stone-600 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-800 transition-colors"
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
          className="w-8 h-8 rounded-full bg-white/70 dark:bg-stone-800/80 hover:bg-white dark:hover:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300 shadow-sm border border-stone-200/70 dark:border-stone-700/60 transition-colors"
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

        {/* Signed-in account: its linked typing profile is the declared user. Click for Settings. */}
        {auth.status === 'signed-in' && auth.account ? (
          <button
            type="button"
            onClick={() => setActiveArea('settings')}
            className="flex items-center gap-2.5 pl-2 text-left group"
            data-purpose="user-profile"
            title={`${auth.account.email} · measured against ${live.declaredUser || 'no profile yet'}`}
          >
            {auth.account.photo ? (
              <img src={auth.account.photo} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover shadow-sm ring-2 ring-white/80 dark:ring-stone-800" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-stone-700 dark:bg-stone-600 text-white flex items-center justify-center font-medium text-xs shadow-sm ring-2 ring-white/80 dark:ring-stone-800">
                {initials}
              </div>
            )}
            <span className="hidden sm:flex flex-col leading-tight">
              <span className="text-xs font-medium text-stone-700 dark:text-stone-200 group-hover:text-stone-900 dark:group-hover:text-white transition-colors">
                {auth.account.name || auth.account.email}
              </span>
              <span className="text-[10px] text-stone-500 dark:text-stone-400">measured against {live.declaredUser || 'no profile yet'}</span>
            </span>
          </button>
        ) : (
        <div className="flex items-center gap-2.5 pl-2 group" data-purpose="user-profile" title="Declared user: whose baseline to measure against. The Identity head decides who is really typing.">
          <div className="w-8 h-8 rounded-full bg-stone-700 dark:bg-stone-600 text-white flex items-center justify-center font-medium text-xs shadow-sm ring-2 ring-white/80 dark:ring-stone-800">
            {initials}
          </div>
          <select
            value={live.declaredUser}
            onChange={(e) => live.setDeclaredUser(e.target.value)}
            className="text-xs font-medium bg-transparent text-stone-700 dark:text-stone-300 border border-stone-200/70 dark:border-stone-700/60 rounded-lg px-2 py-1 max-w-[180px] focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          >
            {!live.users.length && <option value="">{live.connected ? 'no baselines yet' : 'no backend'}</option>}
            {live.users.map((u) => (
              <option key={u.user} value={u.user}>{u.user} · {u.n_samples} samples</option>
            ))}
          </select>
        </div>
        )}
      </div>
  );
};
