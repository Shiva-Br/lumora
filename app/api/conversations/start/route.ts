// Same-origin proxy for the one-shot create + first message endpoint.
//
// POST /api/conversations/start → SSE stream (text/event-stream). The new
// conversation id arrives on the `X-Conversation-Id` header and as a leading
// `conversation` event; both are passed through untouched.
import { proxyBackend, readJsonBody } from '@/lib/api/backend';

export async function POST(request: Request) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  return proxyBackend('/conversations/start', {
    method: 'POST',
    body: parsed.body,
  });
}
