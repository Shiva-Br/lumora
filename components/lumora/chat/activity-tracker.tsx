'use client';

import { ChevronDown } from 'lucide-react';
import * as React from 'react';

import { localizeStatus } from '@/components/lumora/chat/stage-status';
import { SpaceCanvas } from '@/components/lumora/shell/space-canvas';
import type { QuestionFlow, UnderstandingPayload } from '@/lib/api/types';
import type { StageEntry } from '@/lib/conversation/use-conversation';
import { useLocale } from '@/lib/i18n/provider';
import type { WorldContext } from '@/lib/taxonomy/resolve';
import { cn } from '@/lib/utils';

const STAGE_LADDER = [
  { id: 'understanding', key: 'ladder.understanding' },
  { id: 'requirement', key: 'ladder.requirement' },
  { id: 'analysis', key: 'ladder.analysis' },
  { id: 'selection', key: 'ladder.selection' },
  { id: 'discovery', key: 'ladder.discovery' },
  { id: 'marketplace', key: 'ladder.marketplace' },
  { id: 'research', key: 'ladder.research' },
  { id: 'recommendation', key: 'ladder.recommendation' },
  { id: 'response', key: 'ladder.response' },
] as const;

export type ActivityWaiting = 'answers' | 'confirmation' | null;

/**
 * One locally answered (or skipped) flow question, previewed in Known factors
 * before the backend echo. Factor text comes from the flow payload itself —
 * nothing here is frontend-invented.
 */
export interface FactorPreview {
  /** FlowQuestion.id — the reconciliation key against `flow.answered`. */
  id: string;
  /** FlowQuestion.factor — the chip text, verbatim from the payload. */
  factor: string;
  skipped: boolean;
}

