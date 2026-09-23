// Client-side adapter over the generated conversation client.
//
// The generated `ChatbotApi` (see `lib/api/generated`, from
// `openapi/lumora-api.json`) talks to the same-origin `/api` Route Handlers;
// auth stays in cookies. This module unwraps the `{ success, data, error }`
// envelope, corrects the two documented Swagger artifacts (message `payload`
// and `role` — see `lib/api/types.ts`), and exposes plain results so UI code
// never touches raw API responses.
import { IS_DEMO_AUTH } from '@/lib/auth/mode';

import {
  ChatbotApi,
  Configuration,
  ResponseError,
  type ConversationEntity,
  type MessageEntity,
} from './generated';
import { provisionProfile } from './provision';

import type { ChatMessage, MessageKind, MessageRole } from './types';

const api = new ChatbotApi(new Configuration({ basePath: '/api' }));

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  messages: ChatMessage[];
}

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; error: string };

const MESSAGE_KINDS: ReadonlySet<string> = new Set([
  'text',
  'requirement',
  'understanding',
  'analysis',
  'candidates',
  'marketplace',
  'research',
  'recommendation',
  'deals',
]);

const MESSAGE_ROLES: ReadonlySet<string> = new Set([
  'user',
  'assistant',
  'system',
]);

function toChatMessage(entity: MessageEntity): ChatMessage | null {
  if (!entity.id) return null;
  const kind = String(entity.kind ?? 'text');
  const role = String(entity.role ?? 'assistant');
  return {
    id: entity.id,
    conversation_id: entity.conversation_id ?? '',

    role: (MESSAGE_ROLES.has(role) ? role : 'assistant') as MessageRole,
    kind: (MESSAGE_KINDS.has(kind) ? kind : 'text') as MessageKind,
    content: entity.content ?? '',
    // Swagger types `payload` as integer[] (Go json.RawMessage); on the wire
    // it is the structured object for `kind`. Renderers narrow it per kind.
    payload: entity.payload as unknown,
    created_at: entity.created_at ?? '',
    // v0.6.0 row provenance — lets the UI mark partial/fallback rows honestly.
    status: (entity as { status?: ChatMessage['status'] }).status,
    stop_reason: (entity as { stop_reason?: string }).stop_reason,
  };
}

function toMessages(entities: MessageEntity[] | undefined): ChatMessage[] {
  return (entities ?? [])
    .map(toChatMessage)
    .filter((m): m is ChatMessage => m !== null);
}

function toDetail(entity: ConversationEntity | undefined): ConversationDetail {
  return {
    id: entity?.id ?? '',
    title: entity?.title ?? '',
    messages: toMessages(entity?.messages),
  };
}

async function toFailure(error: unknown): Promise<{
  ok: false;
  status: number;
  error: string;
}> {
  if (error instanceof ResponseError) {
    const status = error.response.status;
    let message = '';
    try {
      const body = (await error.response.json()) as { error?: string };
      if (typeof body.error === 'string') message = body.error;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    if (!message) {
      message =
        status === 401
          ? 'You need to sign in to continue.'
          : `The request failed (HTTP ${status}).`;
    }
    return { ok: false, status, error: message };
  }
  return {
    ok: false,
    status: 0,
    error: 'Could not reach Lumora. Check your connection.',
  };
}

async function withProvisionRetry<T>(
  run: () => Promise<T>
): Promise<ApiResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    const failure = await toFailure(error);
    if (failure.status !== 401) return failure;

    if (!(await provisionProfile())) return failure;

    try {
      return { ok: true, data: await run() };
    } catch (retryError) {
      return toFailure(retryError);
    }
  }
}

/** `GET /api/conversations` — most recently updated first, no messages. */
export async function listConversations(): Promise<
  ApiResult<ConversationSummary[]>
> {
  if (IS_DEMO_AUTH) return { ok: true, data: [] };
  return withProvisionRetry(async () => {
    const envelope = await api.conversationsGet();
    return (envelope.data ?? [])
      .filter((c): c is ConversationEntity & { id: string } => Boolean(c.id))
      .map((c) => ({
        id: c.id,
        title: c.title ?? '',
        updatedAt: c.updated_at ?? c.created_at ?? '',
      }));
  });
}

/** `DELETE /api/conversations/:id` — soft-deletes an owned conversation. */
export async function deleteConversation(id: string): Promise<ApiResult<null>> {
  return withProvisionRetry(async () => {
    await api.conversationsIdDelete({ id });
    return null;
  });
}

/** `PATCH /api/conversations/:id` — sets a user-chosen title. */
export async function renameConversation(
  id: string,
  title: string
): Promise<ApiResult<null>> {
  return withProvisionRetry(async () => {
    // Direct fetch: the generated client lags the backend by one swagger regen;
    // this rides the same same-origin proxy the generated calls use.
    const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new ResponseError(res);
    return null;
  });
}

/** `GET /api/conversations/:id` — full ordered message history. */
export async function getConversation(
  id: string
): Promise<ApiResult<ConversationDetail>> {
  return withProvisionRetry(async () => {
    const envelope = await api.conversationsIdGet({ id });
    return toDetail(envelope.data);
  });
}

/** "Just now" / "5m ago" / "Yesterday" — sidebar-style relative time. */
export function formatRelativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, (Date.now() - then) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week ago';
  if (weeks < 5) return `${weeks} weeks ago`;
  return new Date(then).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
