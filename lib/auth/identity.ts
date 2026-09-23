// Derives what the sidebar shows from the signed-in identity + backend profile.

import type { Account } from '@/lib/chat';

import type { AuthIdentity, LumoraProfile } from './types';

export const GUEST_ACCOUNT: Account = {
  email: 'Guest',
  name: 'Guest',
  initial: 'G',
};

/**
 * First letter of the email, or of the name when the email is unhelpful (an
 * Apple private-relay address starts with a random string, so we prefer the
 * name when we have one). Falls back to '?' rather than rendering an empty
 * circle for e.g. an all-symbol address.
 */
function initialFrom(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || '';
  const letter = source.match(/[a-z0-9]/i)?.[0];
  return letter ? letter.toUpperCase() : '?';
}

export function accountFrom(
  identity: AuthIdentity | null,
  profile: LumoraProfile | null
): Account | null {
  if (!identity) return null;

  // The backend profile is authoritative once provisioned; before that (or if
  // provisioning is still retrying) fall back to the identity's own claims.
  const email = profile?.email ?? identity.email ?? null;
  const firstName = profile?.first_name ?? identity.displayName ?? null;

  // The local pilot's accounts have a display name and no email at all, so the
  // name doubles as the label rather than leaving a bare "Signed in".
  return {
    email: email ?? firstName?.trim() ?? 'Signed in',
    name: firstName?.trim() || null,
    initial: initialFrom(firstName, email),
  };
}
