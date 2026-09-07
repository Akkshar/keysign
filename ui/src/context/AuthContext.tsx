import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useBiometrics } from './BiometricsContext';
import {
  clearActiveAccount, fetchAccountLink, fetchActiveAccount, linkAccount, openSignInInBrowser, setActiveAccount,
  unlinkAccount, type AccountLink,
} from '../lib/accounts';
import {
  authConfigured, authErrorText, completeRedirect, inAppWindow, signInEmail, signInGoogle,
  signOut as fbSignOut, signUpEmail, watchAuth, type Account,
} from '../lib/firebase';

/**
 * Sign-in state. An account is a person; the account's linked typing profile
 * is the declared user whose baseline the typing is scored against. Signing
 * in therefore selects the baseline; operator mode keeps the old dropdown.
 */
export type AuthStatus = 'unconfigured' | 'loading' | 'signed-out' | 'signed-in' | 'operator';

interface AuthContextType {
  status: AuthStatus;
  account: Account | null;
  link: AccountLink | null;          // linked typing profile for the signed-in account
  error: string | null;
  busy: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** True in the desktop app window: Google sign-in has to happen in the browser. */
  googleNeedsBrowser: boolean;
  /** Open a browser to sign in with Google, then adopt whoever signed in there. */
  signInViaBrowser: (which?: 'default' | 'chrome') => Promise<void>;
  waitingForBrowser: boolean;
  /** Where the sign-in page was opened, so it can be opened elsewhere by hand. */
  browserSignInUrl: string | null;
  chromeAvailable: boolean;
  cancelBrowserWait: () => void;
  signOut: () => Promise<void>;
  continueAsOperator: () => void;
  linkProfile: (user: string) => Promise<void>;
  unlinkProfile: () => Promise<void>;
}

