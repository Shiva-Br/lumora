'use client';

import * as React from 'react';

import type { UnderstandingPayload } from '@/lib/api/types';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/provider';
import { useCountUp, useReducedMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';

// Fact chips (design `.und-fact.lv-*`): essential glows gold, high leans
// orange, preference cools to steel, flexible fades back.
const FACT_TONE: Record<string, string> = {
  essential:
    'border-[rgba(242,193,78,0.4)] bg-[rgba(242,193,78,0.06)] text-[#f3ead4]',
  high: 'border-[rgba(232,137,46,0.34)] text-[#f6ddc4]',
  preference: 'border-[rgba(110,144,172,0.35)] text-[var(--vk-text-muted)]',
  flexible: 'border-[var(--vk-border)] text-[var(--vk-text-muted)] opacity-70',
};

const FACT_DOT: Record<string, string> = {
  essential: 'bg-[var(--vk-gold)] shadow-[0_0_6px_rgba(242,193,78,0.6)]',
  high: 'bg-[var(--vk-accent)]',
  preference: 'bg-[var(--vk-steel)]',
  flexible: 'bg-[var(--vk-note-quiet)]',
};

// Priority badges (design `.und-badge.lv-*`).
const PRIORITY_TONE: Record<string, string> = {
  essential:
    'border-transparent bg-linear-[150deg,#348568,#28765c] font-semibold text-[#ffffff]',
  high: 'border-[rgba(232,137,46,0.4)] text-[#f6ddc4]',
  preference: 'border-[rgba(110,144,172,0.4)] text-[#243b32]',
  flexible:
    'border-[rgba(150,178,205,0.18)] text-[var(--vk-text-muted)] opacity-70',
  // The design carries an explicit `unknown` rung. Falling back to
  // `preference` presented a level the backend never sent as a considered
  // preference of the user's — a quiet invention on the one card whose whole
  // job is repeating their words back to them.
  unknown:
    'border-dashed border-[var(--vk-border)] text-[var(--vk-note-quiet)]',
};

const PRIORITY_LABEL: Record<string, TranslationKey> = {
  essential: 'und.lvEssential',
  high: 'und.lvHigh',
  preference: 'und.lvPreference',
  flexible: 'und.lvFlexible',
  unknown: 'und.lvUnknown',
};

const BAR_WIDTH: Record<string, string> = {
  'Very important': '92%',
  Important: '72%',
  Moderate: '50%',
  Flexible: '30%',
};

interface UnderstandingCardProps {
  payload: UnderstandingPayload;
  onConfirm: () => void;
  onEdit: (questionId: string) => void;
  /** DNA factor → question id, so Adjust can name the right card. */
  factorToQuestion?: Record<string, string>;
  disabled?: boolean;
  /**
   * Overrides the payload's own `confirmed` flag. The payload lags reality in
   * two ways the screen can see and the message cannot: older backends never
   * re-emitted the understanding after consent, and the presence of any
   * downstream payload (candidates, a recommendation) PROVES consent — the
   * pipeline only runs after it. Without the override the card kept offering
   * a confirm button the user had already pressed.
   */
  confirmed?: boolean;
}

function SectionTitle({
  gold,
  children,
}: {
  gold?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'mb-[9px] text-[10.5px] tracking-[0.14em] uppercase',
        gold ? 'text-[var(--vk-gold-soft)]' : 'text-[var(--vk-text-muted)]'
      )}
    >
      {children}
    </div>
  );
}

const QBTN =
  'inline-flex min-h-10 cursor-pointer items-center rounded-[9px] border border-[rgba(150,178,205,0.14)] bg-[rgba(150,178,205,0.06)] px-[15px] py-[9px] text-[13px] text-[var(--vk-text)] transition hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)]';
const QBTN_PRIMARY =
  'inline-flex min-h-10 cursor-pointer items-center rounded-[9px] border-0 bg-linear-[150deg,#348568,#28765c] px-[15px] py-[9px] text-[13px] font-semibold text-[#ffffff] shadow-[0_10px_24px_-12px_rgba(232,137,46,0.7)] transition hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)]';

