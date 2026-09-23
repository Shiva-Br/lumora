import { provisionProfile } from './provision';

import type {
  DataEventKind,
  DeltaEvent,
  DoneEvent,
  ErrorEvent as StreamErrorEvent,
  StartEvent,
  StatusEvent,
  StoppedEvent,
  TimeoutEvent,
  ToolStatusEvent,
} from './types';

const DATA_EVENTS: ReadonlySet<string> = new Set([
  'requirement',
  'understanding',
  'analysis',
  'candidates',
  'marketplace',
  'research',
  'recommendation',
  'deals',
]);

/** Connection is considered dead after this much total silence (heartbeats
 * arrive ≤ every 15s, so this only fires on a genuinely broken transport). */
const LIVENESS_TIMEOUT_MS = 25_000;
/** Reattach attempts after a mid-turn connection loss before giving up. */
const REATTACH_ATTEMPTS = 3;

export interface StreamHandlers {
  /** New conversation id — only emitted by `POST /conversations/start`. */
  onConversation?: (conversationId: string, title?: string) => void;
  /** First event of every turn: stream ref + expected pace (fast|researching). */
  onStart?: (event: StartEvent) => void;
  onStatus?: (event: StatusEvent) => void;
  /** Coarse in-stage tool activity (advisory shimmer, never an error). */
  onTool?: (event: ToolStatusEvent) => void;
  onDelta?: (text: string) => void;
  onData?: (kind: DataEventKind, payload: unknown) => void;
  onDone?: (event: DoneEvent) => void;
  /** The user stopped the turn; any partial shown is persisted server-side. */
  onStopped?: (event: StoppedEvent) => void;
  /** The turn hit its hard time budget; message is user-safe copy. */
  onTimeout?: (event: TimeoutEvent) => void;
  /** Channel A (HTTP failure) and channel B (mid-stream `error`) both end here. */
  onError?: (message: string) => void;
}

export interface SendMessageBody {
  content: string;
  selected_products?: string[];

  qflow_answers?: import('./types').QFlowAnswer[];
  qflow_edit_from?: string;
  confirm_understanding?: boolean;
}

export interface StartConversationBody extends SendMessageBody {
  title?: string;
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (typeof body.error === 'string' && body.error) return body.error;
  } catch {
    // Not JSON — fall through to the generic message.
  }
  return `The request failed (HTTP ${res.status}).`;
}

/** What one pass over a response body concluded. */
interface ConsumeResult {
  /** A terminal event (done/stopped/timeout/error) was delivered. */
  terminal: boolean;
  /** Highest SSE ordinal processed — the resume token for reattach. */
  lastOrdinal: number;
  /** The stream broke mid-flight (network or liveness) without a terminal. */
  broken: boolean;
}

interface ConsumeContext {
  handlers: StreamHandlers;
  /** Adopted conversation id (updated from the `conversation` event). */
  conversationId: string | null;
  lastOrdinal: number;
}

function dispatchFrame(
  ctx: ConsumeContext,
  name: string,
  data: unknown
): boolean {
  const { handlers } = ctx;
  if (name === 'conversation') {
    const event = data as { conversation_id?: string; title?: string };
    if (event.conversation_id) {
      ctx.conversationId = event.conversation_id;
      handlers.onConversation?.(event.conversation_id, event.title);
    }
  } else if (name === 'start') {
    handlers.onStart?.(data as StartEvent);
  } else if (name === 'status') {
    handlers.onStatus?.(data as StatusEvent);
  } else if (name === 'tool_status') {
    handlers.onTool?.(data as ToolStatusEvent);
  } else if (name === 'delta') {
    handlers.onDelta?.((data as DeltaEvent).content);
  } else if (name === 'done') {
    handlers.onDone?.(data as DoneEvent);
    return true;
  } else if (name === 'stopped') {
    handlers.onStopped?.(data as StoppedEvent);
    return true;
  } else if (name === 'timeout') {
    handlers.onTimeout?.(data as TimeoutEvent);
    return true;
  } else if (name === 'error') {
    handlers.onError?.((data as StreamErrorEvent).error);
    return true;
  } else if (DATA_EVENTS.has(name)) {
    handlers.onData?.(name as DataEventKind, data);
  }
  // Unknown event names are ignored — forward compatibility. `heartbeat`
  // lands here on purpose: its only job was resetting the liveness timer.
  return false;
}

