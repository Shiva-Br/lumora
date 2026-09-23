// Same-origin proxy for exporting every conversation of the calling user.
import { proxyBackend } from '@/lib/api/backend';

export async function GET() {
  return proxyBackend('/export');
}
