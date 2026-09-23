// Signing out is deleting the cookie. There is no server-side session to
// revoke: the token is self-contained and expires on its own, and the panic
// button for a leaked password is rotating LOCAL_AUTH_JWT_SECRET on the
// backend, which invalidates every token at once.
import { NextResponse } from 'next/server';

import { clearSessionCookie } from '@/lib/auth/session-cookie';

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
