// Same-origin proxy for regenerating the conversation's last reply.
//
// POST /api/conversations/:id/regenerate → SSE stream (standard turn
// contract). The superseded reply drops out of history once the new one
// lands; the client reloads history on `done`.
import { proxyBackend, readJsonBody } from '@/lib/api/backend';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // The body ({ idempotency_token? }) is optional but forwarded when present.
  const parsed = await readJsonBody(request);
  return proxyBackend(`/conversations/${encodeURIComponent(id)}/regenerate`, {
    method: 'POST',
    body: parsed.ok ? parsed.body : undefined,
  });
}
