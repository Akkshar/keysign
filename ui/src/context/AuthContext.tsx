import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useBiometrics } from './BiometricsContext';
import { fetchAccountLink, linkAccount, unlinkAccount, type AccountLink } from '../lib/accounts';
import { authConfigured, authErrorText, signInEmail, signInGoogle, signOut as fbSignOut, signUpEmail, watchAuth, type Account } from '../lib/firebase';

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
  const setDeclared = useRef(live.setDeclaredUser);
  useEffect(() => { setDeclared.current = live.setDeclaredUser; }, [live.setDeclaredUser]);

  // Firebase tells us who is signed in; the local backend tells us whose baseline that is.
  useEffect(() => {
    if (!authConfigured) return;
    return watchAuth(async (a) => {
      setAccount(a);
      if (!a) {
        setLink(null);
        setStatus(sessionStorage.getItem(OPERATOR_KEY) === '1' ? 'operator' : 'signed-out');
        return;
      }
      setStatus('signed-in');
      try {
        const l = await fetchAccountLink(a.email);
        setLink(l);
        if (l.user) setDeclared.current(l.user);
      } catch {
        setLink({ email: a.email, user: null, has_baseline: false });
      }
    });
  }, []);

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
  const signOut = useCallback(async () => {
    sessionStorage.removeItem(OPERATOR_KEY);
    await run(() => fbSignOut());
    setLink(null);
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
    status, account, link, error, busy, signIn, signUp, signInWithGoogle, signOut, continueAsOperator, linkProfile, unlinkProfile,
  }), [status, account, link, error, busy, signIn, signUp, signInWithGoogle, signOut, continueAsOperator, linkProfile, unlinkProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
