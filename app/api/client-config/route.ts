// Same-origin proxy for the deployment's runtime configuration.
//
// GET /api/client-config → limits, latency classes, features, and coverage —
// which taxonomy nodes this backend answers in depth. Everything in it is
// derived from the backend's own enforcement values, so a client that reads it
// never has to hardcode a limit or guess at capability.
import { proxyBackend } from '@/lib/api/backend';

export async function GET() {
  return proxyBackend('/client-config');
}
