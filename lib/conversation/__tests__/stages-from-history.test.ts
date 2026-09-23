import { describe, expect, it } from 'vitest';

import type { ChatMessage, MessageKind, Stage } from '@/lib/api/types';
import * as jobApi from '@/lib/conversation/stages-from-history';
import {
  mergeStages,
  stagesFromHistory,
} from '@/lib/conversation/stages-from-history';
import type { StageEntry } from '@/lib/conversation/use-conversation';

/**
 * The Decision Activity ladder, rebuilt from what a thread actually persisted.
 *
 * `turn.stages` carries only THIS session's live `status` events, so a thread
 * opened from history rendered nine pending rungs underneath a header that
 * already read "Decision ready · Step 9 of 9". The panel contradicted itself,
 * and the half a person's eye lands on was the wrong half.
 */

function msg(kind: MessageKind, role: 'assistant' | 'user' = 'assistant') {
  return { id: `m-${kind}-${role}`, role, kind } as unknown as ChatMessage;
}

const completed = (entries: StageEntry[]) => entries.map((e) => e.stage).sort();

describe('stagesFromHistory', () => {
  it('lights nothing for a thread that has only prose', () => {
    // A general-conversation turn ran no pipeline stage but did reply.
    expect(
      completed(stagesFromHistory([msg('text', 'user'), msg('text')]))
    ).toEqual(['response']);
  });

  it('lights nothing at all for an empty thread', () => {
    expect(stagesFromHistory([])).toEqual([]);
  });

  it('rebuilds the real mid-flow shape: requirement → understanding → candidates', () => {
    // Exactly the production conversation that prompted this: the flow paused
    // after discovery, so the evidence stages must stay dark.
    const got = completed(
      stagesFromHistory([
        msg('text', 'user'),
        msg('requirement'),
        msg('understanding'),
        msg('candidates'),
        msg('text'),
      ])
    );
    expect(got).toEqual([
      'discovery',
      'requirement',
      'response',
      'understanding',
    ]);
    expect(got).not.toContain('marketplace');
    expect(got).not.toContain('recommendation');
  });

  it('rebuilds a finished decision', () => {
    const got = completed(
      stagesFromHistory(
        (
          [
            'requirement',
            'understanding',
            'candidates',
            'research',
            'marketplace',
            'recommendation',
            'analysis',
            'text',
          ] as MessageKind[]
        ).map((k) => msg(k))
      )
    );
    // Every rung on the ladder, and nothing beyond it.
    expect(got).toEqual([
      'analysis',
      'discovery',
      'marketplace',
      'recommendation',
      'requirement',
      'research',
      'response',
      'selection',
      'understanding',
    ]);
  });

  it('infers selection from any evidence payload, never on its own', () => {
    // Selection commits no payload; it is the gate selectAndRecommend opens
    // with, so an evidence payload is its proof.
    expect(completed(stagesFromHistory([msg('marketplace')]))).toContain(
      'selection'
    );
    expect(completed(stagesFromHistory([msg('candidates')]))).not.toContain(
      'selection'
    );
  });

  it('needs an ASSISTANT reply for the response rung', () => {
    // A user message is not a reply. Counting it would light the last rung on
    // a turn that never answered.
    expect(completed(stagesFromHistory([msg('text', 'user')]))).toEqual([]);
  });

  it('carries no invented message text', () => {
    // These entries exist to place a rung, not to speak for the backend.
    for (const entry of stagesFromHistory([msg('candidates')])) {
      expect(entry.message).toBe('');
      expect(entry.state).toBe('completed');
    }
  });
});

describe('mergeStages', () => {
  const history: StageEntry[] = [
    { stage: 'requirement', state: 'completed', message: '' },
    { stage: 'discovery', state: 'completed', message: '' },
  ];

  it('returns history untouched when no turn is live', () => {
    expect(mergeStages(history, [])).toEqual(history);
  });

  it('lets a live stage win over the same stage from history', () => {
    // Only live events can say "started" or "failed"; history only ever proves
    // completion, so a rerunning stage must not be frozen as done.
    const live: StageEntry[] = [
      { stage: 'discovery', state: 'started', message: 'Finding products' },
    ];
    const merged = mergeStages(history, live);
    const discovery = merged.find((e) => e.stage === 'discovery');
    expect(discovery?.state).toBe('started');
    expect(discovery?.message).toBe('Finding products');
  });

  it('keeps the rungs history proved that the live turn has not reached', () => {
    const live: StageEntry[] = [
      { stage: 'marketplace', state: 'started', message: 'Comparing' },
    ];
    const merged = mergeStages(history, live);
    const stages = merged.map((e) => e.stage) as Stage[];
    expect(stages).toContain('requirement');
    expect(stages).toContain('discovery');
    expect(stages).toContain('marketplace');
  });

  it('reports each stage exactly once', () => {
    const live: StageEntry[] = [
      { stage: 'discovery', state: 'started', message: 'x' },
      { stage: 'requirement', state: 'completed', message: 'y' },
    ];
    const stages = mergeStages(history, live).map((e) => e.stage);
    expect(new Set(stages).size).toBe(stages.length);
  });
});

describe('stagesFromAnalysisJob', () => {
  // The detached job reports on its own channel, not the turn stream, so the
  // rail hears nothing from `decisionStages` while it runs. These map the
  // job's NAMED events onto the rungs they directly prove — and nothing else.
  const { stagesFromAnalysisJob } = jobApi;

  it('maps an empty run to an empty ladder', () => {
    expect(stagesFromAnalysisJob([])).toEqual([]);
  });

  it('walks the happy path in rungs', () => {
    const stages = stagesFromAnalysisJob([
      'profile_ready',
      'search_started',
      'candidates_ready',
      'marketplace_ready',
      'comparison_ready',
      'results_ready',
    ]);
    const byStage = Object.fromEntries(stages.map((s) => [s.stage, s.state]));
    expect(byStage).toEqual({
      analysis: 'completed',
      discovery: 'completed',
      selection: 'completed',
      marketplace: 'completed',
      recommendation: 'completed',
    });
  });

  it('shows a mid-run truthfully: discovery running, nothing beyond it', () => {
    const stages = stagesFromAnalysisJob(['profile_ready', 'search_started']);
    const discovery = stages.find((s) => s.stage === 'discovery');
    expect(discovery?.state).toBe('started');
    // The started rung carries the backend's own line for the rail headline.
    expect(discovery?.message).toBe('Finding products that fit your needs');
    expect(stages.some((s) => s.stage === 'marketplace')).toBe(false);
  });

  it('never regresses a completed rung to started', () => {
    // A replayed stream can deliver types out of order; completion wins.
    const stages = stagesFromAnalysisJob([
      'candidates_ready',
      'search_started',
    ]);
    expect(stages.find((s) => s.stage === 'discovery')?.state).toBe(
      'completed'
    );
  });

  it('ignores types it has no rung for', () => {
    expect(stagesFromAnalysisJob(['failure', 'cancellation'])).toEqual([]);
  });
});
