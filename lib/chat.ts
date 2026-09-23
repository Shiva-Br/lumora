// Chat/conversation entry points for Lumora.
//
// These types and functions are deliberately the *only* place the Home UI
// talks to "chat", and their signatures are stable. The conversation screen
// itself lives on `/chat/[conversationId]` and speaks to the backend through
// `lib/api/*` + `lib/conversation/*`.
import { IS_DEMO_AUTH } from '@/lib/auth/mode';
import { stashFirstMessage } from '@/lib/conversation/first-message';

export type Conversation = {
  id: string;
  title: string;
  /** Human-readable relative time, e.g. "Just now". Server-formatted for now. */
  time: string;
};

export type Account = {
  email: string;
  /**
   * Display name from the backend profile, or null when we only know the
   * address. The sidebar's account row leads with this and falls back to
   * the email — it never invents one from the address.
   */
  name: string | null;
  /** Avatar letter. Derived in `lib/auth/identity.ts` from the real identity. */
  initial: string;
};

export type SendMessageResult =
  { ok: true; conversationId: string } | { ok: false; error: string };

/**
 * Start a conversation from the Home composer.
 *
 * The first turn streams (`POST /api/conversations/start`), and that stream
 * must be owned by the screen that renders it — so this does not call the
 * backend. It stashes the prompt (custody passes from the pending-prompt
 * store to the first-message stash; the chat screen keeps preserving it on
 * failure) and the caller routes to `/chat/${conversationId}`, where the
 * chat screen submits it exactly once.
 */
export async function sendMessage(message: string): Promise<SendMessageResult> {
  if (IS_DEMO_AUTH) {
    return {
      ok: false,
      error: 'This is a UI demo. Connect a backend to use chat and research.',
    };
  }
  const trimmed = (message || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Please enter a message.' };
  }
  stashFirstMessage(trimmed);
  return { ok: true, conversationId: 'new' };
}
