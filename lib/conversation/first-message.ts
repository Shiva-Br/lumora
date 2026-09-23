// The first message of a brand-new conversation, handed from the Home
// composer to the chat screen across a client-side navigation.
//
// Home cannot send it itself: `POST /conversations/start` streams the whole
// first turn, and that stream must be owned by the screen that renders it.
// So Home stashes the text, routes to `/chat/new`, and the chat screen takes
// it exactly once and opens the stream. sessionStorage (not a query param)
// keeps the prompt out of URLs and history, same as `pending-prompt.ts`.

const KEY = 'lumora.first_message';

/** Navigation completes in moments; anything older is a stale leftover. */
const MAX_AGE_MS = 2 * 60 * 1000;

type StashedFirstMessage = {
  content: string;
  createdAt: number;
};

export function stashFirstMessage(content: string): void {
  try {
    const value: StashedFirstMessage = { content, createdAt: Date.now() };
    window.sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable — the chat screen will simply open empty and the
    // user sends from there.
  }
}

/** Read AND clear — the message must be submitted exactly once. */
export function takeFirstMessage(): string | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StashedFirstMessage>;
    if (
      typeof parsed.content === 'string' &&
      parsed.content.trim().length > 0 &&
      typeof parsed.createdAt === 'number' &&
      Date.now() - parsed.createdAt <= MAX_AGE_MS
    ) {
      return parsed.content;
    }
  } catch {
    // Corrupted value — treat as absent.
  }
  return null;
}
