import { NextResponse, type NextRequest } from 'next/server';

import { fetchLumoraProfile } from '@/lib/api/me';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * The PUBLIC origin of this request.
 *
 * `request.nextUrl.origin` reports the server's own bind address in a
 * standalone build (`HOSTNAME=0.0.0.0` in the container), so redirecting
 * against it sent the browser to `https://0.0.0.0:3000/…` — a dead end for
 * anyone who clicked the link in their email instead of typing the code.
 * The reverse proxy is the only thing that knows the public name, so we take
 * it from the forwarded headers (Caddy sets both, and it never routes a
 * request whose Host does not match a configured site).
 */
function publicOrigin(request: NextRequest): string {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!host) return request.nextUrl.origin;
  const proto =
    request.headers.get('x-forwarded-proto') ??
    request.nextUrl.protocol.replace(':', '') ??
    'https';
  return `${proto}://${host}`;
}

/**
 * Only ever return to a path on this origin. Rejects absolute URLs,
 * protocol-relative (`//evil.com`) and backslash (`/\evil.com`) forms.
 */
function safeNextPath(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

function redirectWithError(
  origin: string,
  next: string,
  reason: 'cancelled' | 'failed'
) {
  const url = new URL(next, origin);
  // A coarse, non-sensitive reason code — enough for the UI to explain itself.
  url.searchParams.set('auth_error', reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = publicOrigin(request);
  const next = safeNextPath(searchParams.get('next'));

  // The provider reports cancellation/denial as ?error=access_denied.
  const providerError = searchParams.get('error');
  if (providerError) {
    const reason =
      providerError === 'access_denied' ? 'cancelled' : ('failed' as const);
    return redirectWithError(origin, next, reason);
  }

  const code = searchParams.get('code');
  if (!code) {
    return redirectWithError(origin, next, 'failed');
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return redirectWithError(origin, next, 'failed');
  }

  // Provision/sync the backend user. A failure here is recoverable: the
  // Supabase session stays active and the home screen retries via /api/me,
  // so we do not sign the user out or block the redirect.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    await fetchLumoraProfile(session.access_token);
  }

  return NextResponse.redirect(new URL(next, origin));
}
