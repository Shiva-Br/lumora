// The prompt a guest tried to submit, held across the login flow.
//
// Modelled as an external store (sessionStorage + subscribers) so React can
// read it with useSyncExternalStore instead of copying it into state on mount.
// sessionStorage is what makes the prompt survive the full-page redirect out to
// Google/Apple and back.
//
// It holds ONLY the user's own prompt text — never a token, never a code
// verifier — and it never travels in a URL query parameter.
//
// Two distinct facts live here:
//   prompt — the text. Kept until the backend actually accepts the submission.
//   armed  — "submit this as soon as the user is authenticated".
//
// They come apart when the user backs out: cancelling the login modal (or an
// OAuth prompt) disarms the intent but keeps the text on screen, exactly as the
// product requires.

const KEY = 'lumora.pending_prompt';

/** An abandoned intent goes stale rather than firing on a much later visit. */
const MAX_AGE_MS = 30 * 60 * 1000;

export type PendingPrompt = {
  prompt: string;
  createdAt: number;
  armed: boolean;
};

const listeners = new Set<() => void>();

// useSyncExternalStore compares snapshots by identity and would loop forever if
// we re-parsed on every read, so the parsed value is cached against its raw JSON.
let cachedRaw: string | null = null;
let cachedValue: PendingPrompt | null = null;

function isPendingPrompt(value: unknown): value is PendingPrompt {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.prompt === 'string' &&
    candidate.prompt.length > 0 &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.armed === 'boolean'
  );
}

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    // Storage disabled (private mode) — behave as if empty.
    return null;
  }
}

function writeRaw(value: PendingPrompt | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable. The composer still holds the text in memory, so only
    // the cross-redirect (OAuth) resume is lost.
  }
  for (const listener of listeners) listener();
}

export function subscribePendingPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPendingPrompt(): PendingPrompt | null {
  const raw = readRaw();
  if (raw === null) {
    cachedRaw = null;
    cachedValue = null;
    return null;
  }
  if (raw === cachedRaw) return cachedValue;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  if (!isPendingPrompt(parsed) || Date.now() - parsed.createdAt > MAX_AGE_MS) {
    cachedRaw = null;
    cachedValue = null;
    writeRaw(null);
    return null;
  }

  cachedRaw = raw;
  cachedValue = parsed;
  return parsed;
}

/** There is no pending prompt during SSR — sessionStorage is a browser store. */
export function getPendingPromptServerSnapshot(): PendingPrompt | null {
  return null;
}

/** Preserve the prompt AND mark it for automatic submission after login. */
export function armPendingPrompt(prompt: string): void {
  writeRaw({ prompt, createdAt: Date.now(), armed: true });
}

/** Back out of the login flow: keep the text, cancel the automatic submission. */
export function disarmPendingPrompt(): void {
  const current = getPendingPrompt();
  if (!current || !current.armed) return;
  writeRaw({ ...current, armed: false });
}

/** Drop it entirely. Only correct once the prompt has actually been accepted. */
export function clearPendingPrompt(): void {
  writeRaw(null);
}
