// Same-origin proxy for the detached analysis job.
//
// POST   /api/conversations/:id/analysis → { job_id }, 202
// DELETE /api/conversations/:id/analysis → cancel a running job
//
// This is the pipeline path that can actually finish. A turn is bounded by
// CHATBOT_TURN_DEADLINE, and the evidence stages (marketplace + research) do
// not fit inside what remains of it — the job carries no deadline, so it runs
// them to completion and commits the recommendation and analysis payloads the
// workspace is built to show.
import { proxyBackend } from '@/lib/api/backend';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackend(`/conversations/${encodeURIComponent(id)}/analysis`, {
    method: 'POST',
    body: '{}',
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackend(`/conversations/${encodeURIComponent(id)}/analysis`, {
    method: 'DELETE',
  });
}
