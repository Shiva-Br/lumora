// Client-side adapter for the quota report (v0.8.0).
//
// Advisory only: the banner warns before the user types, but the backend is
// the enforcer — a failed fetch degrades to "no banner", never to a block.
import type { QuotaStatus } from './types';

export async function getQuota(): Promise<QuotaStatus | null> {
  try {
    const res = await fetch('/api/quota', { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      success?: boolean;
      data?: QuotaStatus;
    };
    return body.data ?? null;
  } catch {
    return null;
  }
}
