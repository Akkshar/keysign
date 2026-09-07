/**
 * Firebase Auth, sign-in only. Email/password and Google.
 *
 * Configured through Vite env vars (ui/.env, see ui/.env.example). Without
 * them `authConfigured` is false and the dashboard runs exactly as before:
 * no sign-in screen, the declared user is a dropdown.
 *
 * What leaves the machine when this is on: the email and password (or the
 * Google OAuth exchange) go to Firebase/Google. Keystrokes, baselines and
 * alerts do not; they stay with the local backend. See the Privacy page.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type Auth,
  type User,
} from 'firebase/auth';

const env = (import.meta as any).env || {};
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const authConfigured = Boolean(config.apiKey && config.authDomain && config.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
if (authConfigured) {
  app = initializeApp(config as Required<typeof config>);
  auth = getAuth(app);
  void setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export interface Account {
  uid: string;
  email: string;
  name: string | null;
  photo: string | null;
  provider: 'google' | 'password' | 'other';
}

const toAccount = (u: User): Account => ({
  uid: u.uid,
  email: u.email || '',
  name: u.displayName,
  photo: u.photoURL,
  provider: u.providerData.some((p) => p.providerId === 'google.com') ? 'google' : u.providerData.some((p) => p.providerId === 'password') ? 'password' : 'other',
});

/** Subscribe to sign-in state. Returns an unsubscribe. No-op when unconfigured. */
export function watchAuth(cb: (a: Account | null) => void): () => void {
  if (!auth) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, (u) => cb(u ? toAccount(u) : null));
}

export async function signInEmail(email: string, password: string): Promise<Account> {
  if (!auth) throw new Error('Sign-in is not configured');
  return toAccount((await signInWithEmailAndPassword(auth, email, password)).user);
}

export async function signUpEmail(email: string, password: string): Promise<Account> {
  if (!auth) throw new Error('Sign-in is not configured');
  return toAccount((await createUserWithEmailAndPassword(auth, email, password)).user);
}

/** True inside the desktop app window (pywebview injects window.pywebview). */
export const inAppWindow = () => typeof window !== 'undefined' && Boolean((window as any).pywebview);

export async function signInGoogle(): Promise<Account | null> {
  if (!auth) throw new Error('Sign-in is not configured');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (inAppWindow()) {
    await signInWithRedirect(auth, provider);      // comes back through onAuthStateChanged after the redirect
    return null;
  }
  return toAccount((await signInWithPopup(auth, provider)).user);
}

export async function signOut(): Promise<void> {
  if (auth) await fbSignOut(auth);
}

/** Firebase error codes -> one plain sentence. */
export function authErrorText(e: unknown): string {
  const code = (e as any)?.code || '';
  const table: Record<string, string> = {
    'auth/invalid-email': 'That email address does not look right.',
    'auth/user-not-found': 'No account with that email. Create one below.',
    'auth/wrong-password': 'Wrong password.',
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/email-already-in-use': 'An account with that email already exists. Sign in instead.',
    'auth/weak-password': 'Use at least 6 characters for the password.',
    'auth/popup-closed-by-user': 'The Google window was closed before finishing.',
    'auth/popup-blocked': 'The browser blocked the Google sign-in window. Allow pop-ups for this page.',
    'auth/network-request-failed': 'No connection to Firebase. Sign-in needs internet; the rest of KeySign does not.',
    'auth/operation-not-allowed': 'That sign-in method is switched off in the Firebase console.',
    'auth/unauthorized-domain': 'This address is not on the Firebase authorised domains list (add localhost).',
  };
  if (String(code).startsWith('auth/api-key-not-valid') || code === 'auth/invalid-api-key') {
    return 'The Firebase config in ui/.env is not valid. Copy it again from the Firebase console.';
  }
  return table[code] || (e as any)?.message || 'Sign-in failed.';
}
