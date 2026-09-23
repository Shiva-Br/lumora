import type { ChatMessage, MessageKind, Stage } from '@/lib/api/types';
import type { StageEntry } from '@/lib/conversation/use-conversation';

/**
 * Rebuild the stage ladder from what a conversation actually persisted.
 *
 * `turn.stages` is fed by LIVE `status` events, and a thread loaded from
 * history has none — so the ladder rendered every rung as pending while the
 * header, which reads the payloads, said "Decision ready · Step 9 of 9". Two
 * sources disagreeing about the same thing, and the one the eye lands on was
 * the wrong one.
 *
 * A payload is proof its stage ran: the backend commits each stage's output as
 * a message, so `candidates` in history means discovery ran, `marketplace`
 * means marketplace ran, and so on. Nothing is inferred beyond that — a rung
 * with no payload behind it stays dark, because a stage the workflow legally
 * skipped must not be drawn as finished.
 */

/** The message kind whose existence proves a stage ran. */
const PROOF: Partial<Record<Stage, MessageKind>> = {
  requirement: 'requirement',
  understanding: 'understanding',
  discovery: 'candidates',
  marketplace: 'marketplace',
  research: 'research',
  recommendation: 'recommendation',
  analysis: 'analysis',
};

/**
 * Stages that commit no payload of their own, proven by a later one instead.
 *
 * Selection is the gate `selectAndRecommend` opens with: any of the evidence
 * payloads existing means it ran. It gets no entry of its own in history, and
 * leaving it dark under three completed rungs would read as a hole in the
 * pipeline rather than the bookkeeping detail it is.
 */
const IMPLIED: Partial<Record<Stage, MessageKind[]>> = {
  selection: ['marketplace', 'research', 'recommendation', 'analysis'],
};

export function stagesFromHistory(messages: ChatMessage[]): StageEntry[] {
  const kinds = new Set<MessageKind>();
  let hasReply = false;
  for (const message of messages) {
    kinds.add(message.kind);
    if (message.role === 'assistant' && message.kind === 'text') {
      hasReply = true;
    }
  }

  const done = (stage: Stage): StageEntry => ({
    stage,
    state: 'completed',
    // Empty rather than invented: these entries carry position, not prose.
    // The live `message` is the backend's own line, and making one up here
    // would put words in its mouth on every reloaded thread.
    message: '',
  });

  const entries: StageEntry[] = [];
  for (const [stage, kind] of Object.entries(PROOF) as [Stage, MessageKind][]) {
    if (kinds.has(kind)) entries.push(done(stage));
  }
  for (const [stage, proofs] of Object.entries(IMPLIED) as [
    Stage,
    MessageKind[],
  ][]) {
    if (proofs.some((kind) => kinds.has(kind))) entries.push(done(stage));
  }
  // The reply is the one rung with no structured payload at all: an assistant
  // text message IS the response stage's output.
  if (hasReply) entries.push(done('response'));

  return entries;
}

/**
 * The ladder to render: history as the floor, live events on top.
 *
 * Live wins per stage because it is the only source that can say `started` or
 * `failed` — history only ever proves completion. Merging rather than choosing
 * keeps a mid-turn view correct (the running rung pulses over the finished
 * ones) without the reloaded view going blank.
 */
export function mergeStages(
  history: StageEntry[],
  live: StageEntry[]
): StageEntry[] {
  if (live.length === 0) return history;
  const byStage = new Map<Stage, StageEntry>();
  for (const entry of history) byStage.set(entry.stage, entry);
  for (const entry of live) byStage.set(entry.stage, entry);
  return [...byStage.values()];
}

/**
 * The rail's view of a RUNNING analysis job.
 *
 * The job reports on its own progress channel, not the conversation's turn
 * stream, so `decisionStages` never hears about it — without this mapping the
 * ladder froze for the minute or two the pipeline runs and then jumped to done
 * on the reload. Only the job's NAMED events are mapped, and only onto rungs
 * they directly prove; nothing here is inferred, so a stage the job skips or
 * loses stays exactly as dark as it should.
 */
const JOB_TYPE_RUNGS: Record<
  string,
  { stage: Stage; state: StageEntry['state']; message: string }[]
> = {
  // The structured profile is what the pipeline runs on.
  profile_ready: [{ stage: 'analysis', state: 'completed', message: '' }],
  // The message on a `started` rung feeds the rail headline, so it uses the
  // backend's own canonical line — the localizer already knows it.
  search_started: [
    {
      stage: 'discovery',
      state: 'started',
      message: 'Finding products that fit your needs',
    },
  ],
  candidates_ready: [{ stage: 'discovery', state: 'completed', message: '' }],
  // The evidence leg starts by selecting every finalist; a marketplace commit
  // proves both the gate and the stage.
  marketplace_ready: [
    { stage: 'selection', state: 'completed', message: '' },
    { stage: 'marketplace', state: 'completed', message: '' },
  ],
  comparison_ready: [
    {
      stage: 'recommendation',
      state: 'started',
      message: 'Preparing your recommendation',
    },
  ],
  results_ready: [{ stage: 'recommendation', state: 'completed', message: '' }],
};

export function stagesFromAnalysisJob(types: readonly string[]): StageEntry[] {
  const byStage = new Map<Stage, StageEntry>();
  for (const type of types) {
    for (const rung of JOB_TYPE_RUNGS[type] ?? []) {
      const current = byStage.get(rung.stage);
      // Completion never regresses to started within one job run.
      if (current?.state === 'completed' && rung.state === 'started') continue;
      byStage.set(rung.stage, { ...rung });
    }
  }
  return [...byStage.values()];
}
