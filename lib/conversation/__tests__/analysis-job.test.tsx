import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  startAnalysisJob,
  streamAnalysisProgress,
  type AnalysisProgress,
} from '@/lib/api/analysis-job';
import { useAnalysisJob } from '@/lib/conversation/use-analysis-job';

/**
 * The detached analysis job — the path that replaced a turn that could not
 * finish.
 *
 * The turn path ran the same pipeline inside CHATBOT_TURN_DEADLINE, where the
 * window left for the evidence stages falls under both stages' viability
 * floors; the REC-NON gate then withheld the ranking on every decision, so no
 * `analysis` payload was ever written and the workspace had nothing to render.
 * These tests hold the replacement to the two things that make it work: the
 * progress stream is parsed correctly, and completion reloads history exactly
 * once.
 */

/** A ReadableStream of UTF-8 chunks, so we can split frames where we choose. */
function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function frame(event: Partial<AnalysisProgress>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the progress stream', () => {
  it('delivers each event in order', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      body: sseBody([
        frame({ stage: 5, pct: 52, label: 'Structuring preferences' }),
        frame({ stage: 8, pct: 88, label: 'Comparing & reasoning' }),
        frame({ stage: 9, pct: 100, label: 'Ready', result_ready: true }),
      ]),
    });

    const seen: AnalysisProgress[] = [];
    await streamAnalysisProgress('conv-1', (e) => seen.push(e));

    expect(seen.map((e) => e.pct)).toEqual([52, 88, 100]);
    expect(seen.at(-1)?.result_ready).toBe(true);
  });

  it('reassembles a frame split across network chunks', async () => {
    // A frame is not guaranteed to arrive whole. Parsing per chunk instead of
    // per frame drops exactly the events that land on a boundary — and the
    // completion event is as likely as any other to be the one that splits.
    fetchMock.mockResolvedValue({
      ok: true,
      body: sseBody([
        'data: {"stage":9,"pct":1',
        '00,"label":"Ready","result_ready":true}',
        '\n\n',
      ]),
    });

    const seen: AnalysisProgress[] = [];
    await streamAnalysisProgress('conv-1', (e) => seen.push(e));

    expect(seen).toHaveLength(1);
    expect(seen[0].result_ready).toBe(true);
  });

  it('skips a malformed frame without losing the ones around it', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      body: sseBody([
        frame({ stage: 1, pct: 10, label: 'One' }),
        'data: {not json\n\n',
        frame({ stage: 2, pct: 20, label: 'Two' }),
      ]),
    });

    const seen: AnalysisProgress[] = [];
    await streamAnalysisProgress('conv-1', (e) => seen.push(e));

    expect(seen.map((e) => e.label)).toEqual(['One', 'Two']);
  });

  it('ignores SSE comment and id lines', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      body: sseBody([
        ': keep-alive\n\n',
        `id: 7\ndata: ${JSON.stringify({ stage: 3, pct: 30, label: 'Three' })}\n\n`,
      ]),
    });

    const seen: AnalysisProgress[] = [];
    await streamAnalysisProgress('conv-1', (e) => seen.push(e));

    expect(seen).toHaveLength(1);
    expect(seen[0].label).toBe('Three');
  });
});

describe('starting a job', () => {
  it('unwraps the envelope', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { job_id: 'an_abc123' } }),
    });
    await expect(startAnalysisJob('conv-1')).resolves.toBe('an_abc123');
  });

  it('reports a refusal as no job rather than throwing', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({}),
    });
    await expect(startAnalysisJob('conv-1')).resolves.toBeNull();
  });
});

function Harness({ onReady }: { onReady: () => void }) {
  const job = useAnalysisJob('conv-1', onReady);
  return (
    <div>
      <button type="button" onClick={job.start}>
        run
      </button>
      <output data-testid="phase">{job.phase}</output>
      <output data-testid="pct">{job.progress?.pct ?? ''}</output>
      <output data-testid="error">{job.error ?? ''}</output>
    </div>
  );
}

describe('useAnalysisJob', () => {
  it('runs to completion and reloads history exactly once', async () => {
    const user = userEvent.setup();
    const onReady = vi.fn();
    fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { job_id: 'an_1' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        body: sseBody([
          frame({ stage: 8, pct: 88, label: 'Comparing' }),
          frame({ stage: 9, pct: 100, label: 'Ready', result_ready: true }),
        ]),
      });
    });

    render(<Harness onReady={onReady} />);
    await user.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() =>
      expect(screen.getByTestId('phase')).toHaveTextContent('done')
    );
    expect(screen.getByTestId('pct')).toHaveTextContent('100');
    // Once, not once per terminal signal: the stream also ENDS after the ready
    // event, and both paths call back.
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failure event with its retriable flag', async () => {
    const user = userEvent.setup();
    const onReady = vi.fn();
    fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { job_id: 'an_1' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        body: sseBody([
          frame({
            stage: 7,
            pct: 0,
            label: 'Search',
            error: 'the live search failed',
            retriable: true,
          }),
        ]),
      });
    });

    render(<Harness onReady={onReady} />);
    await user.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() =>
      expect(screen.getByTestId('phase')).toHaveTextContent('failed')
    );
    expect(screen.getByTestId('error')).toHaveTextContent(
      'the live search failed'
    );
    // A failed job STILL settled — the backend narrated its snag into the
    // thread mid-run, and only a reload lets the person read it. The caller
    // gets the outcome so it reloads without celebrating (no workspace open).
    expect(onReady).toHaveBeenCalledExactlyOnceWith('failed');
  });

  it('reports a refused start instead of hanging on "running"', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
    });

    render(<Harness onReady={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() =>
      expect(screen.getByTestId('phase')).toHaveTextContent('failed')
    );
  });

  it('ignores a second start while one is already running', async () => {
    const user = userEvent.setup();
    let posts = 0;
    fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') {
        posts += 1;
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { job_id: 'an_1' } }),
        });
      }
      // A stream that never ends, so the job stays running.
      return Promise.resolve({
        ok: true,
        body: new ReadableStream<Uint8Array>({ start() {} }),
      });
    });

    render(<Harness onReady={vi.fn()} />);
    const run = screen.getByRole('button', { name: 'run' });
    await user.click(run);
    await user.click(run);
    await user.click(run);

    await act(async () => {
      await Promise.resolve();
    });
    expect(posts).toBe(1);
  });
});
