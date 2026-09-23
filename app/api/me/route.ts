// Server-side provisioning handler.
//
// The browser calls this after signing in (and on every mount, to learn who it
// is). It resolves the caller's access token from the request cookies —
// whichever identity provider is live — and forwards it to the Lumora backend
// as a Bearer token. The token is never returned to the browser and never
// logged.
import { NextResponse } from 'next/server';

import { requireAccessToken } from '@/lib/api/backend';
import { fetchLumoraProfile } from '@/lib/api/me';

export async function GET() {
  const token = await requireAccessToken();
  if (!token.ok) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const result = await fetchLumoraProfile(token.accessToken);

  if (!result.ok) {
    // The session stays valid — the caller shows a retry state rather than
    // signing the user out.
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({ profile: result.profile });
}
