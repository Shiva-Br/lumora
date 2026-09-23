// Same-origin proxy for stopping the running generation.
//
// POST /api/conversations/:id/stream/stop → { state } (idempotent, race-safe;
// the stream itself delivers the `stopped` terminal).
import { proxyBackend } from '@/lib/api/backend';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackend(`/conversations/${encodeURIComponent(id)}/stream/stop`, {
    method: 'POST',
  });
}
