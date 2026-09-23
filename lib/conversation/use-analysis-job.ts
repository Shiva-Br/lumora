'use client';

import * as React from 'react';

import {
  cancelAnalysisJob,
  startAnalysisJob,
  streamAnalysisProgress,
  type AnalysisProgress,
  type ProgressType,
} from '@/lib/api/analysis-job';

export type AnalysisJobPhase = 'idle' | 'running' | 'done' | 'failed';

export interface AnalysisJobState {
  phase: AnalysisJobPhase;
  /** Latest progress event, or null before the first one lands. */
  progress: AnalysisProgress | null;
  /**
   * Every named progress type seen so far, in arrival order. The latest event
   * alone cannot drive the activity rail — a rung completed by an earlier
   * event would go dark the moment the next one replaced it.
   */
  progressTypes: ProgressType[];
  /** User-safe failure text; null unless `phase` is 'failed'. */
  error: string | null;
  /** Whether a failure is worth offering a retry for. */
  retriable: boolean;

  counts: { scanned?: number; finalists?: number; marketplaces?: number };
  /**
   * What a finished run actually produced. 'result' is a decision; a
   * 'no_results' run ended cleanly with nothing to show — the stream
   * terminated either way, and only the caller's celebration differs.
   */
  outcome: 'result' | 'no_results' | null;
}

const IDLE: AnalysisJobState = {
  phase: 'idle',
  progress: null,
  progressTypes: [],
  error: null,
  retriable: false,
  counts: {},
  outcome: null,
};

/**
 * Runs the decision pipeline as a detached job and reports its progress.
 *
 * Deliberately NOT a turn. The turn path cannot fund the evidence stages inside
 * CHATBOT_TURN_DEADLINE, so it ends with the recommendation withheld every
 * time; the job has no deadline and commits the `recommendation` and `analysis`
 * payloads the workspace renders.
 *
 * `onReady` fires once per completed job. The job persists its stages as real
 * messages, so the caller's job is simply to reload history — the payloads are
 * already there.
 */
export function useAnalysisJob(
  conversationId: string | null,
  onReady: (outcome: 'result' | 'no_results' | 'failed') => void
) {
  const [state, setState] = React.useState<AnalysisJobState>(IDLE);
  const abortRef = React.useRef<AbortController | null>(null);
  const runningRef = React.useRef(false);

  // Both refs exist so `start` can stay stable — a callback identity change
  // must never be able to restart a running job. They are written in effects
  // rather than during render, which the refs rule forbids and which would be
  // wrong anyway under concurrent rendering (a render that is thrown away
  // would still have moved the ref).
  const readyRef = React.useRef(onReady);
  React.useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  const idRef = React.useRef(conversationId);
  React.useEffect(() => {
    idRef.current = conversationId;
  }, [conversationId]);

  // A thread change abandons the previous thread's stream. The job itself
  // keeps running server-side, and reattaches when that thread is reopened.
  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      runningRef.current = false;
    };
  }, [conversationId]);

  const consume = React.useCallback((id: string) => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    runningRef.current = true;
    setState({ ...IDLE, phase: 'running' });

    let settled = false;
    void streamAnalysisProgress(
      id,
      (event) => {
        if (controller.signal.aborted) return;
        if (event.error) {
          settled = true;
          runningRef.current = false;
          setState((current) => ({
            phase: 'failed',
            progress: event,
            progressTypes: current.progressTypes,
            error: event.error ?? null,
            retriable: Boolean(event.retriable),
            counts: current.counts,
            outcome: current.outcome,
          }));
          // A failed run still settled: the backend narrated its snag into
          // the thread mid-job, and only a reload lets the person read it.
          readyRef.current('failed');
          return;
        }
        const outcome = event.result_ready
          ? event.type === 'no_results'
            ? ('no_results' as const)
            : ('result' as const)
          : null;
        setState((current) => ({
          phase: event.result_ready ? 'done' : 'running',
          progress: event,
          progressTypes:
            event.type && !current.progressTypes.includes(event.type)
              ? [...current.progressTypes, event.type]
              : current.progressTypes,
          error: null,
          retriable: false,
          counts: event.counts
            ? { ...current.counts, ...event.counts }
            : current.counts,
          outcome: outcome ?? current.outcome,
        }));
        if (event.result_ready && !settled) {
          settled = true;
          runningRef.current = false;
          readyRef.current(outcome ?? 'result');
        }
      },
      controller.signal
    ).then(() => {
      if (controller.signal.aborted || settled) return;
      // The stream ended without a terminal event. The job may still be alive
      // — reloading history is the honest recovery either way, since it shows
      // whatever actually persisted rather than a guess about the job.
      runningRef.current = false;
      settled = true;
      setState((current) =>
        current.phase === 'running'
          ? { ...current, phase: 'done', outcome: current.outcome ?? 'result' }
          : current
      );
      // A dropped final frame on an otherwise live stream: bias to the
      // previous behavior and let the reload show whatever persisted.
      readyRef.current('result');
    });
  }, []);

  /** Start the pipeline. A second call while one runs is ignored. */
  const start = React.useCallback(() => {
    const id = idRef.current;
    if (!id || runningRef.current) return;
    runningRef.current = true;
    setState({ ...IDLE, phase: 'running' });
    void startAnalysisJob(id).then((jobId) => {
      if (!jobId) {
        runningRef.current = false;
        setState({
          ...IDLE,
          phase: 'failed',
          error: 'Lumora could not start the analysis. Try again.',
          retriable: true,
        });
        return;
      }
      consume(id);
    });
  }, [consume]);

  /** Attach to a job already running on this thread, without starting one. */
  const attach = React.useCallback(() => {
    const id = idRef.current;
    if (!id || runningRef.current) return;
    consume(id);
  }, [consume]);

  const cancel = React.useCallback(() => {
    const id = idRef.current;
    abortRef.current?.abort();
    abortRef.current = null;
    runningRef.current = false;
    setState(IDLE);
    if (id) void cancelAnalysisJob(id);
  }, []);

  return { ...state, start, attach, cancel };
}
