/**
 * Local account links: which enrolled typing profile (baseline) a signed-in
 * email belongs to. Kept by the local backend in data/accounts.json; nothing
 * about it is sent to Firebase.
 */
import { BACKEND_HTTP } from './keysign';

export interface AccountLink {
  email: string;
  user: string | null;        // baseline name, or null when not linked yet
  has_baseline: boolean;
  linked_at?: string;
}

export async function fetchAccountLink(email: string): Promise<AccountLink> {
  const r = await fetch(`${BACKEND_HTTP}/api/accounts/${encodeURIComponent(email)}`);
  if (!r.ok) return { email, user: null, has_baseline: false };
  return r.json();
}

export async function linkAccount(email: string, user: string): Promise<AccountLink> {
  const r = await fetch(`${BACKEND_HTTP}/api/accounts/${encodeURIComponent(email)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'Could not link the profile');
  return r.json();
}

export async function unlinkAccount(email: string): Promise<void> {
  await fetch(`${BACKEND_HTTP}/api/accounts/${encodeURIComponent(email)}`, { method: 'DELETE' });
}

/**
 * The sign-in hand-off for the desktop app window, which cannot run Google's
 * sign-in itself (pop-ups go to the system browser and Firebase's redirect
 * flow does not survive Chromium's storage partitioning). The browser signs in
 * and records who that is with the local backend; the window reads it back.
 */
export interface ActiveAccount extends AccountLink { name?: string | null; at?: string }

export async function fetchActiveAccount(): Promise<ActiveAccount | null> {
  try {
    const r = await fetch(`${BACKEND_HTTP}/api/active-account`);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.email ? d : null;
  } catch { return null; }
}

export async function setActiveAccount(email: string, name?: string | null,
                                      browser?: 'default' | 'chrome'): Promise<void> {
  try {
    await fetch(`${BACKEND_HTTP}/api/active-account`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, browser }),
    });
  } catch { /* the window just will not see this sign-in */ }
}

export async function clearActiveAccount(): Promise<void> {
  try { await fetch(`${BACKEND_HTTP}/api/active-account`, { method: 'DELETE' }); } catch { /* ignore */ }
}

/**
 * Ask the backend to open this dashboard's sign-in page in a browser. `which` is "default"
 * or "chrome": the machine's default browser is not always the one the person uses Google
 * in, and signing in needs that browser's Google session.
 */
export async function openSignInInBrowser(which: 'default' | 'chrome' | 'remembered' = 'remembered'):
  Promise<{ ok: boolean; url?: string; browser?: string; chrome_available?: boolean; error?: string }> {
  try {
    const r = await fetch(`${BACKEND_HTTP}/api/signin/browser?browser=${which}`, { method: 'POST' });
    return r.json();
  } catch (e) { return { ok: false, error: String(e) }; }
}