export function UnderstandingCard({
  payload: u,
  onConfirm,
  onEdit,
  factorToQuestion,
  disabled,
  confirmed: confirmedOverride,
}: UnderstandingCardProps) {
  const t = useT();
  const [adjusting, setAdjusting] = React.useState(false);
  const confirmed = confirmedOverride ?? u.confirmed;

  const reduced = useReducedMotion();
  // The card only performs its reveal on the way in. Once confirmed — or when
  // motion is reduced, or when it's replayed from history already confirmed —
  // it renders settled, with no stagger and no counting.
  const staged = !confirmed && !reduced;
  // Started by the confidence section's own entrance, so the number begins
  // climbing exactly when that section becomes visible. Letting CSS own the
  // timing keeps the two in sync even if sections above are missing.
  const [counting, setCounting] = React.useState(false);
  const target = Math.min(100, Math.max(0, u.confidence.pct));
  const counted = useCountUp(target, staged && counting);
  const shownPct = staged ? counted : target;

  const adjustable = (u.dna ?? []).filter(
    (fact) => factorToQuestion?.[fact.factor]
  );

  return (
    <div
      className={cn(
        'bg-linear-[180deg,rgba(249, 248, 242, 0.6),rgba(249, 248, 242, 0.5)] shadow-[0_24px_60px_-30px_rgba(249, 248, 242, 0.7)] relative max-w-[684px] overflow-hidden rounded-[18px] border border-[rgba(150,178,205,0.2)] px-5 py-[18px]',
        confirmed && 'vk-und-confirmed'
      )}
      dir="auto"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-[2px] bg-linear-[180deg,var(--vk-gold),transparent]"
      />

      {/* Direct children of `.vk-und-seq` are the reveal units — keep the
          head grouped so the eyebrow, title and subtitle land together. */}
      <div className={cn('relative', staged && 'vk-und-seq')}>
        <div className="mb-[15px]">
          <div className="flex items-center gap-[7px] text-[10.5px] tracking-[0.16em] text-[var(--vk-gold-soft)] uppercase">
            <span
              aria-hidden="true"
              className="grid h-3 w-3 place-items-center"
            >
              <span className="h-[6px] w-[6px] rounded-full bg-[var(--vk-gold)] shadow-[0_0_8px_rgba(242,193,78,0.7)]" />
            </span>
            {confirmed ? t('und.confirmed') : t('und.complete')}
          </div>

          <h3 className="mt-1.5 mb-0 text-[20px] font-semibold tracking-[-0.01em] text-[var(--vk-text-strong)]">
            {confirmed ? t('und.confirmed') : 'Here’s what I understand.'}
          </h3>
          <p className="mt-1 mb-0 text-[13px] leading-[1.5] text-[var(--vk-text-muted)]">
            {confirmed
              ? 'I’ll optimize the evaluation for exactly this.'
              : 'I believe I now understand exactly what you’re looking for.'}
          </p>
        </div>

        <p className="mb-[15px] text-[16px] leading-[1.62] text-[#243b32]">
          {u.core_need}
        </p>

        {u.explicit_facts?.length ? (
          <div className="mb-[15px]">
            <SectionTitle>{t('und.youToldMe')}</SectionTitle>
            <div className="flex flex-wrap gap-[7px]">
              {u.explicit_facts.map((fact) => (
                <span
                  key={fact.label}
                  className={cn(
                    'inline-flex items-center gap-[7px] rounded-[9px] border px-[11px] py-1.5 text-[12.5px]',
                    FACT_TONE[fact.level] ?? FACT_TONE.preference
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-[6px] w-[6px] flex-none rounded-full',
                      FACT_DOT[fact.level] ?? FACT_DOT.preference
                    )}
                  />
                  {fact.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {u.dna?.length ? (
          <div className="mb-[15px]">
            <SectionTitle>{t('und.dna')}</SectionTitle>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-[9px]">
              {u.dna.map((fact) => (
                <div
                  key={fact.factor}
                  className="bg-[rgba(249, 248, 242, 0.5)] flex items-center gap-2.5 rounded-[12px] border border-[rgba(150,178,205,0.14)] px-3 py-2.5"
                >
                  <span
                    aria-hidden="true"
                    className="h-[7px] w-[7px] flex-none rounded-full bg-[var(--vk-gold)] opacity-70"
                  />
                  <div className="min-w-0">
                    <div className="text-[9.5px] tracking-[0.1em] text-[var(--vk-text-muted)] uppercase">
                      {fact.factor}
                    </div>
                    <div className="mt-px truncate text-[13.5px] text-[var(--vk-text-strong)]">
                      {fact.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {u.inferred_priorities?.length ? (
          <div className="mb-[15px]">
            <SectionTitle>{t('und.mattersMost')}</SectionTitle>
            <div>
              {u.inferred_priorities.map((priority, index) => (
                <div
                  key={priority.label}
                  className={cn(
                    'flex items-center gap-2.5 py-2 text-[13.5px]',
                    index > 0 && 'border-t border-[rgba(150,178,205,0.07)]',
                    index === 0 && 'pt-0'
                  )}
                >
                  <span className="grid h-5 w-5 flex-none place-items-center rounded-[6px] border border-[rgba(242,193,78,0.3)] text-[11px] text-[var(--vk-gold-soft)]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 leading-[1.4] text-[var(--vk-text-strong)]">
                    {priority.label}
                  </span>
                  <span
                    className={cn(
                      'flex-none rounded-[6px] border px-2 py-[3px] text-[9px] tracking-[0.08em] uppercase',
                      PRIORITY_TONE[priority.level] ?? PRIORITY_TONE.unknown
                    )}
                  >
                    {t(PRIORITY_LABEL[priority.level] ?? 'und.lvUnknown')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {(u.tradeoff?.bars?.length ||
          u.tradeoff?.sentence ||
          u.tradeoff?.prefer?.length ||
          u.tradeoff?.give_up?.length) && (
          <div className="mb-[15px]">
            <SectionTitle>The trade-off I see</SectionTitle>
            <div className="bg-[rgba(249, 248, 242, 0.35)] rounded-[12px] border border-[var(--vk-border)] px-[13px] py-3">
              {(u.tradeoff.prefer?.length || u.tradeoff.give_up?.length) && (
                <div className="flex flex-wrap gap-3.5">
                  <div className="min-w-[120px] flex-[1_1_40%]">
                    <div className="mb-[3px] text-[10px] tracking-[0.1em] text-[var(--vk-text-muted)] uppercase">
                      You prefer
                    </div>
                    <div className="text-[13.5px] text-[var(--vk-text-strong)]">
                      {(u.tradeoff.prefer ?? []).join(' + ') || '—'}
                    </div>
                  </div>
                  <div className="min-w-[120px] flex-[1_1_40%]">
                    <div className="mb-[3px] text-[10px] tracking-[0.1em] text-[var(--vk-text-muted)] uppercase">
                      You’ll give up
                    </div>
                    <div className="text-[13.5px] text-[var(--vk-text-strong)]">
                      {(u.tradeoff.give_up ?? []).join(' + ') || '—'}
                    </div>
                  </div>
                </div>
              )}

              {u.tradeoff.bars?.length ? (
                <div className="mt-3 flex flex-col gap-2">
                  {u.tradeoff.bars.map((bar) => {
                    // Draw the REAL share, scaled so the strongest factor
                    // fills the track. The level is four buckets wide, and a
                    // personalized profile routinely puts its whole top four
                    // inside one of them — four identical bars from four
                    // different numbers. Where the backend sends the share,
                    // near-equal factors now read as near-equal instead of
                    // identical, and genuinely equal ones still draw equal.
                    const top = Math.max(
                      ...u.tradeoff!.bars!.map((b) => b.share ?? 0)
                    );
                    const width =
                      bar.share && top > 0
                        ? `${Math.round((bar.share / top) * 100)}%`
                        : BAR_WIDTH[bar.level];
                    return (
                      <div key={bar.label}>
                        <div className="mb-1 flex items-center justify-between text-[11.5px] text-[var(--vk-text-subtle)]">
                          <span>{bar.label}</span>
                          <span className="text-[var(--vk-text-muted)]">
                            {bar.level}
                          </span>
                        </div>
                        <div className="h-[5px] overflow-hidden rounded-[3px] bg-[rgba(150,178,205,0.14)]">
                          {/* A level outside the design's table gets an EMPTY
                            track, not a default. `?? BAR_WIDTH.Moderate` drew
                            an unrecognised level at a confident 50% — a
                            weight the backend never stated, on a bar whose
                            only content is that weight. */}
                          {width ? (
                            <span
                              className="block h-full rounded-[3px] bg-linear-[90deg,#348568,#28765c]"
                              style={{ width }}
                            />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {u.tradeoff.sentence ? (
                <p className="mt-[11px] mb-0 text-[12.5px] leading-[1.55] text-[var(--vk-text-muted)]">
                  {u.tradeoff.sentence}
                </p>
              ) : null}
            </div>
          </div>
        )}

        {u.avoidances?.length ? (
          <div className="mb-[15px]">
            <SectionTitle>{t('und.avoid')}</SectionTitle>
            <ul className="m-0 list-none space-y-1.5 p-0">
              {u.avoidances.map((avoidance) => (
                <li
                  key={avoidance}
                  className="relative pl-[18px] text-[13px] leading-[1.5] text-[var(--vk-text-muted)]"
                >
                  <span
                    aria-hidden="true"
                    className="absolute top-2 left-[3px] h-[5px] w-[5px] rounded-full bg-[var(--vk-accent-hover)] opacity-85"
                  />
                  {avoidance}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {u.ideal ? (
          <div className="mb-[15px] rounded-[12px] border border-l-2 border-[rgba(242,193,78,0.28)] border-l-[var(--vk-gold)] bg-linear-[180deg,rgba(242,193,78,0.06),transparent] px-[15px] py-[13px]">
            <SectionTitle gold>{t('und.reallyLooking')}</SectionTitle>
            <p className="m-0 text-[16px] leading-[1.55] text-[#f3ecdb]">
              {u.ideal}
            </p>
          </div>
        ) : null}

        <p className="mb-[15px] text-[14px] leading-[1.62] text-[var(--vk-text-muted)]">
          Based on everything you’ve shared, I now have a clear picture of what
          fits your priorities. From here I’ll stop asking discovery questions
          and start evaluating real options against your decision profile.
        </p>

        <div
          className="mb-[15px]"
          // Fires when this section's staggered entrance actually begins.
          onAnimationStart={() => setCounting(true)}
        >
          <div className="flex items-center justify-between gap-3.5">
            <div className="min-w-0">
              <div className="mb-0 text-[10.5px] tracking-[0.14em] text-[var(--vk-text-muted)] uppercase">
                Understanding confidence
              </div>
              {u.confidence.note ? (
                <div className="mt-1 text-[12.5px] leading-[1.55] text-[var(--vk-text-muted)]">
                  {u.confidence.note}
                </div>
              ) : null}
            </div>
            {/* The live number is decorative motion; announce the settled
                value once so screen readers don't hear it tick. */}
            <div className="flex-none text-[30px] leading-none font-semibold text-[var(--vk-gold-soft)] tabular-nums">
              <span aria-hidden="true">{shownPct}%</span>
              <span className="sr-only">
                {u.confidence.level} · {target}%
              </span>
            </div>
          </div>
          {u.confidence.unresolved?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {u.confidence.unresolved.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 rounded-full border border-[rgba(150,178,205,0.14)] px-2 py-0.5 text-[10.5px] text-[var(--vk-text-muted)]"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-[var(--vk-note-quiet)]"
                  />
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          {adjusting && adjustable.length > 0 ? (
            <>
              <div className="mb-2.5 text-[13.5px] text-[var(--vk-text-strong)]">
                Which would you like to adjust?
              </div>
              <div className="flex flex-wrap gap-[9px]">
                {adjustable.map((fact) => (
                  <button
                    key={fact.factor}
                    type="button"
                    disabled={disabled}
                    onClick={() => onEdit(factorToQuestion![fact.factor])}
                    className={cn(QBTN, 'text-[12.5px]')}
                  >
                    {fact.factor}: {fact.value}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setAdjusting(false)}
                  className={QBTN}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : confirmed ? (
            // Confirmed is not finished: the workspace stays reachable from
            // here, however many times the person wants back in. The handler
            // is idempotent — it opens the workspace, and starts the pipeline
            // only if no result exists and none is running.
            <div className="flex flex-wrap gap-[9px]">
              <button
                type="button"
                disabled={disabled}
                onClick={onConfirm}
                className={QBTN_PRIMARY}
              >
                {t('und.lumoraAnalysis')}
              </button>
              {adjustable.length > 0 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setAdjusting(true)}
                  className={QBTN}
                >
                  Adjust
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="mb-2.5 text-[13.5px] text-[var(--vk-text-strong)]">
                Did I understand you correctly?
              </div>
              <div className="flex flex-wrap gap-[9px]">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onConfirm}
                  className={QBTN_PRIMARY}
                >
                  {t('und.lumoraAnalysis')}
                </button>
                <button
                  type="button"
                  disabled={disabled || adjustable.length === 0}
                  onClick={() => setAdjusting(true)}
                  className={QBTN}
                >
                  Adjust something
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
