// Same-origin proxy for sending a message into a conversation.
//
// POST /api/conversations/:id/messages → SSE stream (text/event-stream).
// The body is `{ content, selected_products? }`; the stream is piped through
// unbuffered so `delta` frames render as they arrive.
import { proxyBackend, readJsonBody } from '@/lib/api/backend';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  return proxyBackend(`/conversations/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    body: parsed.body,
  });
}
