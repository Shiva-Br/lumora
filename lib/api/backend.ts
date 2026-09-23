// Server-side proxy to the Lumora backend's conversation endpoints.
//
// SERVER ONLY — same rules as `lib/api/me.ts`: `LUMORA_API_URL` is not a
// NEXT_PUBLIC_* variable, and the access token is read from the request cookies
// here and attached as a Bearer header. Neither ever reaches the browser, which
// talks only to the same-origin `/api` Route Handlers.
//
// Responses are passed through verbatim (status + body), so the client sees
// exactly the envelope / SSE frames documented in frontend-integration.md.
import { IS_LOCAL_AUTH } from '@/lib/auth/mode';
import { readSessionToken } from '@/lib/auth/session-cookie';

type TokenResult =
  { ok: true; accessToken: string } | { ok: false; response: Response };

function envelopeError(status: number, error: string): Response {
  return Response.json({ success: false, error }, { status });
}

/**
 * Resolve the caller's access token, or a ready 401 response.
 *
 * Both modes end in the same place — a bearer token the backend validates —
 * which is why this is the ONLY function that knows which mode is live.
 */
export async function requireAccessToken(): Promise<TokenResult> {
  if (IS_LOCAL_AUTH) {
    // The cookie is httpOnly and set only by our own login route, so its mere
    // presence is the authentication; the backend still validates the
    // signature and expiry on every call.
    const token = await readSessionToken();
    if (!token) {
      return { ok: false, response: envelopeError(401, 'Not authenticated.') };
    }
    return { ok: true, accessToken: token };
  }

  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();

  // getUser() revalidates against the Auth server — unlike a bare
  // getSession(), it cannot be spoofed by a forged cookie.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, response: envelopeError(401, 'Not authenticated.') };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    return { ok: false, response: envelopeError(401, 'Not authenticated.') };
  }

  return { ok: true, accessToken };
}

/**
 * Forward a request to `${LUMORA_API_URL}/api${path}` and stream the backend
 * response straight through. Works for both JSON envelopes and SSE — the
 * body is piped, never buffered, so `delta` frames arrive as they are sent.
 */
export async function proxyBackend(
  path: string,
  init: { method?: string; body?: string } = {}
): Promise<Response> {
  const token = await requireAccessToken();
  if (!token.ok) return token.response;

  const baseUrl = process.env.LUMORA_API_URL;
  if (!baseUrl) {
    return envelopeError(500, 'The Lumora backend is not configured.');
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl.replace(/\/+$/, '')}/api${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        ...(init.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
        Accept: 'application/json, text/event-stream',
      },
      body: init.body,
      cache: 'no-store',
    });
  } catch {
    // Never include the caught error: it can echo back the request headers.
    return envelopeError(503, 'Could not reach the Lumora backend.');
  }

  const headers = new Headers();
  const contentType = upstream.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  const conversationId = upstream.headers.get('X-Conversation-Id');
  if (conversationId) headers.set('X-Conversation-Id', conversationId);
  const disposition = upstream.headers.get('Content-Disposition');
  if (disposition) headers.set('Content-Disposition', disposition);
  headers.set('Cache-Control', 'no-store');

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

export async function readJsonBody(
  request: Request
): Promise<{ ok: true; body: string } | { ok: false; response: Response }> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return { ok: false, response: envelopeError(400, 'Invalid JSON body.') };
  }
  return { ok: true, body: JSON.stringify(parsed) };
}