export function ActivityPanel({
  stages,
  streaming,
  tool,
  waiting,
  ready,
  world,
  flow,
  understanding,
  preview,
  knownTargetRef,
}: {
  stages: StageEntry[];
  streaming: boolean;
  /** In-stage tool activity line, when the backend reports one. */
  tool: string | null;
  /** The workflow's real pause: on the user's answers or confirmation. */
  waiting: ActivityWaiting;
  /** A recommendation/analysis has arrived — the decision is ready. */
  ready: boolean;
  /** The active Decision World, for the viz tint and the factors card. */
  world: WorldContext | null;
  /** The newest question flow — its factors feed the Decision Factors card. */
  flow: QuestionFlow | null;
  /** The latest understanding payload, when the backend has structured one. */
  understanding: UnderstandingPayload | null;
  /** Locally answered questions, shown in Known factors ahead of the echo. */
  preview?: FactorPreview[];
  /** Flight/glow target for the answer-tag transition (design `rpw-body`). */
  knownTargetRef?: React.Ref<HTMLDivElement>;
}) {
  const { t, locale } = useLocale();

  const [factorsCollapsed, setFactorsCollapsed] = React.useState(false);
  const byStage = new Map(stages.map((s) => [s.stage as string, s]));
  const running = stages.filter((s) => s.state === 'started').at(-1);
  const doneCount = STAGE_LADDER.filter(
    (rung) => byStage.get(rung.id)?.state === 'completed'
  ).length;
  const progress = Math.min(
    1,
    (doneCount + (running ? 0.5 : 0)) / STAGE_LADDER.length
  );
  const activeStep =
    STAGE_LADDER.findIndex((rung) => rung.id === running?.stage) + 1;

  const status = streaming
    ? t('activity.working')
    : waiting === 'answers'
      ? t('activity.waitingAnswers')
      : waiting === 'confirmation'
        ? t('activity.waitingConfirm')
        : ready
          ? t('activity.decisionReady')
          : t('activity.readyWhenYouAre');

  // The running stage's own message comes from the backend in English; the
  // closed-vocabulary lookup mirrors it into the thread language.
  const headline = streaming
    ? localizeStatus(
        running?.message ?? t('activity.working'),
        locale === 'fa' ? 'fa' : 'en'
      )
    : ready
      ? t('activity.readyForComparison')
      : status;

  // Decision factors stay backend-authored. The flow tells us which factors
  // are still open; once understanding lands, its DNA/priorities/trade-off
  // become the richer right-rail view from the theme.
  //
  // `preview` is the one optimistic layer: a question the user just answered
  // locally counts as resolved NOW, keyed by the same question id the backend
  // will echo in `flow.answered` — so the merge is per-question and a chip
  // can never duplicate when the echo arrives.
  const answered = flow?.answered ?? {};
  const skipped = flow?.skipped ?? [];
  const previewIds = new Set((preview ?? []).map((p) => p.id));
  const isResolved = (id: string) =>
    answered[id] !== undefined || skipped.includes(id) || previewIds.has(id);
  const knownFactors = understanding?.dna?.length
    ? [
        ...understanding.dna.map((d) => d.factor),
        // A fresh local answer during an adjust round still previews.
        ...(preview ?? []).map((p) => p.factor),
      ]
    : (flow?.questions.filter((q) => isResolved(q.id)).map((q) => q.factor) ??
      []);
  const known = Array.from(new Set(knownFactors));
  const needed =
    flow?.questions.filter((q) => !isResolved(q.id)).map((q) => q.factor) ?? [];
  const priorities = understanding?.inferred_priorities ?? [];
  const tradeoff = understanding?.tradeoff ?? null;
  const readyProfile =
    Boolean(understanding?.confirmed) ||
    (known.length > 0 && needed.length === 0);

  return (
    <aside
      aria-label={t('activity.live')}
      className="bg-linear-[270deg,rgba(249, 248, 242, 0.6),rgba(249, 248, 242, 0)] flex h-full min-h-0 flex-col overflow-hidden border-l border-[rgba(120,150,180,0.07)]"
    >
      {/* Header — pulse dot, title, live status. */}
      <div className="flex flex-none items-start gap-2.5 px-5 pt-6 pb-2.5">
        <span
          aria-hidden="true"
          className={
            streaming
              ? 'mt-[5px] h-[7px] w-[7px] flex-none animate-pulse rounded-full bg-[#28765c] shadow-[0_0_10px_rgba(246,192,121,0.9)]'
              : 'mt-[5px] h-[7px] w-[7px] flex-none rounded-full bg-[#28765c] opacity-70'
          }
        />
        <div className="min-w-0">
          <div className="text-sm leading-[1.2] font-bold text-[#243b32]">
            Decision Activity
          </div>
          <div
            aria-live="polite"
            className="mt-[3px] truncate text-[11.5px] text-[var(--vk-note)]"
          >
            {status}
          </div>
        </div>
      </div>

      {/* The viz — a contained starfield leaning toward the world's tone.
          Plain, like the theme's canvas box: the status line lives in the
          `rp-spec` readout below, not painted over the viz. */}
      <div className="relative mx-4 h-[130px] flex-none overflow-hidden rounded-2xl border border-[rgba(150,178,205,0.08)] bg-radial-[80%_90%_at_50%_40%,#f4f2ee,#f6f4f1_70%,#f7f5f2] [&>.vk-space]:absolute!">
        <SpaceCanvas mood={world?.world.tone ?? null} />
      </div>

      <div className="min-h-0 flex-1 [scrollbar-width:thin] overflow-y-auto px-4 pt-3 pb-5">
        {/* The honest activity readout — the theme's `rp-spec`, the block it
            renders for a real activated decision: the current stage and the
            gold percent share a line, the 4px gold bar beneath, the step
            position, then every ladder rung as a quiet 7px-dot row. The
            percent is the ladder position itself — real stage events, never
            an invented figure. */}
        <div className="px-1 pt-0.5 pb-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[12.5px] text-[var(--vk-text)]">
              {headline}
            </span>
            <span className="flex-none text-[12.5px] font-semibold text-[var(--vk-gold-soft)] tabular-nums">
              {Math.round(progress * 100)}%
            </span>
          </div>
          <div className="mt-2 mb-1 h-1 overflow-hidden rounded-[3px] bg-[rgba(150,178,205,0.14)]">
            <div
              className="h-full rounded-[3px] bg-linear-[90deg,#348568,#28765c] transition-[width] duration-600 ease-out"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <div className="mb-2 text-[10.5px] text-[var(--vk-note-quiet)]">
            {/* Counts what actually ran. It used to jump to "Step 9 of 9" on
                `ready` alone — so a decision that finished with stages legally
                skipped still claimed all nine, and a reloaded thread claimed
                nine while every rung below it sat dark. */}
            {activeStep > 0
              ? t('activity.stepOf', {
                  step: activeStep,
                  total: STAGE_LADDER.length,
                })
              : doneCount > 0
                ? t('activity.stepOf', {
                    step: doneCount,
                    total: STAGE_LADDER.length,
                  })
                : ' '}
          </div>
          {/* The in-stage tool line — this client's honest extra; the
              prototype had no live tool feed to show. */}
          {tool && (
            <div className="mb-2 truncate text-[10.5px] text-[var(--vk-text-muted)]">
              {tool}
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            {STAGE_LADDER.map((rung) => {
              const state = byStage.get(rung.id)?.state;
              const done = state === 'completed';
              const active = state === 'started';
              return (
                <div
                  key={rung.id}
                  className={cn(
                    'flex items-center gap-2 py-[3px] text-[11.5px]',
                    active
                      ? 'text-[var(--vk-text)]'
                      : done
                        ? 'text-[var(--vk-text-muted)]'
                        : 'text-[var(--vk-note-quiet)]'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-[7px] w-[7px] flex-none rounded-full border-[1.5px]',
                      done
                        ? 'border-[var(--vk-gold)] bg-[var(--vk-gold)]'
                        : active
                          ? 'border-[var(--vk-gold)] shadow-[0_0_0_3px_rgba(242,193,78,0.18)]'
                          : state === 'failed'
                            ? 'border-[var(--vk-warning)]'
                            : 'border-[var(--vk-note-quiet)]'
                    )}
                  />
                  <span className="min-w-0 truncate">{t(rung.key)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Decision Factors — real profile state from the question flow. */}
        {world && flow && flow.questions.length > 0 && (
          <div
            ref={knownTargetRef}
            className="mt-3 rounded-xl border border-[rgba(150,178,205,0.1)] bg-[rgba(255,255,255,0.012)] p-3.5"
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-[7px] w-[7px] flex-none rounded-full bg-[var(--vk-gold)] shadow-[0_0_10px_rgba(242,193,78,0.7)]"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-[var(--vk-text-strong)]">
                  {world.world.name}
                </div>
                <div className="text-[10px] font-bold tracking-[0.14em] text-[var(--vk-text-muted)] uppercase">
                  Decision Factors
                </div>
              </div>
              {/* Design `rpw-collapse`: 30px chevron, flips when folded. */}
              <button
                type="button"
                aria-expanded={!factorsCollapsed}
                aria-label={
                  // Untranslated, and static: it said "Collapse" even when
                  // folded, so the one control a screen-reader user has here
                  // announced the opposite of what pressing it would do.
                  factorsCollapsed
                    ? t('activity.expandFactors')
                    : t('activity.collapseFactors')
                }
                onClick={() => setFactorsCollapsed((c) => !c)}
                className="grid h-[30px] w-[30px] flex-none cursor-pointer place-items-center rounded-lg border border-[var(--vk-border)] bg-transparent text-[var(--vk-text-muted)] transition-colors outline-none hover:bg-[rgba(150,178,205,0.08)] hover:text-[var(--vk-text-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent)]"
              >
                <ChevronDown
                  size={17}
                  strokeWidth={2}
                  aria-hidden="true"
                  className={
                    factorsCollapsed
                      ? 'rotate-180 transition-transform duration-250'
                      : 'transition-transform duration-250'
                  }
                />
              </button>
            </div>
            <div hidden={factorsCollapsed}>
              {world.category && (
                <div className="mt-2 truncate text-[11px] text-[var(--vk-note)]">
                  {world.category}
                  {world.sub ? ` › ${world.sub}` : ''}
                </div>
              )}

              <div className="mt-3 text-[10px] font-bold tracking-[0.14em] text-[var(--vk-note-quiet)] uppercase">
                Known factors
              </div>
              {known.length === 0 ? (
                <div className="mt-1.5 text-[12px] text-[var(--vk-note-quiet)]">
                  —
                </div>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {/* Keyed by factor: a chip mounts (and animates) exactly once
                    — the backend echo reuses the same key, so reconciliation
                    is invisible. */}
                  {known.map((factor) => (
                    <span
                      key={factor}
                      className="vk-chip-in inline-flex items-center gap-1.5 rounded-lg border border-[rgba(242,193,78,0.22)] bg-[rgba(242,193,78,0.06)] px-2 py-1 text-[11.5px] text-[var(--vk-gold-soft)]"
                    >
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-[var(--vk-gold)] shadow-[0_0_6px_rgba(242,193,78,0.6)]"
                      />
                      {factor}
                    </span>
                  ))}
                </div>
              )}
              {known.length > 0 && needed.length === 0 && (
                <div className="mt-2 text-[10.5px] text-[var(--vk-note)]">
                  All gathered
                </div>
              )}

              {needed.length > 0 && (
                <>
                  <div className="mt-3 text-[10px] font-bold tracking-[0.14em] text-[var(--vk-note-quiet)] uppercase">
                    Still needed
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {needed.map((factor) => (
                      <span
                        key={factor}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(150,178,205,0.12)] bg-[rgba(150,178,205,0.05)] px-2 py-1 text-[11.5px] text-[var(--vk-text-muted)]"
                      >
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-[var(--vk-note-quiet)]"
                        />
                        {factor}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2.5 text-[10.5px] text-[var(--vk-note-quiet)]">
                    Gathering profile…
                  </div>
                </>
              )}

              {priorities.length > 0 && (
                <>
                  <div className="mt-3 text-[10px] font-bold tracking-[0.14em] text-[var(--vk-note-quiet)] uppercase">
                    Inferred priorities
                  </div>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {priorities.map((priority) => (
                      <div
                        key={priority.label}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(242,193,78,0.22)] bg-[rgba(242,193,78,0.05)] px-2.5 py-1.5 text-[11.5px] text-[var(--vk-text-subtle)]"
                      >
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-[var(--vk-gold)]"
                        />
                        {priority.label}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {(tradeoff?.sentence ||
                tradeoff?.prefer?.length ||
                tradeoff?.give_up?.length) && (
                <>
                  <div className="mt-3 text-[10px] font-bold tracking-[0.14em] text-[var(--vk-note-quiet)] uppercase">
                    Trade-off
                  </div>
                  <div className="mt-1.5 rounded-xl border border-[rgba(150,178,205,0.12)] bg-[rgba(150,178,205,0.04)] px-3 py-2.5 text-[11.5px] text-[var(--vk-text-subtle)]">
                    {tradeoff?.prefer?.length || tradeoff?.give_up?.length ? (
                      <div className="mb-1.5 flex flex-wrap items-start gap-x-3 gap-y-1 text-[11px]">
                        {tradeoff?.prefer?.length ? (
                          <span className="text-[var(--vk-text-muted)]">
                            <span className="text-[var(--vk-gold-soft)]">
                              Prefer:
                            </span>{' '}
                            {tradeoff.prefer.join(' + ')}
                          </span>
                        ) : null}
                        {tradeoff?.give_up?.length ? (
                          <span className="text-[var(--vk-text-muted)]">
                            <span className="text-[var(--vk-gold-soft)]">
                              Give up:
                            </span>{' '}
                            {tradeoff.give_up.join(' + ')}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {tradeoff?.sentence && (
                      <div className="leading-[1.55]">{tradeoff.sentence}</div>
                    )}
                  </div>
                </>
              )}

              {readyProfile && (
                <div className="mt-2.5 text-[11px] text-[var(--vk-gold-soft)]">
                  ✓ Profile ready
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
