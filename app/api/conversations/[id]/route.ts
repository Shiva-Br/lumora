// Same-origin proxy for a single conversation.
//
// GET    /api/conversations/:id → the conversation with its full ordered
//        message history (structured stages persisted as typed payloads).
// DELETE /api/conversations/:id → soft-deletes the conversation and its
//        messages (backend-enforced ownership; 404 covers foreign/missing).
// PATCH  /api/conversations/:id → renames the conversation (user title).
import { proxyBackend } from '@/lib/api/backend';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackend(`/conversations/${encodeURIComponent(id)}`);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackend(`/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.text();
  return proxyBackend(`/conversations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  });
}
