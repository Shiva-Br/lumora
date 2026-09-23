'use client';

// The conversation state machine behind the Follow-up / chat screen.
//
// Everything the SSE contract requires lives here (frontend-integration.md):
//   - history load + replay (kind ↔ event 1:1, so live and loaded messages
//     share one shape and one renderer);
//   - turn streaming with per-stage status, prose deltas, and the two error
//     channels (HTTP before commit, `error` event after);
//   - the `new` conversation flow via POST /conversations/start, adopting the
//     id from the leading `conversation` event;
//   - duplicate-submit guarding, stale-stream cancellation, and the rule that
//     a failed-but-uncommitted send must hand the user's input back.
//
// UI-only concerns (choice selection, composer text) stay in the components.
import * as React from 'react';

import {
  getConversation,
  type ConversationDetail,
} from '@/lib/api/conversations';
import {
  stopGeneration,
  streamMessage,
  streamRegenerate,
  streamStart,
} from '@/lib/api/sse';
import type {
  CandidateSet,
  ChatMessage,
  DataEventKind,
  MarketplaceComparison,
  Recommendation,
  RequirementPayload,
  ResearchSet,
  Stage,
  StatusEvent,
  StoppedEvent,
  TimeoutEvent,
  ToolStatusEvent,
} from '@/lib/api/types';

export type LoadState =
  | { phase: 'loading' }
  | { phase: 'ready' }
  | { phase: 'error'; status: number; message: string };

export interface StageEntry {
  stage: Stage;
  state: 'started' | 'completed' | 'failed';
  message: string;
}

export interface TurnState {
  streaming: boolean;
  stages: StageEntry[];
  /** The assistant's streaming prose for the current turn. */
  draft: string;
  /** Mid-turn failure (the turn is over — no `done` will follow). */
  error: string | null;
  /** "fast" | "researching" — the backend's pace hint from the start event. */
  expect: string | null;
  /** Latest in-stage tool activity (advisory shimmer), null when quiet. */
  tool: string | null;
  /** Neutral end-of-turn notice (stopped / timed out) — not an error. */
  notice: string | null;
}

export interface SendInput {
  content: string;
  selectedProducts?: string[];

  qflowAnswers?: import('@/lib/api/types').QFlowAnswer[];
  qflowEditFrom?: string;
  confirmUnderstanding?: boolean;
}

export interface ConversationState {
  /** Real id once known; null while a `new` conversation has not started. */
  id: string | null;
  title: string;
  load: LoadState;
  messages: ChatMessage[];
  turn: TurnState;
  /**
   * The DECISION's stage ladder, cumulative across turns.
   *
   * `turn.stages` is per-turn by design — the in-thread "thinking" line is
   * about the turn running right now. The right-hand rail is not: it tracks
   * one decision from first question to final answer. Reading it off
   * `turn.stages` meant every new turn wiped the ladder, so rungs that had
   * genuinely completed went dark and then re-lit out of order as the next
   * turn re-announced them. Progress that moves backwards is worse than no
   * progress bar.
   *
   * Reset only when the conversation changes.
   */
  decisionStages: StageEntry[];
  /**
   * True between "a NEW decision just began" (a requirement stage opening
   * after the previous decision completed) and its requirement payload
   * landing. While set, the previous round's history must not light the
   * ladder — the person asked for something else entirely.
   */
  freshDecision: boolean;
  /**
   * Monotonic per-kind counters of LIVE data events this session (never
   * bumped by history hydration). Consumers key auto-open behavior on these
   * instead of payload identity or `turn.streaming` — a data event and the
   * turn terminal can land in one React batch, so streaming-state gates race.
   */
  dataSeq: Partial<Record<DataEventKind, number>>;
}

const IDLE_TURN: TurnState = {
  streaming: false,
  stages: [],
  draft: '',
  error: null,
  expect: null,
  tool: null,
  notice: null,
};

export type Action =
  | { type: 'reset'; conversationId: string | null }
  | { type: 'load-start' }
  | { type: 'load-success'; detail: ConversationDetail }
  | { type: 'load-error'; status: number; message: string }
  | { type: 'adopt-id'; id: string; title?: string }
  | { type: 'turn-start'; userMessage: ChatMessage; reopensDecision?: boolean }
  | { type: 'regen-start' }
  | { type: 'expect'; expect: string }
  | { type: 'tool'; label: string | null }
  | { type: 'status'; event: StatusEvent }
  | { type: 'data'; kind: DataEventKind; payload: unknown; id: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string }
  | { type: 'turn-error'; message: string; committed: boolean }
  | { type: 'turn-ended'; message: string }
  | { type: 'dismiss-turn-error' };

