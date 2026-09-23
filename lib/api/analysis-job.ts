// The detached analysis job — the path that finishes.
//
// A turn is bounded by the backend's CHATBOT_TURN_DEADLINE. By the time
// `selectAndRecommend` is reached, the window left for the evidence stages
// (marketplace + research) is under both stages' viability floors, so research
// never starts and marketplace is killed mid-search. With no verified offer and
// no buyer experience in hand the REC-NON gate withholds the ranking — honestly,
// and by design — which is why no `recommendation` or `analysis` payload was
// ever produced on that path, and the workspace had nothing to show.
//
// The job runs the same pipeline on a context with NO deadline. Same code, same
// honesty gates, enough time to satisfy them.

/**
 * The backend's named progress vocabulary. Switch on `type`, not on `stage`:
 * the index is a position in a display ladder and may be renumbered, the type
 * is the contract.
 */
export type ProgressType =
  | 'profile_ready'
  | 'search_started'
  | 'candidates_ready'
  | 'comparison_ready'
  | 'marketplace_ready'
  | 'results_ready'
  | 'no_results'
  | 'failure'
  | 'cancellation';

export interface AnalysisProgress {
  /** Absent on pre-pipeline events (e.g. "waiting for your answers"). */
  type?: ProgressType;
  /** Position in the ten-step display ladder. */
  stage: number;
  label: string;
  pct: number;
  /** Honest counted line, e.g. "214 candidates → 31 finalists". */
  detail?: string;
  result_ready?: boolean;
  error?: string;
  retriable?: boolean;
  /** Real stage figures for the in-thread journey's counted labels. */
  counts?: { scanned?: number; finalists?: number; marketplaces?: number };
}

function unwrap<T>(body: unknown): T | null {
  if (typeof body !== 'object' || body === null) return null;
  const envelope = body as { success?: boolean; data?: T };
  return envelope.success === false ? null : (envelope.data ?? null);
}

/**
 * Start the job. Idempotent per conversation: a live job returns its own id
 * rather than starting a second, so a double click costs nothing.
 */
export async function startAnalysisJob(
  conversationId: string
): Promise<string | null> {
  const res = await fetch(
    `/api/conversations/${encodeURIComponent(conversationId)}/analysis`,
    { method: 'POST', cache: 'no-store' }
  );
  if (!res.ok) return null;
  const data = unwrap<{ job_id?: string }>(await res.json().catch(() => null));
  return data?.job_id ?? null;
}

/** Cancel a running job. Best effort — a failure here is not worth surfacing. */
export async function cancelAnalysisJob(conversationId: string): Promise<void> {
  await fetch(
    `/api/conversations/${encodeURIComponent(conversationId)}/analysis`,
    { method: 'DELETE', cache: 'no-store' }
  ).catch(() => null);
}

/**
 * Subscribe to the job's progress.
 *
 * Every event so far is replayed on connect, so attaching late — or reattaching
 * after a reload — still shows the whole tracker. Resolves when the stream ends;
 * the caller decides what a terminal event means.
 */
export async function streamAnalysisProgress(
  conversationId: string,
  onProgress: (event: AnalysisProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(
    `/api/conversations/${encodeURIComponent(conversationId)}/analysis/events`,
    { headers: { Accept: 'text/event-stream' }, cache: 'no-store', signal }
  );
  if (!res.ok || !res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line; a frame may carry several
      // `data:` lines, which the spec joins with newlines.
      let split = buffer.indexOf('\n\n');
      while (split !== -1) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const payload = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n');
        if (payload) {
          try {
            onProgress(JSON.parse(payload) as AnalysisProgress);
          } catch {
            // A malformed frame is skipped, never fatal: the next event
            // carries the same state (the stream is a tracker, not a ledger).
          }
        }
        split = buffer.indexOf('\n\n');
      }
    }
  } catch {
    // Aborted or dropped. The job keeps running server-side — disconnect is
    // not cancellation — and the caller reattaches or falls back to history.
  } finally {
    reader.cancel().catch(() => null);
  }
}