const OPERATOR_KEY = 'keysign.ui.operator';
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { live } = useBiometrics();
  const [status, setStatus] = useState<AuthStatus>(authConfigured ? 'loading' : 'unconfigured');
  const [account, setAccount] = useState<Account | null>(null);
  const [link, setLink] = useState<AccountLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [appWindow, setAppWindow] = useState<boolean>(inAppWindow());
  const [waitingForBrowser, setWaitingForBrowser] = useState(false);
  const [browserSignInUrl, setBrowserSignInUrl] = useState<string | null>(null);
  const lastBrowser = useRef<'default' | 'chrome'>('default');
  const [chromeAvailable, setChromeAvailable] = useState(false);
  const waitRef = useRef(false);
  const setDeclared = useRef(live.setDeclaredUser);
  useEffect(() => { setDeclared.current = live.setDeclaredUser; }, [live.setDeclaredUser]);

  // pywebview injects window.pywebview after the first paint, so a window that looked like a
  // browser a moment ago may not be one. Watch for it rather than deciding once.
  useEffect(() => {
    if (appWindow) return;
    const check = () => { if (inAppWindow()) setAppWindow(true); };
    const id = setInterval(check, 250);
    window.addEventListener('pywebviewready', check);
    const stop = setTimeout(() => clearInterval(id), 10_000);
    return () => { clearInterval(id); clearTimeout(stop); window.removeEventListener('pywebviewready', check); };
  }, [appWindow]);

  /** Take an account (from Firebase here, or from a browser sign-in) and find its profile. */
  const adopt = useCallback(async (a: Account, remember: boolean) => {
    setAccount(a);
    setStatus('signed-in');
    if (remember) void setActiveAccount(a.email, a.name);       // so the app window can see this sign-in
    try {
      const l = await fetchAccountLink(a.email);
      setLink(l);
      if (l.user) setDeclared.current(l.user);
    } catch {
      setLink({ email: a.email, user: null, has_baseline: false });
    }
  }, []);

  // Firebase tells us who is signed in; the local backend tells us whose baseline that is.
  useEffect(() => {
    if (!authConfigured) return;
    // A session left half-way through an old redirect sign-in reports why, instead of
    // dropping the person back on the gate with nothing said.
    completeRedirect().catch((e) => setError(authErrorText(e)));
    return watchAuth(async (a) => {
      if (!a) {
        // In the app window Google sign-in happens in the browser, so there is no Firebase
        // user here: fall back to whoever the browser last signed in as on this machine.
        if (inAppWindow()) {                                  // read live: this runs before the poll above
          const active = await fetchActiveAccount();
          if (active?.email) {
            setAccount({ uid: '', email: active.email, name: active.name || null, photo: null, provider: 'other' });
            setLink(active);
            setStatus('signed-in');
            if (active.user) setDeclared.current(active.user);
            return;
          }
        }
        setAccount(null);
        setLink(null);
        setStatus(sessionStorage.getItem(OPERATOR_KEY) === '1' ? 'operator' : 'signed-out');
        return;
      }
      await adopt(a, true);
    });
  }, [adopt]);

  // If the backend came up after sign-in, fetch the link once it is reachable.
  useEffect(() => {
    if (account && live.connected && link && link.user === null) {
      fetchAccountLink(account.email).then((l) => { setLink(l); if (l.user) setDeclared.current(l.user); }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.connected]);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(authErrorText(e)); } finally { setBusy(false); }
  }, []);

  const signIn = useCallback((email: string, password: string) => run(() => signInEmail(email.trim(), password)), [run]);
  const signUp = useCallback((email: string, password: string) => run(() => signUpEmail(email.trim(), password)), [run]);
  const signInWithGoogle = useCallback(() => run(() => signInGoogle()), [run]);

  /**
   * The app window's Google button: open this dashboard in the browser, where the
   * Google pop-up works, and wait for it to tell the local backend who signed in.
   */
  const signInViaBrowser = useCallback(async (which: 'default' | 'chrome' | 'remembered' = 'remembered') => {
    setError(null);
    const r = await openSignInInBrowser(which);
    if (r.url) setBrowserSignInUrl(r.url);
    if (r.chrome_available) setChromeAvailable(true);
    if (!r.ok) {
      setError('Could not open a browser. Open ' + (r.url || 'the dashboard') + ' yourself and sign in there.');
      return;
    }
    setWaitingForBrowser(true);
    waitRef.current = true;
    lastBrowser.current = (r.browser === 'chrome' ? 'chrome' : 'default');
    const deadline = Date.now() + 5 * 60 * 1000;
    while (waitRef.current && Date.now() < deadline) {
      await new Promise((res) => setTimeout(res, 1500));
      const active = await fetchActiveAccount();
      if (active?.email && waitRef.current) {
        void setActiveAccount(active.email, active.name, lastBrowser.current);   // this browser worked
        setWaitingForBrowser(false);
        waitRef.current = false;
        setAccount({ uid: '', email: active.email, name: active.name || null, photo: null, provider: 'other' });
        setLink(active);
        setStatus('signed-in');
        if (active.user) setDeclared.current(active.user);
        return;
      }
    }
    if (waitRef.current) {
      waitRef.current = false;
      setWaitingForBrowser(false);
      setError('No sign-in came back from the browser. Try again, or use your email and password here.');
    }
  }, []);

  const cancelBrowserWait = useCallback(() => { waitRef.current = false; setWaitingForBrowser(false); }, []);

  const signOut = useCallback(async () => {
    sessionStorage.removeItem(OPERATOR_KEY);
    waitRef.current = false;
    setWaitingForBrowser(false);
    await clearActiveAccount();                        // this machine has nobody signed in now
    await run(() => fbSignOut());
    setAccount(null);
    setLink(null);
    setStatus('signed-out');
  }, [run]);
  const continueAsOperator = useCallback(() => {
    sessionStorage.setItem(OPERATOR_KEY, '1');
    setStatus('operator');
  }, []);
  const linkProfile = useCallback(async (user: string) => {
    if (!account) return;
    await run(async () => {
      const l = await linkAccount(account.email, user);
      setLink(l);
      setDeclared.current(user);
    });
  }, [account, run]);
  const unlinkProfile = useCallback(async () => {
    if (!account) return;
    await run(async () => { await unlinkAccount(account.email); setLink({ email: account.email, user: null, has_baseline: false }); });
  }, [account, run]);

  const value = useMemo<AuthContextType>(() => ({
    status, account, link, error, busy, signIn, signUp, signInWithGoogle,
    googleNeedsBrowser: appWindow, signInViaBrowser, waitingForBrowser, browserSignInUrl, chromeAvailable,
    cancelBrowserWait, signOut, continueAsOperator, linkProfile, unlinkProfile,
  }), [status, account, link, error, busy, signIn, signUp, signInWithGoogle, signInViaBrowser, waitingForBrowser,
       browserSignInUrl, chromeAvailable, cancelBrowserWait, appWindow, signOut, continueAsOperator, linkProfile,
       unlinkProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
