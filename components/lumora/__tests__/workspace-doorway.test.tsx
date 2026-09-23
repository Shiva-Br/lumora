import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CandidateSet,
  ChatMessage,
  Recommendation,
} from '@/lib/api/types';
import { LocaleProvider } from '@/lib/i18n/provider';

const conversation = vi.hoisted(() => ({
  value: {
    load: { phase: 'ready' } as const,
    id: 'conv-1',
    title: 'Laptop purchase',
    messages: [] as ChatMessage[],
    turn: {
      streaming: false,
      stages: [],
      tool: null,
      error: null,
      pending: false,
    },
    decisionStages: [],
    latestRequirement: null,
    candidates: null as CandidateSet | null,
    marketplace: null,
    research: null,
    recommendation: null as Recommendation | null,
    dataSeq: {},
    send: vi.fn(),
    stop: vi.fn(),
    regenerate: vi.fn(),
    dismissTurnError: vi.fn(),
    reload: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/chat/conv-1',
}));

vi.mock('@/lib/conversation/use-conversation', () => ({
  useConversation: () => conversation.value,
}));

vi.mock('@/lib/conversation/chat-history-provider', () => ({
  useChatHistory: () => ({
    conversations: [],
    loading: false,
    refresh: vi.fn(),
    remove: vi.fn(),
    rename: vi.fn(),
  }),
}));

vi.mock('@/lib/auth/auth-provider', () => ({
  useAuth: () => ({
    status: 'authenticated',
    identity: { id: 'u1', email: 'dev@example.com' },
    profile: { first_name: 'Lumora Developer' },
    signOut: vi.fn(),
  }),
}));

vi.mock('@/lib/api/preferences', () => ({
  updatePreferences: vi.fn(async () => null),
  getPreferences: vi.fn(async () => null),
  DEFAULT_PREFERENCES: {},
}));

const { ChatScreen } = await import('@/components/lumora/chat/chat-screen');

/** Lumora has understood the request — enough for the pipeline to be runnable. */
const UNDERSTANDING_MESSAGE = {
  id: 'm-und',
  conversation_id: 'conv-1',
  role: 'assistant',
  kind: 'understanding',
  content: 'Understanding ready',
  created_at: '2026-08-21T10:00:00Z',
  payload: {
    type: 'understanding',
    confirmed: true,
    core_need: 'A laptop for everyday work',
    confidence: { pct: 88, level: 'Good' },
  },
} as unknown as ChatMessage;

/** A shortlist is real workspace data — the Proof tab renders from it. */
const CANDIDATES = {
  type: 'candidates',
  products: [
    { id: 'p1', name: 'Surface Laptop 13.8"', scores: { match: 88 } },
    { id: 'p2', name: 'ROG Zephyrus G14', scores: { match: 87 } },
  ],
} as unknown as CandidateSet;

function mount() {
  return render(
    <LocaleProvider initialLocale="en">
      <ChatScreen conversationId="conv-1" />
    </LocaleProvider>
  );
}

function doorway() {
  return screen.queryByRole('button', { name: 'Open the LUMORA Workspace' });
}

/**
 * The analysis job's network, held open on purpose: the test needs the panel
 * to STAY in its running state long enough to assert on it, which is also the
 * state a real user spends a minute or two looking at.
 */
const realFetch = globalThis.fetch;

const fetchMock = vi.fn((_url: string, init?: { method?: string }) => {
  if (init?.method === 'POST') {
    return Promise.resolve({
      ok: true,
      json: async () => ({ success: true, data: { job_id: 'an_test' } }),
    });
  }
  return Promise.resolve({
    ok: true,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"stage":8,"pct":88,"label":"Comparing & reasoning","detail":"live offers collected"}\n\n'
          )
        );
        // Never closed: the job is still working.
      },
    }),
  });
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  conversation.value.candidates = null;
  conversation.value.recommendation = null;
  conversation.value.dataSeq = {};
  conversation.value.messages = [];
});

