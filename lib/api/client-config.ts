// Client-side adapter for the deployment's runtime configuration.
import { EMPTY_COVERAGE, type Coverage } from '@/lib/taxonomy/coverage';

export interface ClientConfig {
  contract: string;
  coverage: Coverage;
}

/**
 * Read the deployment config.
 *
 * Degrades to "nothing marked, general answers everywhere" rather than
 * throwing: an unreachable config must not stop the atlas rendering, and the
 * fallback understates coverage instead of overstating it — the safe direction
 * for a claim about how much the product knows.
 */
export async function getClientConfig(): Promise<ClientConfig> {
  try {
    const res = await fetch('/api/client-config', { cache: 'no-store' });
    if (!res.ok) return { contract: '', coverage: EMPTY_COVERAGE };
    const body = (await res.json()) as { data?: Partial<ClientConfig> };
    return {
      contract: body.data?.contract ?? '',
      coverage: body.data?.coverage ?? EMPTY_COVERAGE,
    };
  } catch {
    return { contract: '', coverage: EMPTY_COVERAGE };
  }
}