/**
 * Resolve any stage still marked `started` when a turn reaches its terminal.
 *
 * A stage left `started` renders as a pulsing dot, so leaving one behind after
 * the turn ends means an indicator that animates forever. What it settles TO
 * depends on how the turn ended, which is why the caller passes it: a
 * successful turn finished its work, a stopped or timed-out one did not.
 */
function settleStages(
  stages: StageEntry[],
  as: 'completed' | 'failed'
): StageEntry[] {
  return stages.map((s) => (s.state === 'started' ? { ...s, state: as } : s));
}

function applyStatus(stages: StageEntry[], event: StatusEvent): StageEntry[] {
  const existing = stages.findIndex((s) => s.stage === event.stage);
  const entry: StageEntry = {
    stage: event.stage,
    state: event.state,
    message: event.message,
  };
  if (existing === -1) return [...stages, entry];
  const next = stages.slice();
  next[existing] = entry;
  return next;
}

/** Human copy for the tool_status shimmer. Unknown tools show nothing. */
function toolLabel(event: ToolStatusEvent): string | null {
  if (event.state !== 'started') return null;
  const tool = event.tool.split('.').pop();
  switch (tool) {
    case 'shopping_search':
      return 'Checking live store listings…';
    case 'web_research':
      return 'Reading the web…';
    case 'compile_results':
      return 'Compiling results…';
    default:
      return null;
  }
}

function initialState(conversationId: string | null): ConversationState {
  return {
    id: conversationId,
    title: '',
    load: conversationId ? { phase: 'loading' } : { phase: 'ready' },
    messages: [],
    turn: IDLE_TURN,
    decisionStages: [],
    freshDecision: false,
    dataSeq: {},
  };
}

