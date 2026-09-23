import { describe, expect, it } from 'vitest';

import {
  reducer,
  type Action,
  type ConversationState,
} from '../use-conversation';

/** A state mid-turn, with two rungs already lit — the shape a general turn has. */
function midTurn(): ConversationState {
  const base = reducer(
    {
      id: 'c1',
      title: '',
      load: { phase: 'ready' as const },
      messages: [],
      turn: EMPTY_TURN,
      decisionStages: [],
      freshDecision: false,
      dataSeq: {},
    },
    {
      type: 'turn-start',
      userMessage: {
        id: 'u1',
        conversation_id: 'c1',
        role: 'user',
        kind: 'text',
        content: 'hi',
        created_at: '',
      },
    } as Action
  );
  const withUnderstanding = reducer(base, {
    type: 'status',
    event: {
      stage: 'understanding',
      state: 'completed',
      message: 'Understood',
    },
  } as Action);
  return reducer(withUnderstanding, {
    type: 'status',
    event: {
      stage: 'response',
      state: 'started',
      message: 'Writing your answer',
    },
  } as Action);
}

const EMPTY_TURN = {
  streaming: false,
  stages: [],
  draft: '',
  error: null,
  expect: null,
  tool: null,
  notice: null,
};

describe('the stage ladder survives the turn', () => {
  it('keeps the stages when the turn completes', () => {
    const before = midTurn();
    expect(before.turn.stages).toHaveLength(2);

    const after = reducer(before, { type: 'done', messageId: 'm1' } as Action);
    expect(after.turn.stages).toHaveLength(2);
    expect(after.turn.streaming).toBe(false);
  });

  it('settles a still-running stage as completed on success', () => {
    // A stage left `started` renders as a pulsing dot — an indicator that
    // animates forever after the turn is over.
    const after = reducer(midTurn(), {
      type: 'done',
      messageId: 'm1',
    } as Action);
    expect(after.turn.stages.map((s) => s.state)).toEqual([
      'completed',
      'completed',
    ]);
  });

  it('settles a still-running stage as FAILED when the turn was stopped', () => {
    // Different honesty: a stopped or timed-out turn did not finish what it was
    // running, and claiming otherwise would be a green tick over work that
    // never happened.
    const after = reducer(midTurn(), {
      type: 'turn-ended',
      message: 'Stopped.',
    } as Action);
    expect(after.turn.stages.map((s) => s.state)).toEqual([
      'completed',
      'failed',
    ]);
    expect(after.turn.notice).toBe('Stopped.');
  });

  it('clears the ladder when the NEXT turn starts, not before', () => {
    const ended = reducer(midTurn(), {
      type: 'done',
      messageId: 'm1',
    } as Action);
    const next = reducer(ended, {
      type: 'turn-start',
      userMessage: {
        id: 'u2',
        conversation_id: 'c1',
        role: 'user',
        kind: 'text',
        content: 'again',
        created_at: '',
      },
    } as Action);
    expect(next.turn.stages).toEqual([]);
    expect(next.turn.streaming).toBe(true);
  });

  it('drops the transient turn state that should not outlive the turn', () => {
    // The ladder is a record worth keeping; the draft, the tool line and the
    // pace hint are not — they belong to the turn that just ended.
    const withTool = reducer(midTurn(), {
      type: 'tool',
      label: 'searching',
    } as Action);
    const after = reducer(withTool, {
      type: 'done',
      messageId: 'm1',
    } as Action);
    expect(after.turn.tool).toBeNull();
    expect(after.turn.draft).toBe('');
    expect(after.turn.expect).toBeNull();
  });
});

describe('the decision ladder survives the turns that build it', () => {
  function fresh(): ConversationState {
    return {
      id: 'c1',
      title: '',
      load: { phase: 'ready' as const },
      messages: [],
      turn: EMPTY_TURN,
      decisionStages: [],
      freshDecision: false,
      dataSeq: {},
    };
  }

  const user = (id: string) => ({
    type: 'turn-start' as const,
    userMessage: {
      id,
      conversation_id: 'c1',
      role: 'user' as const,
      kind: 'text' as const,
      content: 'x',
      created_at: '',
    },
  });

  const status = (stage: string, state: 'started' | 'completed'): Action => ({
    type: 'status',
    event: { stage, state, message: `${stage} ${state}` } as never,
  });

  const done: Action = {
    type: 'done',
    messageId: 'm1',
  } as unknown as Action;

  function completedStages(s: ConversationState): string[] {
    return s.decisionStages
      .filter((e) => e.state === 'completed')
      .map((e) => e.stage)
      .sort();
  }

  it('keeps turn one’s rungs lit through turn two', () => {
    let s = fresh();
    // Turn 1: requirement + understanding complete.
    s = reducer(s, user('u1'));
    for (const st of ['requirement', 'understanding'] as const) {
      s = reducer(s, status(st, 'started'));
      s = reducer(s, status(st, 'completed'));
    }
    s = reducer(s, done);
    expect(completedStages(s)).toEqual(['requirement', 'understanding']);

    // Turn 2 begins. This is the moment the ladder used to go dark.
    s = reducer(s, user('u2'));
    expect(completedStages(s)).toEqual(['requirement', 'understanding']);
    // The per-turn ladder DOES reset — the in-thread thinking line is about
    // this turn, and that distinction is the point.
    expect(s.turn.stages).toEqual([]);

    // Turn 2 adds to the decision without disturbing what turn 1 proved.
    s = reducer(s, status('discovery', 'started'));
    expect(completedStages(s)).toEqual(['requirement', 'understanding']);
    s = reducer(s, status('discovery', 'completed'));
    expect(completedStages(s)).toEqual([
      'discovery',
      'requirement',
      'understanding',
    ]);
  });

  it('never lets a completed rung go back to pending', () => {
    let s = fresh();
    s = reducer(s, user('u1'));
    s = reducer(s, status('discovery', 'started'));
    s = reducer(s, status('discovery', 'completed'));
    s = reducer(s, done);

    // Three more turns, none of them touching discovery.
    for (const id of ['u2', 'u3', 'u4']) {
      s = reducer(s, user(id));
      s = reducer(s, done);
      expect(completedStages(s)).toContain('discovery');
    }
  });

  it('resolves a rung left running when the turn ends', () => {
    let s = fresh();
    s = reducer(s, user('u1'));
    s = reducer(s, status('marketplace', 'started'));
    s = reducer(s, done);
    expect(s.decisionStages).toEqual([
      {
        stage: 'marketplace',
        state: 'completed',
        message: 'marketplace started',
      },
    ]);
  });

  it('marks a rung failed when the turn errors, and keeps the earlier ones', () => {
    let s = fresh();
    s = reducer(s, user('u1'));
    s = reducer(s, status('requirement', 'started'));
    s = reducer(s, status('requirement', 'completed'));
    s = reducer(s, status('discovery', 'started'));
    s = reducer(s, {
      type: 'turn-error',
      message: 'upstream died',
      committed: true,
    } as unknown as Action);

    const byStage = Object.fromEntries(
      s.decisionStages.map((e) => [e.stage, e.state])
    );
    expect(byStage).toEqual({ requirement: 'completed', discovery: 'failed' });
  });

  it('clears the ladder when the conversation changes', () => {
    let s = fresh();
    s = reducer(s, user('u1'));
    s = reducer(s, status('requirement', 'completed'));
    s = reducer(s, { type: 'reset', conversationId: 'c2' });
    expect(s.decisionStages).toEqual([]);
  });
});
