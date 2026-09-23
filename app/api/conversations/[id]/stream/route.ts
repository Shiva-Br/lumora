// Same-origin proxy for reattaching to a running generation.
//
// GET /api/conversations/:id/stream?after=<ordinal> → SSE replay + live tail.
// 404 means nothing is attachable (turn over, replay window lapsed) — the
// client falls back to history, which always holds the persisted outcome.
import { proxyBackend } from '@/lib/api/backend';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const after = new URL(request.url).searchParams.get('after');
  const query = after ? `?after=${encodeURIComponent(after)}` : '';
  return proxyBackend(
    `/conversations/${encodeURIComponent(id)}/stream${query}`
  );
}