async function consumeStream(
  res: Response,
  ctx: ConsumeContext,
  signal?: AbortSignal
): Promise<ConsumeResult> {
  if (!res.body) {
    ctx.handlers.onError?.('The server sent an empty response.');
    return { terminal: true, lastOrdinal: ctx.lastOrdinal, broken: false };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let terminal = false;

  // Liveness watchdog: any bytes reset it; expiry cancels the read so the
  // caller can reattach. Heartbeats guarantee traffic on a healthy stream.
  let liveness: ReturnType<typeof setTimeout> | null = null;
  const feedWatchdog = () => {
    if (liveness) clearTimeout(liveness);
    // Expiry cancels the read; the stream then ends without a terminal and
    // the caller's broken-stream path reattaches.
    liveness = setTimeout(() => {
      void reader.cancel().catch(() => undefined);
    }, LIVENESS_TIMEOUT_MS);
  };

  try {
    feedWatchdog();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      feedWatchdog();
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);

        let name = 'message';
        let raw = '';
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) name = line.slice(6).trim();
          else if (line.startsWith('data:')) raw += line.slice(5).trim();
          else if (line.startsWith('id:')) {
            const ordinal = Number.parseInt(line.slice(3).trim(), 10);
            if (Number.isFinite(ordinal)) ctx.lastOrdinal = ordinal;
          }
        }
        if (!raw) continue;

        let data: unknown;
        try {
          data = JSON.parse(raw);
        } catch {
          // Never let one bad frame kill the stream.
          continue;
        }
        if (dispatchFrame(ctx, name, data)) {
          terminal = true;
        }
      }
      if (terminal) break;
    }
  } catch (err) {
    if (liveness) clearTimeout(liveness);
    // An intentional abort is not an error; anything else is a broken pipe
    // the caller may repair by reattaching.
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { terminal: false, lastOrdinal: ctx.lastOrdinal, broken: false };
    }
    return { terminal: false, lastOrdinal: ctx.lastOrdinal, broken: true };
  }
  if (liveness) clearTimeout(liveness);

  if (terminal) {
    return { terminal, lastOrdinal: ctx.lastOrdinal, broken: false };
  }
  if (signal?.aborted) {
    return { terminal: false, lastOrdinal: ctx.lastOrdinal, broken: false };
  }
  // The body ended without a terminal: starved watchdog or server-side drop.
  return { terminal: false, lastOrdinal: ctx.lastOrdinal, broken: true };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Reattach to a running (or recently finished) generation and keep consuming:
 * `GET /api/conversations/:id/stream?after=<ordinal>` replays everything the
 * client missed, then continues live. 404 means nothing is attachable — the
 * replay window lapsed; the caller falls back to history.
 */
