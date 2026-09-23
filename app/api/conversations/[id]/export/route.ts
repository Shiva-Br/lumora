// Same-origin proxy for exporting one conversation as a JSON document.
import { proxyBackend } from '@/lib/api/backend';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackend(`/conversations/${encodeURIComponent(id)}/export`);
}
