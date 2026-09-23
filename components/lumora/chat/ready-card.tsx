'use client';

import { Check, Info, Sparkles } from 'lucide-react';
import * as React from 'react';

import { ScoreBar } from '@/components/lumora/chat/score-bar';
import type { RequirementPayload } from '@/lib/api/types';
import { useT } from '@/lib/i18n/provider';
import { cn } from '@/lib/utils';

function ConstraintChip({
  label,
  constraint,
}: {
  label: string;
  constraint: 'hard' | 'preference';
}) {
  return (
    <span
      className={cn(
        'rounded-full border px-[11px] py-[5px] text-xs break-words',
        constraint === 'hard'
          ? 'border-[rgba(232,137,46,0.38)] bg-[rgba(232,137,46,0.10)] font-semibold text-[var(--vk-gold-soft)]'
          : 'border-[rgba(150,178,205,0.2)] bg-[rgba(150,178,205,0.06)] text-[var(--vk-text-subtle)]'
      )}
    >
      {label}
    </span>
  );
}

export function ReadyCard({
  payload,
  onOpenAnalysis,
}: {
  payload: RequirementPayload;
  /** Present once there is something to analyse (candidates arrived). */
  onOpenAnalysis?: () => void;
}) {
  const t = useT();
  const summary = payload.summary;
  const [explanationOpen, setExplanationOpen] = React.useState(false);

  if (!summary) return null;

  const confidencePct = Math.round(
    Math.min(1, Math.max(0, summary.requirement_confidence)) * 100
  );

  return (
    <section
      aria-label={t('chat.matchesReady')}
      className="vk-ready bg-linear-[135deg,rgba(232,137,46,0.12),rgba(249, 248, 242, 0.94)_48%] shadow-[0_22px_50px_rgba(249, 248, 242, 0.24)] relative mt-3 overflow-hidden rounded-[18px] border border-[rgba(232,137,46,0.34)] p-4"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-16 h-[180px] w-[180px] rounded-full bg-[rgba(242,193,78,0.14)] blur-2xl"
      />

      <h2 className="relative z-[1] m-0 flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.015em] text-[var(--vk-text-strong)]">
        <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-[rgba(95,168,107,0.3)] bg-[rgba(95,168,107,0.18)] text-[#D9F2DE]">
          <Check size={14} strokeWidth={2.4} aria-hidden="true" />
        </span>
        Your best matches are ready
      </h2>

      {summary.supporting_copy && (
        <p className="relative z-[1] mt-2 max-w-[600px] text-sm leading-[1.62] break-words text-[var(--vk-text-subtle)]">
          {summary.supporting_copy}
        </p>
      )}

      {/* Decision preview / requirement confidence */}
      <div className="relative z-[1] mt-4">
        <div className="mb-2 text-[11px] font-bold tracking-[0.06em] text-[var(--vk-text-muted)] uppercase">
          Lumora decision preview{payload.category && ` — ${payload.category}`}
        </div>
        <div className="bg-[rgba(249, 248, 242, 0.56)] rounded-[14px] border border-[var(--vk-border)] px-[18px] py-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="min-w-0 flex-none">
              <div className="text-sm font-semibold text-[var(--vk-text-strong)]">
                Requirement Confidence
              </div>
              {summary.confidence_explanation && (
                <button
                  type="button"
                  onClick={() => setExplanationOpen((v) => !v)}
                  aria-expanded={explanationOpen}
                  className="mt-[3px] inline-flex cursor-pointer items-center gap-[5px] border-0 border-b border-dashed border-[rgba(232,137,46,0.42)] bg-transparent p-0 text-xs text-[var(--vk-text-muted)] transition-colors hover:text-[var(--vk-text-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)]"
                >
                  Why {confidencePct}%?
                </button>
              )}
            </div>
            <ScoreBar
              fraction={summary.requirement_confidence}
              tone="success"
              className="h-2 min-w-[120px]"
            />
            <div className="flex-none font-mono text-[19px] font-bold text-[var(--vk-text-strong)]">
              {confidencePct}%
            </div>
          </div>
          {explanationOpen && summary.confidence_explanation && (
            <p className="mt-3 mb-0 text-[12.5px] leading-[1.55] break-words text-[var(--vk-text-muted)]">
              {summary.confidence_explanation}
            </p>
          )}
        </div>
      </div>

      {/* Based on what you told me */}
      {summary.secondary_copy && (
        <div className="bg-[rgba(249, 248, 242, 0.56)] relative z-[1] mt-3 rounded-[14px] border border-[var(--vk-border)] px-[18px] py-4">
          <div className="text-[11px] font-bold tracking-[0.05em] text-[var(--vk-text-muted)] uppercase">
            Based on what you told me, I understand that:
          </div>
          <p className="mt-[9px] mb-0 text-[13.5px] leading-[1.65] break-words text-[var(--vk-text-subtle)]">
            {summary.secondary_copy}
          </p>
        </div>
      )}

      {/* Requirement chips — hard constraints stand apart from preferences */}
      {summary.chips && summary.chips.length > 0 && (
        <div className="relative z-[1] mt-3.5 flex flex-wrap items-center gap-2">
          {summary.chips.map((chip) => (
            <ConstraintChip
              key={chip.id}
              label={chip.label}
              constraint={chip.constraint}
            />
          ))}
        </div>
      )}

      {/* Preference note */}
      {summary.preference_note && (
        <div className="relative z-[1] mt-3 flex gap-2.5 rounded-[13px] border border-[rgba(201,154,78,0.26)] bg-[rgba(201,154,78,0.06)] px-3.5 py-3">
          <Info
            size={16}
            strokeWidth={1.9}
            aria-hidden="true"
            className="mt-px flex-none text-[var(--vk-warning)]"
          />
          <span className="text-[12.5px] leading-[1.55] break-words text-[var(--vk-text-subtle)]">
            {summary.preference_note.field && (
              <strong className="font-semibold text-[var(--vk-gold-soft)]">
                {summary.preference_note.field}:{' '}
              </strong>
            )}
            {summary.preference_note.text}
          </span>
        </div>
      )}

      {/* Buying profile — estimated weights, labelled as such */}
      {summary.buying_profile && (
        <div className="bg-[rgba(249, 248, 242, 0.56)] relative z-[1] mt-4 rounded-[14px] border border-[var(--vk-border)] px-[18px] py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm font-semibold text-[var(--vk-text-strong)]">
              Your buying profile
            </div>
            {summary.buying_profile.estimated && (
              <span className="text-[10.5px] tracking-[0.04em] text-[var(--vk-text-faint)] uppercase">
                Estimated from your conversation
              </span>
            )}
          </div>
          <p className="mt-2 mb-0 text-[13px] leading-[1.55] break-words text-[var(--vk-text-subtle)]">
            {summary.buying_profile.summary}
          </p>
          {summary.buying_profile.weights &&
            summary.buying_profile.weights.length > 0 && (
              <div className="mt-3.5 flex flex-col gap-[11px]">
                {summary.buying_profile.weights.map((weight, index) => (
                  <div key={weight.id} className="flex items-center gap-3">
                    <span className="inline-flex w-[132px] flex-none flex-wrap items-center gap-[7px] text-[12.5px] break-words text-[var(--vk-text-subtle)]">
                      {weight.label}
                      {weight.chip && (
                        <span className="rounded-full border border-[rgba(242,193,78,0.34)] bg-[rgba(242,193,78,0.1)] px-[7px] py-px text-[10px] font-semibold text-[var(--vk-gold-soft)]">
                          {weight.chip}
                        </span>
                      )}
                    </span>
                    {/* A weight the backend could not compute is absent, not
                        zero — show the label without a bar. */}
                    {typeof weight.weight_pct === 'number' && (
                      <>
                        <ScoreBar
                          fraction={weight.weight_pct / 100}
                          tone={index === 0 ? 'success' : 'accent'}
                          delayMs={620 + index * 80}
                        />
                        <span className="w-[34px] flex-none text-right font-mono text-xs font-semibold text-[var(--vk-text-strong)]">
                          {Math.round(weight.weight_pct)}%
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {onOpenAnalysis && (
        <div className="relative z-[1] mt-4">
          <button
            type="button"
            onClick={onOpenAnalysis}
            className={cn(
              'vk-cta-sweep relative flex min-h-[50px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[13px] border border-[rgba(232,137,46,0.48)] bg-linear-[150deg,#348568,#28765c] px-4 text-sm font-semibold text-[var(--vk-on-accent)] outline-none',
              'shadow-[0_10px_26px_-8px_rgba(232,137,46,0.5)]',
              'transition-[transform,background,box-shadow] duration-[var(--vk-duration-fast)] ease-[var(--vk-ease-standard)]',
              'hover:-translate-y-px hover:bg-linear-[150deg,#F6BC5C,#F09A3B] hover:shadow-[0_14px_32px_-8px_rgba(232,137,46,0.62)]',
              'active:translate-y-px active:bg-linear-[150deg,#E6A042,#DB832B]',
              'focus-visible:shadow-[0_0_0_3px_var(--vk-accent-ring)]'
            )}
          >
            <Sparkles size={18} strokeWidth={1.8} aria-hidden="true" />
            Lumora Analysis
          </button>
        </div>
      )}
    </section>
  );
}