afterEach(() => {
  // Only this file's own stub. `vi.unstubAllGlobals()` would also drop the
  // setup file's, which every render in this file depends on.
  vi.stubGlobal('fetch', realFetch);
});

/**
 * The state the screenshots caught: the workspace auto-opens the moment a live
 * event lands, which is BEFORE any payload has been persisted. `dataSeq` is a
 * counter of live events; `candidates` is the payload. They arrive apart, so
 * the panel is routinely open with nothing in it — and that is precisely when
 * the person is watching it.
 */
describe('an open workspace with nothing in it yet', () => {
  function openWithNoPayloads() {
    // A live RESULT event bumped the counter and tripped the auto-open — only
    // finished results open the panel now — but its payload hasn't landed
    // yet. `latestUnderstanding` is read off the MESSAGE list, so the
    // understanding has to be a real message for the screen to see it.
    conversation.value.dataSeq = { recommendation: 1 };
    conversation.value.messages = [UNDERSTANDING_MESSAGE];
    return mount();
  }

  const tabs = ['My Best Choice', 'Why It Wins', 'Best Place to Buy'];

  it.each(tabs)('%s says something rather than nothing', async (label) => {
    const user = userEvent.setup();
    const { container } = openWithNoPayloads();
    expect(screen.getByRole('tablist')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: new RegExp(label) }));
    const panel = screen.getByRole('tabpanel');
    expect(panel.textContent?.trim().length ?? 0).toBeGreaterThan(20);
    void container;
  });

  it('never tells the person to use a flow that no longer exists', async () => {
    const user = userEvent.setup();
    openWithNoPayloads();
    for (const label of tabs) {
      await user.click(screen.getByRole('tab', { name: new RegExp(label) }));
      const text = screen.getByRole('tabpanel').textContent ?? '';
      // The compare-view selection step was replaced by the analysis job.
      expect(text).not.toMatch(/Select one or more products/i);
      expect(text).not.toMatch(/your selected products/i);
    }
  });

  it('offers the action that fills the page', async () => {
    const user = userEvent.setup();
    openWithNoPayloads();
    await user.click(screen.getByRole('tab', { name: /My Best Choice/ }));
    expect(
      screen.getByRole('button', { name: /Run the full analysis/i })
    ).toBeVisible();
  });

  it('shows live progress instead of "nothing here" once it is running', async () => {
    const user = userEvent.setup();
    openWithNoPayloads();
    await user.click(screen.getByRole('tab', { name: /My Best Choice/ }));
    await user.click(
      screen.getByRole('button', { name: /Run the full analysis/i })
    );

    const bar = await screen.findByRole('progressbar');
    expect(bar).toBeVisible();
    await waitFor(() => expect(bar).toHaveAttribute('aria-valuenow', '88'));
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent('Lumora is working on this');
    // The backend's own honest counted line, not a spinner.
    expect(panel).toHaveTextContent('live offers collected');
    // …and the dead-end copy is gone while it works.
    expect(screen.getByRole('tabpanel')).not.toHaveTextContent(
      'No analysis yet'
    );
  });
});

/**
 * The consent button — renamed "Lumora analysis" — runs the detached pipeline,
 * never a chat turn.
 *
 * Its predecessor sent `confirmUnderstanding` as a turn: the pipeline ran
 * inside the turn deadline (and failed), a prose reply landed in the thread
 * after every press, and because the stored understanding never learned it had
 * been confirmed, the card kept offering the button — the same user pressed it
 * twice and got two walls of text.
 */