export function reducer(
  state: ConversationState,
  action: Action
): ConversationState {
  switch (action.type) {
    case 'reset':
      return initialState(action.conversationId);

    case 'load-start':
      return { ...state, load: { phase: 'loading' } };

    case 'load-success':
      return {
        ...state,
        id: action.detail.id || state.id,
        title: action.detail.title || state.title,
        load: { phase: 'ready' },
        messages: action.detail.messages,
      };

    case 'load-error':
      return {
        ...state,
        load: {
          phase: 'error',
          status: action.status,
          message: action.message,
        },
      };

    case 'adopt-id':
      return {
        ...state,
        id: action.id,
        title: action.title || state.title,
      };

    case 'turn-start':
      return {
        ...state,
        messages: [...state.messages, action.userMessage],
        turn: { ...IDLE_TURN, streaming: true },
        // An edit turn reopens the decision itself: the rungs the old answers
        // lit describe a pipeline the backend just invalidated, so the ladder
        // starts over with the collection it is actually in.
        decisionStages: action.reopensDecision ? [] : state.decisionStages,
      };

    case 'regen-start':
      // Regeneration re-runs the last exchange: no new user bubble.
      return { ...state, turn: { ...IDLE_TURN, streaming: true } };

    case 'expect':
      return { ...state, turn: { ...state.turn, expect: action.expect } };

    case 'tool':
      return { ...state, turn: { ...state.turn, tool: action.label } };

    case 'status': {
      // A requirement stage opening AFTER the decision finished is a NEW
      // decision — a fresh request typed into the same thread. The lit rungs
      // describe the previous one; carrying them forward showed "83%" on a
      // request the pipeline had not even classified yet. (A mid-collection
      // requirement event has no completed downstream rungs and resets
      // nothing; an edit turn already cleared the ladder at send.)
      const reopening =
        action.event.stage === 'requirement' &&
        (state.decisionStages.some(
          (entry) =>
            DOWNSTREAM_STAGES.has(entry.stage) && entry.state === 'completed'
        ) ||
          // A RELOADED finished thread has no live rungs at all — its lit
          // ladder comes from history. The round is just as finished, and a
          // requirement opening over it is just as much a new decision.
          roundHasDownstream(state.messages));
      const base = reopening ? [] : state.decisionStages;
      return {
        ...state,
        freshDecision: state.freshDecision || reopening,
        // The decision ladder accumulates; the turn ladder is this turn only.
        decisionStages: applyStatus(base, action.event),
        turn: {
          ...state.turn,
          stages: applyStatus(state.turn.stages, action.event),
          // A stage boundary supersedes any in-stage tool line.
          tool: action.event.state === 'started' ? state.turn.tool : null,
        },
      };
    }

    case 'data': {
      const message: ChatMessage = {
        id: action.id,
        conversation_id: state.id ?? '',
        role: 'assistant',
        kind: action.kind,
        content: '',
        payload: action.payload,
        created_at: new Date().toISOString(),
      };
      return {
        ...state,
        messages: [...state.messages, message],
        // The new decision's requirement payload is the new round boundary:
        // from here the history slice starts at it, and the floor is honest
        // again.
        freshDecision:
          action.kind === 'requirement' ? false : state.freshDecision,
        dataSeq: {
          ...state.dataSeq,
          [action.kind]: (state.dataSeq[action.kind] ?? 0) + 1,
        },
      };
    }

    case 'delta':
      return {
        ...state,
        turn: { ...state.turn, draft: state.turn.draft + action.text },
      };

    case 'done': {
      const messages = state.turn.draft
        ? [
            ...state.messages,
            {
              id: action.messageId,
              conversation_id: state.id ?? '',
              role: 'assistant' as const,
              kind: 'text' as const,
              content: state.turn.draft,
              created_at: new Date().toISOString(),
            },
          ]
        : state.messages;
      // The stage ladder is a RECORD of what the turn did, not a spinner. It
      // used to be cleared here along with the rest of the turn state, so the
      // panel emptied the instant the answer landed — the user watched two
      // rungs light up and then saw them vanish, which reads as "nothing
      // happened". It survives until the next turn replaces it.
      //
      // Anything still `started` at a successful terminal did finish: the turn
      // is over and it succeeded, so it settles as completed rather than
      // pulsing forever.
      return {
        ...state,
        messages,
        decisionStages: settleStages(state.decisionStages, 'completed'),
        turn: {
          ...IDLE_TURN,
          stages: settleStages(state.turn.stages, 'completed'),
        },
      };
    }

    case 'turn-error': {
      if (!state.turn.streaming) return state;

      // Not committed: roll the optimistic user bubble back — the hook's
      // onSendFailed callback hands the input back to the screen, so nothing
      // the user typed or selected is lost.
      if (!action.committed) {
        return {
          ...state,
          messages: state.messages.slice(0, -1),
          turn: { ...IDLE_TURN, error: action.message },
        };
      }

      // Committed: the user turn (and any partial reply) is persisted
      // server-side. Keep the partial prose, mark running stages failed.
      const messages = state.turn.draft
        ? [
            ...state.messages,
            {
              id: `partial-${state.messages.length}`,
              conversation_id: state.id ?? '',
              role: 'assistant' as const,
              kind: 'text' as const,
              content: state.turn.draft,
              created_at: new Date().toISOString(),
            },
          ]
        : state.messages;
      return {
        ...state,
        messages,
        decisionStages: settleStages(state.decisionStages, 'failed'),
        turn: {
          ...IDLE_TURN,
          error: action.message,
          stages: state.turn.stages.map((s) =>
            s.state === 'started' ? { ...s, state: 'failed' } : s
          ),
        },
      };
    }

    case 'turn-ended': {
      const messages = state.turn.draft
        ? [
            ...state.messages,
            {
              id: `partial-${state.messages.length}`,
              conversation_id: state.id ?? '',
              role: 'assistant' as const,
              kind: 'text' as const,
              content: state.turn.draft,
              created_at: new Date().toISOString(),
            },
          ]
        : state.messages;
      // Same record, different honesty: a turn that was stopped or timed out
      // did NOT finish what it was running, so those rungs settle as failed
      // rather than quietly claiming success.
      return {
        ...state,
        messages,
        decisionStages: settleStages(state.decisionStages, 'failed'),
        turn: {
          ...IDLE_TURN,
          notice: action.message,
          stages: settleStages(state.turn.stages, 'failed'),
        },
      };
    }

    case 'dismiss-turn-error':
      return { ...state, turn: { ...state.turn, error: null, notice: null } };

    default:
      return state;
  }
}

