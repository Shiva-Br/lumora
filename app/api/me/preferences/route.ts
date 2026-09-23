// Same-origin proxy for the caller's account-scoped UI preferences.
//
// GET   /api/me/preferences → Preferences
// PATCH /api/me/preferences → Preferences (partial; returns the full result)
//
// These are ACCOUNT settings and follow the person across devices, which is the
// whole reason they are not localStorage. The body is forwarded verbatim so the
// backend's three-state handling of `reducedMotionOverride` survives the hop:
// omitting the key means "leave it alone", sending null means "follow the OS",
// and re-serialising the body here would collapse the two.
import { proxyBackend } from '@/lib/api/backend';

export async function GET() {
  return proxyBackend('/me/preferences');
}

export async function PATCH(request: Request) {
  const body = await request.text();
  return proxyBackend('/me/preferences', { method: 'PATCH', body });
}
