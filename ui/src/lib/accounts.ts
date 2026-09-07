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