export interface UseConversationResult {
  /** History load state — `ready` immediately for a new conversation. */
  load: LoadState;
  /** The resolved conversation id (null until a new conversation starts). */
  id: string | null;
  title: string;
  messages: ChatMessage[];
  turn: TurnState;
  /** The decision's stage ladder, cumulative across the conversation's turns. */
  decisionStages: StageEntry[];
  /** A new decision opened and its requirement has not landed yet. */
  freshDecision: boolean;
  /** Latest structured payloads, for the insight panel and interactivity. */
  latestRequirement: RequirementPayload | null;
  candidates: CandidateSet | null;
  marketplace: MarketplaceComparison | null;
  research: ResearchSet | null;
  recommendation: Recommendation | null;
  /** Per-kind counters of LIVE data events (see ConversationState.dataSeq). */
  dataSeq: Partial<Record<DataEventKind, number>>;
  send: (input: SendInput) => void;
  /** Stop the running generation (no-op when idle). */
  stop: () => void;
  /** Regenerate the last reply (no-op while streaming or before any reply). */
  regenerate: () => void;
  dismissTurnError: () => void;
  reload: () => void;
}

/** Stages whose completed rung proves the previous decision ran its pipeline
 *  — the signal that a new requirement stage means a NEW round. */
const DOWNSTREAM_STAGES: ReadonlySet<string> = new Set([
  'discovery',
  'selection',
  'marketplace',
  'research',
  'recommendation',
  'analysis',
]);

/** Downstream payload kinds — a message of one proves its stage ran. */
const DOWNSTREAM_KINDS: ReadonlySet<string> = new Set([
  'candidates',
  'marketplace',
  'research',
  'recommendation',
  'analysis',
]);

/** Whether the CURRENT round (everything since the newest requirement
 *  message) already produced pipeline output — the history-side twin of the
 *  live downstream-rung check. */
function roundHasDownstream(messages: ChatMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const kind = messages[i].kind;
    if (DOWNSTREAM_KINDS.has(kind)) return true;
    if (kind === 'requirement') return false;
  }
  return false;
}

function latestPayload<T>(
  messages: ChatMessage[],
  kind: DataEventKind
): T | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.kind === kind && message.payload != null) {
      return message.payload as T;
    }
  }
  return null;
}

/**
 * Like latestPayload, but only within the CURRENT collection round.
 *
 * A `requirement` message is the boundary: the backend commits one whenever it
 * (re)opens the question flow, and an edit clears every stage output on the
 * session (candidates, evidence, recommendation). A payload behind the newest
 * requirement message was computed from answers the user has since reopened —
 * rendering it would revive exactly the stale result the edit invalidated,
 * keep the consent gate reading "already confirmed", and stop the analysis
 * button from starting a fresh run.
 */
export function freshPayload<T>(
  messages: ChatMessage[],
  kind: DataEventKind
): T | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.kind === kind && message.payload != null) {
      return message.payload as T;
    }
    if (message.kind === 'requirement') return null;
  }
  return null;
}

