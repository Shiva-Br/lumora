// Same-origin proxy for the caller's spend quota.
//
// GET /api/quota → { day, month, state } — advisory for the composer banner;
// the backend remains the enforcer (429 on refused sends).
import { proxyBackend } from '@/lib/api/backend';

export async function GET() {
  return proxyBackend('/quota');
}