async function reattachLoop(
  ctx: ConsumeContext,
  signal?: AbortSignal
): Promise<void> {
  for (let attempt = 1; attempt <= REATTACH_ATTEMPTS; attempt += 1) {
    if (signal?.aborted || !ctx.conversationId) return;
    await sleep(Math.min(1000 * attempt, 3000));
    if (signal?.aborted) return;

    let res: Response;
    try {
      res = await fetch(
        `/api/conversations/${encodeURIComponent(ctx.conversationId)}/stream?after=${ctx.lastOrdinal}`,
        { signal }
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      continue;
    }
    if (res.status === 404) {
      // Nothing attachable: the turn finished and the replay window lapsed.
      // History holds the persisted outcome — surface a soft error so the
      // screen reloads rather than spinning forever.
      ctx.handlers.onError?.(
        'The connection was interrupted. Pull to refresh — your answer was saved.'
      );
      return;
    }
    if (!res.ok) continue;

    const result = await consumeStream(res, ctx, signal);
    if (result.terminal || !result.broken) return;
  }
  ctx.handlers.onError?.(
    'The connection was interrupted. Check your network and reload — your answer was saved.'
  );
}

interface StreamPostOptions {
  conversationId?: string | null;
  signal?: AbortSignal;
}

async function streamPost(
  url: string,
  body: Record<string, unknown>,
  handlers: StreamHandlers,
  options: StreamPostOptions
): Promise<void> {
  const { signal } = options;
  // The idempotency token makes OUR retransmissions (and double-taps) replay
  // the original stream instead of generating twice.
  const token =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `tok-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload = JSON.stringify({ ...body, idempotency_token: token });

  const request = () =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal,
    });

  let res: Response;
  try {
    res = await request();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    handlers.onError?.('Could not reach Lumora. Check your connection.');
    return;
  }

  // A pre-stream 401 can mean "profile not provisioned; call GET /me first".
  // Provision once and retry exactly once — the idempotency token makes the
  // retry safe even if the first request actually started a generation.
  if (res.status === 401) {
    const provisioned = await provisionProfile(signal);
    if (signal?.aborted) return;
    if (provisioned) {
      try {
        res = await request();
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        handlers.onError?.('Could not reach Lumora. Check your connection.');
        return;
      }
    }
  }

  const ctx: ConsumeContext = {
    handlers,
    conversationId: options.conversationId ?? null,
    lastOrdinal: 0,
  };

  // 409: one generation per conversation, and it is already running. Attach
  // to it from the beginning instead of erroring — the user sees the live
  // progress of the turn that IS happening.
  if (res.status === 409 && ctx.conversationId) {
    await reattachLoop({ ...ctx, lastOrdinal: 0 }, signal);
    return;
  }

  // Channel A: the request failed before the stream committed.
  if (!res.ok) {
    handlers.onError?.(await readErrorBody(res));
    return;
  }

  // /conversations/start also delivers the id on this header, readable the
  // instant the response arrives — before any event has been parsed.
  const headerId = res.headers.get('X-Conversation-Id');
  if (headerId) {
    ctx.conversationId = headerId;
    handlers.onConversation?.(headerId);
  }

  const result = await consumeStream(res, ctx, signal);
  if (result.terminal || !result.broken) return;
  // Mid-turn connection loss: the generation is still running server-side
  // (disconnect ≠ cancel) — reattach and resume from the last ordinal.
  await reattachLoop(ctx, signal);
}

/** `POST /api/conversations/:id/messages` — send a message, stream the turn. */
export function streamMessage(
  conversationId: string,
  body: SendMessageBody,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  return streamPost(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
    body as unknown as Record<string, unknown>,
    handlers,
    { conversationId, signal }
  );
}

/** `POST /api/conversations/start` — create + first message in one stream. */
export function streamStart(
  body: StartConversationBody,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  return streamPost(
    '/api/conversations/start',
    body as unknown as Record<string, unknown>,
    handlers,
    { conversationId: null, signal }
  );
}

/**
 * `POST /api/conversations/:id/regenerate` — re-run the last exchange as a
 * standard turn stream. On `done`, reload history: the old reply has been
 * superseded server-side and the new one replaces it.
 */
export function streamRegenerate(
  conversationId: string,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  return streamPost(
    `/api/conversations/${encodeURIComponent(conversationId)}/regenerate`,
    {},
    handlers,
    { conversationId, signal }
  );
}

/**
 * `POST /api/conversations/:id/stream/stop` — stop the running generation.
 * Idempotent and race-safe; the stream itself delivers the `stopped`
 * terminal, so callers only fire-and-forget this.
 */
export async function stopGeneration(conversationId: string): Promise<void> {
  try {
    await fetch(
      `/api/conversations/${encodeURIComponent(conversationId)}/stream/stop`,
      { method: 'POST' }
    );
  } catch {
    // The terminal (or its absence) tells the real story; nothing to do here.
  }
}