describe('the Lumora analysis button', () => {
  function unconfirmedThread() {
    conversation.value.messages = [
      {
        ...UNDERSTANDING_MESSAGE,
        payload: {
          ...(UNDERSTANDING_MESSAGE as unknown as { payload: object }).payload,
          confirmed: false,
        },
      } as unknown as ChatMessage,
    ];
    return mount();
  }

  it('is named for what it does, in both states', () => {
    unconfirmedThread();
    expect(
      screen.getByRole('button', { name: 'Lumora analysis' })
    ).toBeVisible();
    expect(screen.queryByText(/Yes — continue/)).toBeNull();
  });

  it('runs the job with the workspace closed — never a chat turn', async () => {
    const user = userEvent.setup();
    unconfirmedThread();

    await user.click(screen.getByRole('button', { name: 'Lumora analysis' }));

    // The workspace stays shut while Lumora thinks: the in-thread journey is
    // the face of the wait, and the panel shows up with the answer.
    expect(screen.queryByRole('tablist')).toBeNull();
    // No turn means no optimistic user bubble and no narrated reply.
    expect(conversation.value.send).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).includes('/analysis') &&
          (init as { method?: string } | undefined)?.method === 'POST'
      )
    ).toBe(true);
  });

  it('stops claiming to wait for a confirmation the user just gave', async () => {
    const user = userEvent.setup();
    const { container } = unconfirmedThread();
    expect(container.textContent).toContain('Waiting for your confirmation');

    await user.click(screen.getByRole('button', { name: 'Lumora analysis' }));
    expect(container.textContent).not.toContain(
      'Waiting for your confirmation'
    );
  });

  it('treats a downstream payload as the consent it proves', () => {
    // The stored flag says false — older backends never updated it — but the
    // pipeline only runs after consent, so candidates ARE the confirmation.
    conversation.value.messages = [
      {
        ...UNDERSTANDING_MESSAGE,
        payload: {
          ...(UNDERSTANDING_MESSAGE as unknown as { payload: object }).payload,
          confirmed: false,
        },
      } as unknown as ChatMessage,
    ];
    conversation.value.candidates = CANDIDATES;
    const { container } = mount();

    expect(container.textContent).not.toContain(
      'Waiting for your confirmation'
    );
    // The card sits in its confirmed state — and the way back into the
    // workspace stays on it.
    expect(
      screen.getByRole('button', { name: 'Lumora analysis' })
    ).toBeVisible();
  });
});

describe('the way into the workspace', () => {
  // v0.23: the header doorway and the ready-card button are gone on purpose —
  // three buttons opened the same panel. The understanding card's "Lumora
  // analysis" is THE door — and it only OPENS the panel when a finished
  // result exists; otherwise it starts the run and the in-thread journey is
  // the face of the wait (the workspace shows up with the answer, not with
  // the work in progress).
  const RECOMMENDATION = {
    type: 'recommendation',
    best_pick: 'Surface Laptop 13.8"',
    summary: 'A clear winner for everyday work.',
  } as unknown as Recommendation;

  it('offers no header doorway — the understanding card is the only door', () => {
    conversation.value.candidates = CANDIDATES;
    conversation.value.recommendation = RECOMMENDATION;
    conversation.value.messages = [UNDERSTANDING_MESSAGE];
    mount();
    expect(doorway()).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Lumora analysis' })
    ).toBeVisible();
  });

  it('the card door opens the workspace on a thread with a finished result', async () => {
    // `dataSeq` stays empty: this is exactly the history-load case, where the
    // auto-open never fires because no stream event arrived this session.
    const user = userEvent.setup();
    conversation.value.candidates = CANDIDATES;
    conversation.value.recommendation = RECOMMENDATION;
    conversation.value.messages = [UNDERSTANDING_MESSAGE];
    mount();

    expect(screen.queryByRole('tablist')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Lumora analysis' }));
    expect(screen.getByRole('tablist')).toBeVisible();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('starts the run instead of opening an unfinished workspace', async () => {
    // Only a shortlist exists — no recommendation, no analysis. The press
    // must run the pipeline (the journey narrates it in-thread), not open a
    // panel of half-finished data.
    const user = userEvent.setup();
    conversation.value.candidates = CANDIDATES;
    conversation.value.messages = [UNDERSTANDING_MESSAGE];
    mount();

    await user.click(screen.getByRole('button', { name: 'Lumora analysis' }));
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).includes('/analysis') &&
          (init as { method?: string } | undefined)?.method === 'POST'
      )
    ).toBe(true);
  });
});
