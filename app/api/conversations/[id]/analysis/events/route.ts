// Same-origin proxy for the analysis job's progress stream.
//
// GET /api/conversations/:id/analysis/events → SSE `progress` events. Every
// event so far is replayed on connect, so a client that attaches late — or
// reattaches after a reload — never misses the tracker.
import { proxyBackend } from '@/lib/api/backend';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackend(
    `/conversations/${encodeURIComponent(id)}/analysis/events`
  );
}
