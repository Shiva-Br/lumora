// Local sign-in — the one route that turns a username and password into a
// session.
//
// The password is read from the request body, forwarded once to the backend
// over the server-to-server hop, and never stored, logged, or echoed. What
// comes back — the bearer token — is written straight into an httpOnly cookie,
// so the browser receives only the display identity.
import { NextResponse } from 'next/server';

import { IS_LOCAL_AUTH } from '@/lib/auth/mode';
import { writeSessionCookie } from '@/lib/auth/session-cookie';

type BackendSession = {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: { id: string; username: string; display_name: string };
};

export async function POST(request: Request) {
  if (!IS_LOCAL_AUTH) {
    return NextResponse.json(
      { error: 'Local sign-in is disabled.' },
      { status: 404 }
    );
  }

  const baseUrl = process.env.LUMORA_API_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'The Lumora backend is not configured.' },
      { status: 500 }
    );
  }

  let username = '';
  let password = '';
  try {
    const body = (await request.json()) as unknown;
    if (typeof body === 'object' && body !== null) {
      const record = body as Record<string, unknown>;
      username = typeof record.username === 'string' ? record.username : '';
      password = typeof record.password === 'string' ? record.password : '';
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!username.trim() || !password) {
    return NextResponse.json(
      { error: 'Enter your username and password.' },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ username: username.trim(), password }),
      cache: 'no-store',
    });
  } catch {
    // Never echo the caught error — it can quote the request, password included.
    return NextResponse.json(
      { error: 'Could not reach Lumora. Check your connection and try again.' },
      { status: 503 }
    );
  }

  const envelope = (await upstream.json().catch(() => null)) as {
    data?: BackendSession;
    error?: string;
  } | null;

  if (!upstream.ok || !envelope?.data?.access_token) {
    return NextResponse.json(
      { error: envelope?.error ?? 'Incorrect username or password.' },
      { status: upstream.status === 200 ? 502 : upstream.status }
    );
  }

  const session = envelope.data;
  const expiresAt = new Date(session.expires_at);
  await writeSessionCookie(
    session.access_token,
    Number.isNaN(expiresAt.getTime())
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : expiresAt
  );

  // The token stays server-side; the client gets only what it displays.
  return NextResponse.json({ user: session.user });
}