export function useConversation(options: {
  /**
   * A backend conversation id, or `null` for a brand-new thread. Changing it
   * aborts any live stream and resets the hook to the new thread — no remount
   * needed.
   */
  conversationId: string | null;
  /** Fired once when a new conversation gets its real id (update the URL). */
  onConversationCreated?: (id: string) => void;
  /** Fired when a turn fully completes (refresh the sidebar list). */
  onTurnDone?: () => void;
  /**
   * Fired when a send failed before the backend committed anything: the
   * optimistic bubble has been rolled back, and the screen should restore
   * this input so nothing the user typed or selected disappears.
   */
  onSendFailed?: (input: SendInput) => void;
}): UseConversationResult {
  const { conversationId, onConversationCreated, onTurnDone, onSendFailed } =
    options;

  const [state, dispatch] = React.useReducer(
    reducer,
    conversationId,
    initialState
  );

  // The live id is also needed synchronously inside the send path (the
  // `conversation` event adopts it mid-stream), so it is mirrored in a ref.
  const idRef = React.useRef<string | null>(conversationId);
  const streamingRef = React.useRef(false);
  const controllerRef = React.useRef<AbortController | null>(null);
  const eventSeqRef = React.useRef(0);
  /** True once the backend visibly accepted the current turn. */
  const committedRef = React.useRef(false);

  // Latest callbacks, without retriggering `send`'s identity.
  const createdCallbackRef = React.useRef(onConversationCreated);
  const doneCallbackRef = React.useRef(onTurnDone);
  const sendFailedCallbackRef = React.useRef(onSendFailed);
  React.useEffect(() => {
    createdCallbackRef.current = onConversationCreated;
    doneCallbackRef.current = onTurnDone;
    sendFailedCallbackRef.current = onSendFailed;
  }, [onConversationCreated, onTurnDone, onSendFailed]);

  const loadHistory = React.useCallback(async () => {
    const id = idRef.current;
    if (!id) return;
    dispatch({ type: 'load-start' });
    const result = await getConversation(id);
    // The hook survives thread switches now, so a slow response for a thread
    // the user already left must not hydrate the one they switched to.
    if (idRef.current !== id) return;
    if (result.ok) {
      dispatch({ type: 'load-success', detail: result.data });
    } else {
      dispatch({
        type: 'load-error',
        status: result.status,
        message: result.error,
      });
    }
  }, []);

  // Initial history load, and reset-and-rehydrate when the route points the
  // screen at a different thread. `idRef` follows adoption (a `new` thread
  // taking its real id mid-stream), so adoption is NOT a switch — only a real
  // navigation diverges from it. Loads are deliberately NOT aborted on Strict
  // Mode's simulated unmount — the GET is idempotent and guarded above.
  const hydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (conversationId !== idRef.current) {
      // Navigated to another thread: kill any live stream and start over.
      controllerRef.current?.abort();
      controllerRef.current = null;
      streamingRef.current = false;
      committedRef.current = false;
      idRef.current = conversationId;
      dispatch({ type: 'reset', conversationId });
      if (conversationId) void loadHistory();
    } else if (conversationId && !hydratedRef.current) {
      void loadHistory();
    }
    hydratedRef.current = true;
  }, [conversationId, loadHistory]);

  const send = React.useCallback((input: SendInput) => {
    const content = input.content.trim();
    const structured = Boolean(
      input.qflowAnswers?.length ||
      input.qflowEditFrom ||
      input.confirmUnderstanding
    );

    if ((!content && !structured) || streamingRef.current) return;

    streamingRef.current = true;
    committedRef.current = false;
    // Abort a stale stream if one is somehow still draining (safety net —
    // the guard above makes this unreachable in normal flows).
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const optimisticText =
      content ||
      (input.confirmUnderstanding
        ? 'Looks right — continue.'
        : input.qflowEditFrom
          ? 'Let me adjust an answer.'
          : 'Answers submitted.');
    const optimistic: ChatMessage = {
      id: `local-user-${Date.now()}`,
      conversation_id: idRef.current ?? '',
      role: 'user',
      kind: 'text',
      content: optimisticText,
      created_at: new Date().toISOString(),
    };
    dispatch({
      type: 'turn-start',
      userMessage: optimistic,
      reopensDecision: Boolean(input.qflowEditFrom),
    });

    // Switching threads aborts this stream; an event already decoded when the
    // abort lands must then be dropped, not applied to the next thread's state.
    const stale = () => controller.signal.aborted;

    const handlers = {
      onConversation: (id: string, title?: string) => {
        if (stale()) return;

        committedRef.current = true;
        if (!idRef.current) {
          idRef.current = id;
          dispatch({ type: 'adopt-id', id, title });
          createdCallbackRef.current?.(id);
        }
      },
      onStart: (event: { expect?: string }) => {
        if (stale()) return;
        committedRef.current = true;
        if (event.expect) dispatch({ type: 'expect', expect: event.expect });
      },
      onStatus: (event: StatusEvent) => {
        if (stale()) return;
        committedRef.current = true;
        dispatch({ type: 'status', event });
      },
      onTool: (event: ToolStatusEvent) => {
        if (stale()) return;
        dispatch({ type: 'tool', label: toolLabel(event) });
      },
      onDelta: (text: string) => {
        if (stale()) return;
        committedRef.current = true;
        dispatch({ type: 'delta', text });
      },
      onData: (kind: DataEventKind, payload: unknown) => {
        if (stale()) return;
        committedRef.current = true;
        eventSeqRef.current += 1;
        dispatch({
          type: 'data',
          kind,
          payload,
          id: `live-${kind}-${eventSeqRef.current}`,
        });
      },
      onDone: (event: { message_id: string }) => {
        if (stale()) return;
        streamingRef.current = false;
        dispatch({ type: 'done', messageId: event.message_id });
        doneCallbackRef.current?.();
      },
      onStopped: (event: StoppedEvent) => {
        if (stale()) return;
        streamingRef.current = false;
        dispatch({ type: 'turn-ended', message: event.message });
        doneCallbackRef.current?.();
      },
      onTimeout: (event: TimeoutEvent) => {
        if (stale()) return;
        streamingRef.current = false;
        dispatch({ type: 'turn-ended', message: event.message });
        doneCallbackRef.current?.();
      },
      onError: (message: string) => {
        if (stale()) return;
        streamingRef.current = false;
        const committed = committedRef.current;
        dispatch({ type: 'turn-error', message, committed });
        if (!committed) sendFailedCallbackRef.current?.(input);
      },
    };

    const body = {
      content,
      ...(input.qflowAnswers?.length
        ? { qflow_answers: input.qflowAnswers }
        : {}),
      ...(input.qflowEditFrom ? { qflow_edit_from: input.qflowEditFrom } : {}),
      ...(input.confirmUnderstanding ? { confirm_understanding: true } : {}),
      ...(input.selectedProducts?.length
        ? { selected_products: input.selectedProducts }
        : {}),
    };

    if (idRef.current) {
      void streamMessage(idRef.current, body, handlers, controller.signal);
    } else {
      void streamStart(body, handlers, controller.signal);
    }
  }, []);

  /** Stop the running generation; the stream delivers the terminal. */
  const stop = React.useCallback(() => {
    const id = idRef.current;
    if (!id || !streamingRef.current) return;
    void stopGeneration(id);
  }, []);

  /**
   * Regenerate the last reply: a standard turn stream with no new user
   * bubble. On done the history is reloaded — the superseded reply drops
   * out server-side and the fresh one takes its place with lineage.
   */
  const regenerate = React.useCallback(() => {
    const id = idRef.current;
    if (!id || streamingRef.current) return;

    streamingRef.current = true;
    committedRef.current = true; // the exchange already exists server-side
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    dispatch({ type: 'regen-start' });

    const stale = () => controller.signal.aborted;
    void streamRegenerate(
      id,
      {
        onStart: (event: { expect?: string }) => {
          if (stale()) return;
          if (event.expect) dispatch({ type: 'expect', expect: event.expect });
        },
        onStatus: (event: StatusEvent) => {
          if (stale()) return;
          dispatch({ type: 'status', event });
        },
        onTool: (event: ToolStatusEvent) => {
          if (stale()) return;
          dispatch({ type: 'tool', label: toolLabel(event) });
        },
        onDelta: (text: string) => {
          if (stale()) return;
          dispatch({ type: 'delta', text });
        },
        onData: (kind: DataEventKind, payload: unknown) => {
          if (stale()) return;
          eventSeqRef.current += 1;
          dispatch({
            type: 'data',
            kind,
            payload,
            id: `live-${kind}-${eventSeqRef.current}`,
          });
        },
        onDone: () => {
          if (stale()) return;
          streamingRef.current = false;
          // History is the source of truth after a regenerate: the old reply
          // is superseded server-side, so a reload swaps it for the new one.
          void loadHistory();
          dispatch({ type: 'done', messageId: `regen-${Date.now()}` });
          doneCallbackRef.current?.();
        },
        onStopped: (event: StoppedEvent) => {
          if (stale()) return;
          streamingRef.current = false;
          dispatch({ type: 'turn-ended', message: event.message });
        },
        onTimeout: (event: TimeoutEvent) => {
          if (stale()) return;
          streamingRef.current = false;
          dispatch({ type: 'turn-ended', message: event.message });
        },
        onError: (message: string) => {
          if (stale()) return;
          streamingRef.current = false;
          dispatch({ type: 'turn-error', message, committed: true });
        },
      },
      controller.signal
    );
  }, [loadHistory]);

  const latestRequirement = React.useMemo(
    () => latestPayload<RequirementPayload>(state.messages, 'requirement'),
    [state.messages]
  );
  const candidates = React.useMemo(
    () => freshPayload<CandidateSet>(state.messages, 'candidates'),
    [state.messages]
  );
  const marketplace = React.useMemo(
    () => freshPayload<MarketplaceComparison>(state.messages, 'marketplace'),
    [state.messages]
  );
  const research = React.useMemo(
    () => freshPayload<ResearchSet>(state.messages, 'research'),
    [state.messages]
  );
  const recommendation = React.useMemo(
    () => freshPayload<Recommendation>(state.messages, 'recommendation'),
    [state.messages]
  );

  return {
    load: state.load,
    id: state.id,
    title: state.title,
    messages: state.messages,
    turn: state.turn,
    decisionStages: state.decisionStages,
    freshDecision: state.freshDecision,
    latestRequirement,
    candidates,
    marketplace,
    research,
    recommendation,
    dataSeq: state.dataSeq,
    send,
    stop,
    regenerate,
    dismissTurnError: React.useCallback(
      () => dispatch({ type: 'dismiss-turn-error' }),
      []
    ),
    reload: React.useCallback(() => void loadHistory(), [loadHistory]),
  };
}
