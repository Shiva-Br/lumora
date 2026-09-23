// Server-side adapter for the Lumora backend's identity endpoint.
//
// SERVER ONLY. `LUMORA_API_URL` is not a NEXT_PUBLIC_* variable, so importing
// this from a Client Component would resolve it to undefined. The browser
// reaches the backend through the /api/me Route Handler instead, which keeps
// backend configuration — and the access token — off the client entirely.
import type { LumoraProfile } from '@/lib/auth/types';

type Envelope = {
  success?: boolean;
  data?: LumoraProfile;
  error?: string;
};

export type BackendResult =
  | { ok: true; profile: LumoraProfile }
  | { ok: false; status: number; error: string };

/**
 * `GET /api/me` — provisions the user on first call and syncs them afterwards.
 * Idempotent, so it is safe to call on every login.
 *
 * The token is passed as a Bearer header and is never logged or returned.
 */
export async function fetchLumoraProfile(
  accessToken: string
): Promise<BackendResult> {
  const baseUrl = process.env.LUMORA_API_URL;
  if (!baseUrl) {
    return {
      ok: false,
      status: 500,
      error: 'The Lumora backend is not configured.',
    };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
  } catch {
    // Never include the caught error: it can echo back the request headers.
    return {
      ok: false,
      status: 503,
      error: 'Could not reach the Lumora backend.',
    };
  }

  let body: Envelope | null = null;
  try {
    body = (await response.json()) as Envelope;
  } catch {
    body = null;
  }

  if (!response.ok || !body?.success || !body.data) {
    return {
      ok: false,
      status: response.ok ? 502 : response.status,
      error: body?.error ?? 'The Lumora backend rejected the request.',
    };
  }

  return { ok: true, profile: body.data };
}
