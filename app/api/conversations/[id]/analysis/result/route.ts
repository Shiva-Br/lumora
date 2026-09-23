// Same-origin proxy for the finished analysis job's result.
import { proxyBackend } from '@/lib/api/backend';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackend(
    `/conversations/${encodeURIComponent(id)}/analysis/result`
  );
}
