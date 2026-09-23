import { describe, expect, it } from 'vitest';

import type { ChatMessage } from '@/lib/api/types';

import {
  freshPayload,
  reducer,
  type Action,
  type ConversationState,
} from '../use-conversation';

/**
 * Editing an answer must invalidate everything computed from the old answers.
 *
 * The backend clears its session state (candidates, evidence, recommendation)
 * and commits a fresh `requirement` message when a flow reopens. These tests
 * pin the client's half of that contract: payloads behind the newest
 * requirement message stop counting, so the consent gate re-arms, the
 * workspace empties, and "Lumora analysis" starts a NEW run instead of
 * reopening the stale one.
 */

function msg(kind: ChatMessage['kind'], payload?: unknown): ChatMessage {
  return {
    id: `${kind}-${Math.random().toString(36).slice(2, 8)}`,
    conversation_id: 'c1',
    role: kind === 'text' ? 'user' : 'assistant',
    kind,
    content: '',
    created_at: '',
    payload,
  } as ChatMessage;
}

describe('freshPayload stops at the collection-round boundary', () => {
  it('returns payloads committed after the newest requirement message', () => {
    const messages = [
      msg('requirement', { type: 'followup_questions' }),
      msg('understanding', { core_need: 'x' }),
      msg('candidates', { products: [{ name: 'A' }] }),
      msg('recommendation', { best: 'A' }),
    ];
    expect(freshPayload(messages, 'candidates')).toEqual({
      products: [{ name: 'A' }],
    });
    expect(freshPayload(messages, 'recommendation')).toEqual({ best: 'A' });
  });

  it('stops counting evidence once a newer requirement reopens the flow', () => {
    const messages = [
      msg('requirement', { type: 'followup_questions' }),
      msg('candidates', { products: [{ name: 'A' }] }),
      msg('recommendation', { best: 'A' }),
      msg('requirement', { type: 'followup_questions' }), // the edit
    ];
    expect(freshPayload(messages, 'candidates')).toBeNull();
    expect(freshPayload(messages, 'recommendation')).toBeNull();
  });

  it('finds nothing on a thread with no payload of that kind', () => {
    expect(freshPayload([msg('text')], 'candidates')).toBeNull();
  });
});

describe('an edit turn restarts the decision ladder', () => {
  const base: ConversationState = {
    id: 'c1',
    title: '',
    load: { phase: 'ready' },
    messages: [],
    turn: {
      streaming: false,
      stages: [],
      draft: '',
      error: null,
      expect: null,
      tool: null,
      notice: null,
    },
    decisionStages: [
      { stage: 'discovery', state: 'completed', message: '' },
      { stage: 'recommendation', state: 'completed', message: '' },
    ],
    freshDecision: false,
    dataSeq: {},
  };

  const user: ChatMessage = {
    id: 'u1',
    conversation_id: 'c1',
    role: 'user',
    kind: 'text',
    content: '',
    created_at: '',
  };

  it('clears completed rungs when the turn reopens an answer', () => {
    // Those rungs describe a pipeline the backend just invalidated; leaving
    // them lit claims results that no longer exist.
    const next = reducer(base, {
      type: 'turn-start',
      userMessage: user,
      reopensDecision: true,
    } as Action);
    expect(next.decisionStages).toEqual([]);
  });

  it('keeps them for an ordinary turn', () => {
    const next = reducer(base, {
      type: 'turn-start',
      userMessage: user,
    } as Action);
    expect(next.decisionStages).toHaveLength(2);
  });
});

describe('a brand-new request resets the decision ladder', () => {
  const finished: ConversationState = {
    id: 'c1',
    title: '',
    load: { phase: 'ready' },
    messages: [],
    turn: {
      streaming: true,
      stages: [],
      draft: '',
      error: null,
      expect: null,
      tool: null,
      notice: null,
    },
    decisionStages: [
      { stage: 'requirement', state: 'completed', message: '' },
      { stage: 'discovery', state: 'completed', message: '' },
      { stage: 'recommendation', state: 'completed', message: '' },
    ],
    freshDecision: false,
    dataSeq: {},
  };

  const requirementStarted: Action = {
    type: 'status',
    event: {
      stage: 'requirement',
      state: 'started',
      message: 'Reviewing what you’ve told me',
    },
  } as Action;

  it('clears the old rungs when a requirement opens after a finished decision', () => {
    const next = reducer(finished, requirementStarted);
    expect(
      next.decisionStages.filter((entry) => entry.state === 'completed')
    ).toHaveLength(0);
    expect(next.freshDecision).toBe(true);
  });

  it('the new requirement payload closes the fresh window', () => {
    const opened = reducer(finished, requirementStarted);
    const landed = reducer(opened, {
      type: 'data',
      kind: 'requirement',
      payload: { type: 'followup_questions' },
      id: 'm-req-2',
    } as Action);
    expect(landed.freshDecision).toBe(false);
  });

  it('does NOT reset mid-collection, where nothing downstream has completed', () => {
    const collecting: ConversationState = {
      ...finished,
      decisionStages: [
        { stage: 'requirement', state: 'completed', message: '' },
      ],
    };
    const next = reducer(collecting, requirementStarted);
    expect(next.decisionStages.length).toBeGreaterThan(0);
    expect(next.freshDecision).toBe(false);
  });
});

it('resets on a RELOADED finished thread, where the lit rungs come from history', () => {
  const reloaded: ConversationState = {
    id: 'c1',
    title: '',
    load: { phase: 'ready' },
    messages: [
      msg('requirement', { type: 'followup_questions' }),
      msg('understanding', { core_need: 'x' }),
      msg('candidates', { products: [] }),
      msg('recommendation', { best: 'A' }),
    ],
    turn: {
      streaming: true,
      stages: [],
      draft: '',
      error: null,
      expect: null,
      tool: null,
      notice: null,
    },
    decisionStages: [],
    freshDecision: false,
    dataSeq: {},
  };
  const next = reducer(reloaded, {
    type: 'status',
    event: {
      stage: 'requirement',
      state: 'started',
      message: 'Reviewing what you’ve told me',
    },
  } as Action);
  expect(next.freshDecision).toBe(true);
});
