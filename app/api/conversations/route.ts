// Same-origin proxy for the conversation collection.
//
// GET  /api/conversations  → list (most recently updated first, no messages)
// POST /api/conversations  → create; the 201 already contains the assistant
//                            greeting as messages[0]. (The UI currently opens
//                            threads via /start — this backs the documented
//                            "assistant speaks first" flow.)
import { proxyBackend, readJsonBody } from '@/lib/api/backend';

export async function GET() {
  return proxyBackend('/conversations');
}

export async function POST(request: Request) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  return proxyBackend('/conversations', { method: 'POST', body: parsed.body });
}
