// The local session cookie — SERVER ONLY.
//
// The backend's bearer token lives here and nowhere else. It is httpOnly, so
// unlike the Supabase cookie it is invisible to JavaScript: an XSS bug cannot
// read it, and the browser never sees a token at all. Every backend call goes
// through the same-origin /api/** route handlers, which read this cookie
// server-side and attach the Authorization header.
import { cookies } from 'next/headers';

/** Cookie name. Distinct from Supabase's `sb-*` cookies so the two can coexist. */
export const SESSION_COOKIE = 'lumora_session';

/** Reads the bearer token from the request cookies, or null when signed out. */
export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  return value && value.length > 0 ? value : null;
}

/**
 * Stores the token. `expiresAt` comes from the backend, so the cookie and the
 * token expire together — a cookie outliving its token would show a signed-in
 * shell that 401s on every request.
 */
export async function writeSessionCookie(
  token: string,
  expiresAt: Date
): Promise<void> {
  const store = await cookies();
  const maxAge = Math.max(
    0,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000)
  );
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Lax still sends the cookie on top-level navigation, which is what a
    // sign-in redirect needs, while blocking cross-site POSTs.
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
}

/** Clears the cookie — the whole of signing out. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
