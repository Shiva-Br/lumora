// Client-side adapter for account preferences.
//
// The backend is the store; this module is the only place in the app that knows
// the wire shape. Reads degrade to the documented defaults rather than throwing:
// a settings panel that cannot reach the server should still render something
// usable, and the user's next save is what matters.
import { IS_DEMO_AUTH } from '@/lib/auth/mode';

import type { Preferences, PreferencesPatch } from './types';

/** What a user who has never saved anything gets — mirrors the backend. */
export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'dark',
  language: 'en',
  sidebarCollapsed: false,
  reducedMotionOverride: null,
  _v: 1,
};

let demoPreferences: Preferences | null = null;

export async function getPreferences(): Promise<Preferences> {
  if (IS_DEMO_AUTH) return demoPreferences ?? DEFAULT_PREFERENCES;
  try {
    const res = await fetch('/api/me/preferences', { cache: 'no-store' });
    if (!res.ok) return DEFAULT_PREFERENCES;
    const body = (await res.json()) as { data?: Preferences };
    return body.data ?? DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Apply a partial change and return the full resulting preferences.
 *
 * Send ONLY the keys being changed: an omitted key is left as stored, so a
 * caller that spreads the whole object would overwrite settings another tab may
 * have changed. `reducedMotionOverride: null` is a real value meaning "follow
 * the operating system" and is deliberately distinct from omitting it.
 *
 * Returns null when the save failed, so the caller can keep the user's edit on
 * screen and let them retry rather than silently reverting it.
 */
export async function updatePreferences(
  patch: PreferencesPatch
): Promise<Preferences | null> {
  if (IS_DEMO_AUTH) {
    demoPreferences = { ...(demoPreferences ?? DEFAULT_PREFERENCES), ...patch };
    return demoPreferences;
  }
  try {
    const res = await fetch('/api/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: Preferences };
    return body.data ?? null;
  } catch {
    return null;
  }
}
