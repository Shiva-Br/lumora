'use client';

import { Package } from 'lucide-react';
import * as React from 'react';

import {
  CardEye,
  GmHead,
  MatchPct,
} from '@/components/lumora/chat/workspace-bits';
import type { Recommendation, Tone } from '@/lib/api/types';
import { formatMoney, formatShortDate } from '@/lib/format';
import { useT } from '@/lib/i18n/provider';
import { cn } from '@/lib/utils';

const CHIP_TONES: Record<Tone, string> = {
  positive:
    'border-[rgba(95,168,107,0.34)] bg-[rgba(95,168,107,0.12)] text-[#B8DFC0]',
  warning:
    'border-[rgba(242,193,78,0.32)] bg-[rgba(242,193,78,0.1)] text-[var(--vk-gold-soft)]',
  neutral:
    'border-[rgba(150,178,205,0.2)] bg-[rgba(150,178,205,0.06)] text-[var(--vk-text-subtle)]',
};

/** Design `confWord`: percentage → the spoken confidence word. */
function confWord(pct: number): string {
  return pct >= 90 ? 'Strong' : pct >= 75 ? 'Good' : 'Moderate';
}

/** Snapshot cell (design `.rc-sc`). */
function SnapCell({
  label,
  gold,
  children,
}: {
  label: string;
  gold?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[rgba(249, 248, 242, 0.35)] rounded-[11px] border border-[rgba(150,178,205,0.1)] px-3 py-2.5">
      <div className="text-[10px] tracking-[0.08em] text-[var(--vk-note-quiet)] uppercase">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 text-[13.5px] leading-[1.35] font-semibold break-words',
          gold ? 'text-[var(--vk-gold-soft)]' : 'text-[var(--vk-text-strong)]'
        )}
      >
        {children}
      </div>
    </div>
  );
}

function HeroImage({ imageUrl, name }: { imageUrl?: string; name: string }) {
  const [broken, setBroken] = React.useState(false);
  const showImage = Boolean(imageUrl) && !broken;
  return (
    <div className="flex h-[72px] w-[92px] flex-none items-center justify-center overflow-hidden rounded-[12px] border border-[rgba(150,178,205,0.18)] bg-radial-[120%_90%_at_50%_25%,rgba(232,137,46,0.14),rgba(150,178,205,0.02)_70%]">
      {showImage ? (
        // Third-party URL — next/image cannot allowlist arbitrary hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <Package
          size={26}
          strokeWidth={1.6}
          aria-hidden="true"
          className="text-[var(--vk-note)]"
        />
      )}
    </div>
  );
}

export function PanelAnalysis({
  recommendation,
}: {
  recommendation: Recommendation;
}) {
  const t = useT();
  const pick = recommendation.recommendation;
  const decision = recommendation.decision_summary;
  const detail = recommendation.confidence_detail;
  const ifIWereYou = recommendation.if_i_were_you;

  // Legacy ranking fallbacks (`ranked` can be null — always guard).
  const ranked = recommendation.ranked ?? [];
  const best = ranked.find((r) => r.rank === 1) ?? ranked[0] ?? null;

  const productName =
    decision?.product_name ?? recommendation.best_pick ?? best?.product ?? null;
  const seller = decision?.buy_from ?? pick?.seller ?? best?.seller ?? null;
  const matchPct = decision?.match_score_pct ?? pick?.scores?.match ?? null;
  // `pct` may be explicitly null — the backend could not compute it.
  const confidencePct =
    detail?.pct ??
    decision?.confidence_pct ??
    (recommendation.confidence !== undefined
      ? Math.round(Math.min(1, Math.max(0, recommendation.confidence)) * 100)
      : null);

  const priceLabel =
    pick?.price?.amount !== undefined
      ? formatMoney(pick.price.amount, pick.price.currency)
      : best?.best_price !== undefined
        ? formatMoney(best.best_price, best.currency)
        : null;

  const opinionIntro =
    recommendation.final_opinion_intro?.text &&
    !recommendation.final_opinion_intro.is_example
      ? recommendation.final_opinion_intro.text
      : null;

  const whyReasons = pick?.why_reasons ?? [];
  const chips = detail?.chips ?? [];
  // Design: a bold quote, then a quieter body line. The body is the legacy
  // summary, shown only when the payload carries both texts.
  const iiwyText = ifIWereYou?.text ?? recommendation.summary ?? null;
  const iiwyBody =
    ifIWereYou?.text && recommendation.summary !== ifIWereYou.text
      ? (recommendation.summary ?? null)
      : null;
  const footer = ifIWereYou?.footer;
  const footerParts = [
    'Lumora',
    footer?.confidence_pct !== undefined && footer?.confidence_pct !== null
      ? `Confidence ${Math.round(footer.confidence_pct)}%`
      : null,
    footer?.date ? formatShortDate(footer.date) : null,
  ].filter(Boolean);

  if (!productName && !iiwyText) {
    return (
      <div className="rounded-2xl border border-dashed border-[rgba(150,178,205,0.2)] p-[22px] text-center">
        <div className="text-sm font-semibold text-[var(--vk-text-strong)]">
          No recommendation yet
        </div>
        <div className="mt-1.5 text-[13px] leading-[1.5] text-[var(--vk-text-muted)]">
          Lumora gives its final opinion after comparing the products you
          selected.
        </div>
      </div>
    );
  }

  return (
    <div className="vk-ws-seq">
      {/* The unified decision card (design `.rc-unified`) */}
      {productName && (
        <div className="mb-[18px]">
          <div className="mb-2">
            <CardEye>My best choice · LUMORA’s decision</CardEye>
          </div>
          <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_42%),linear-gradient(180deg,rgba(242,193,78,0.08),rgba(249, 248, 242, 0.5))] rounded-2xl border border-[rgba(242,193,78,0.32)] px-[17px] py-4 shadow-[0_0_0_1px_rgba(242,193,78,0.06),0_22px_60px_-30px_rgba(242,193,78,0.5)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full border border-[rgba(95,168,107,0.34)] bg-[rgba(95,168,107,0.12)] px-2.5 py-0.5 text-[11px] font-semibold text-[#B8DFC0]">
                Ready for decision
              </span>
            </div>

            {(opinionIntro || recommendation.summary) && (
              <p
                dir="auto"
                className="mt-2.5 mb-0 text-[13.5px] leading-[1.6] break-words text-[var(--vk-text-subtle)]"
              >
                {opinionIntro ?? recommendation.summary}
              </p>
            )}

            {/* Snapshot grid (design `.rc-snap-grid`). Match and confidence
                are different backend numbers — each keeps its own cell. */}
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <SnapCell label={t('ws.recommended')} gold>
                {productName}
              </SnapCell>
              {confidencePct !== null && (
                <SnapCell label={t('ws.decisionConfidence')}>
                  {confWord(Math.round(confidencePct))}{' '}
                  <span className="text-[var(--vk-note-quiet)]">·</span>{' '}
                  <MatchPct value={confidencePct} />
                </SnapCell>
              )}
              {matchPct !== null && (
                <SnapCell label={t('ws.matchScore')}>
                  <MatchPct value={matchPct} />
                </SnapCell>
              )}
              {seller && <SnapCell label={t('ws.buyFrom')}>{seller}</SnapCell>}
              {decision?.one_sentence && (
                <SnapCell label={t('ws.inOneSentence')}>
                  <span className="font-medium">{decision.one_sentence}</span>
                </SnapCell>
              )}
            </div>

            <div className="my-3.5 h-px bg-[rgba(150,178,205,0.12)]" />

            {/* LUMORA recommends — the hero (design `.rc-rec2`) */}
            <div className="text-[10px] font-extrabold tracking-[0.14em] text-[var(--vk-gold-soft)] uppercase">
              LUMORA recommends
            </div>
            <div className="mt-2.5 flex items-center gap-3.5">
              <HeroImage imageUrl={pick?.image_url} name={productName} />
              <div className="min-w-0 flex-1">
                {pick?.label && (
                  <div className="text-[10.5px] tracking-[0.06em] text-[var(--vk-text-muted)] uppercase">
                    {pick.label.replaceAll('_', ' ')}
                  </div>
                )}
                <div className="text-[17px] leading-[1.25] font-semibold break-words text-[var(--vk-text-strong)]">
                  {productName}
                </div>
                {(priceLabel || pick?.delivery_label) && (
                  <div className="mt-1 text-[13px] text-[var(--vk-text-muted)]">
                    {priceLabel && (
                      <span className="text-[15px] font-semibold text-[var(--vk-gold-soft)] tabular-nums">
                        {priceLabel}
                      </span>
                    )}
                    {priceLabel && pick?.delivery_label && ' · '}
                    {pick?.delivery_label}
                  </div>
                )}
              </div>
              {pick?.scores && (
                <div className="hidden flex-none text-right sm:block">
                  <MatchPct
                    value={pick.scores.match}
                    className="block text-[22px] leading-none font-semibold text-[var(--vk-gold-soft)]"
                  />
                  <span className="text-[8.5px] tracking-[0.05em] text-[var(--vk-note-quiet)] uppercase">
                    match{pick.scores.estimated ? ' · est.' : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Why — based on everything you told me */}
            {whyReasons.length > 0 ? (
              <div className="mt-3.5">
                <div className="text-[11px] font-bold tracking-[0.05em] text-[var(--vk-text-muted)] uppercase">
                  Why — based on everything you told me:
                </div>
                <div className="mt-2 flex flex-col">
                  {whyReasons.map((reason, index) => (
                    <div
                      key={reason}
                      className={cn(
                        'flex gap-2.5 pb-2.5',
                        index > 0 &&
                          'border-t border-[rgba(150,178,205,0.08)] pt-2.5',
                        index === whyReasons.length - 1 && 'pb-0'
                      )}
                    >
                      <span className="mt-1.5 h-[5px] w-[5px] flex-none rounded-full bg-[var(--vk-accent)]" />
                      <span className="text-[13px] leading-[1.55] break-words text-[var(--vk-text-subtle)]">
                        {reason}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              best?.rationale && (
                <p className="mt-3.5 mb-0 text-[13.5px] leading-[1.65] break-words text-[var(--vk-text-subtle)]">
                  {best.rationale}
                </p>
              )
            )}
          </div>
        </div>
      )}

      {/* What you should know / like most — real pick fields when present */}
      {(pick?.like_most?.length || pick?.should_know?.length) && (
        <div className="mb-[18px] grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {pick?.like_most?.length ? (
            <div className="rounded-[13px] border border-[rgba(95,168,107,0.24)] bg-[rgba(95,168,107,0.06)] px-3.5 py-3">
              <div className="mb-2 text-[10px] font-bold tracking-[0.1em] text-[#B8DFC0] uppercase">
                What you’ll like most
              </div>
              <ul className="m-0 list-none space-y-1.5 p-0">
                {pick.like_most.map((point) => (
                  <li
                    key={point}
                    className="flex gap-2 text-[12.5px] leading-[1.5] text-[var(--vk-text-subtle)]"
                  >
                    <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-[#7cc79a]" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {pick?.should_know?.length ? (
            <div className="rounded-[13px] border border-[rgba(242,193,78,0.24)] bg-[rgba(242,193,78,0.05)] px-3.5 py-3">
              <div className="mb-2 text-[10px] font-bold tracking-[0.1em] text-[var(--vk-gold-soft)] uppercase">
                What you should know
              </div>
              <ul className="m-0 list-none space-y-1.5 p-0">
                {pick.should_know.map((point) => (
                  <li
                    key={point}
                    className="flex gap-2 text-[12.5px] leading-[1.5] text-[var(--vk-text-subtle)]"
                  >
                    <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-[var(--vk-gold)]" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {/* Why the others didn't win (design `.rc-lostmini`) */}
      {((pick?.why_others_failed?.length ?? 0) > 0 ||
        (recommendation.rejected?.length ?? 0) > 0) && (
        <div className="bg-[rgba(249, 248, 242, 0.5)] mb-[18px] rounded-[13px] border border-[var(--vk-border)] px-3.5 py-3">
          <div className="mb-2 text-[10px] font-bold tracking-[0.1em] text-[var(--vk-text-muted)] uppercase">
            Why the other finalists didn’t win
          </div>
          <div className="flex flex-col gap-1.5">
            {/* `rejected` carries real product names; `why_others_failed`
                only has backend ids (`product_id`), which are not
                presentation text — those rows render the reason alone. */}
            {(recommendation.rejected?.length
              ? recommendation.rejected.map((o) => ({
                  name: o.product,
                  reason: o.reason,
                }))
              : (pick?.why_others_failed ?? []).map((o) => ({
                  name: '',
                  reason: o.reason,
                }))
            ).map((other) => (
              <div
                key={`${other.name}-${other.reason}`}
                className="flex flex-wrap gap-x-2 gap-y-0.5 text-[12.5px] leading-[1.5]"
              >
                {other.name && (
                  <span className="font-semibold text-[var(--vk-text-strong)]">
                    {other.name}
                  </span>
                )}
                <span className="min-w-0 break-words text-[var(--vk-text-muted)]">
                  {other.reason}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* It depends — REC-CND branches beside the default pick (v0.9.0) */}
      {(recommendation.conditional?.length ?? 0) > 0 && (
        <div className="mb-[18px]">
          <GmHead eye="No universal best" sub="When I’d pick another instead" />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {recommendation.conditional!.map((branch) => (
              <div
                key={`${branch.if}-${branch.then_product}`}
                className="bg-[rgba(249, 248, 242, 0.5)] rounded-[13px] border border-[rgba(150,178,205,0.14)] px-3.5 py-3"
              >
                <div className="text-[13px] font-semibold break-words text-[var(--vk-text-strong)]">
                  {branch.then_product}
                </div>
                <div className="mt-1 text-[10px] font-bold tracking-[0.1em] text-[var(--vk-gold-soft)] uppercase">
                  Choose it if
                </div>
                <div className="mt-0.5 text-[12.5px] leading-[1.5] break-words text-[var(--vk-text-subtle)]">
                  {branch.if}
                  {branch.why ? ` — ${branch.why}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My confidence */}
      {(confidencePct !== null || detail?.explanation || chips.length > 0) && (
        <div className="mb-[18px]">
          <GmHead eye="Why you can trust it" sub="My confidence" />
          <div className="rounded-[14px] border border-[rgba(95,168,107,0.22)] bg-[rgba(95,168,107,0.05)] px-[17px] py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[14px] font-semibold text-[var(--vk-text-strong)]">
                Decision confidence
              </div>
              {confidencePct !== null && (
                <MatchPct
                  value={confidencePct}
                  className="text-[26px] leading-none font-bold text-[#B8DFC0]"
                />
              )}
            </div>
            {detail?.explanation && (
              <p className="mt-2.5 mb-0 text-[13px] leading-[1.6] break-words text-[var(--vk-text-subtle)]">
                {detail.explanation}
              </p>
            )}
            {chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <span
                    key={chip.label}
                    className={cn(
                      'rounded-full border px-[11px] py-1.5 text-xs font-semibold',
                      CHIP_TONES[chip.tone] ?? CHIP_TONES.neutral
                    )}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            )}
            {(detail?.what_would_change?.length ?? 0) > 0 && (
              <div className="mt-3 border-t border-[rgba(150,178,205,0.12)] pt-2.5">
                <div className="text-[10px] font-bold tracking-[0.1em] text-[var(--vk-text-muted)] uppercase">
                  What would change my mind
                </div>
                <ul className="mt-1.5 mb-0 list-none space-y-1 p-0">
                  {detail!.what_would_change!.map((item) => (
                    <li
                      key={item}
                      className="text-[12.5px] leading-[1.5] break-words text-[var(--vk-text-subtle)]"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LUMORA's personal call (design `.gm-call`) — the closing word */}
      {iiwyText && (
        <div>
          <GmHead
            eye="LUMORA’s personal call"
            sub="After weighing everything you told me"
          />
          <div className="bg-linear-[135deg,rgba(242,193,78,0.08),rgba(249, 248, 242, 0.6)_55%] rounded-2xl border border-l-[3px] border-[rgba(242,193,78,0.3)] border-l-[var(--vk-gold)] px-[18px] py-4">
            <div className="flex items-center gap-[7px] text-[10px] font-extrabold tracking-[0.14em] text-[var(--vk-gold-soft)] uppercase">
              <span
                aria-hidden="true"
                className="text-[11px] [filter:drop-shadow(0_0_6px_rgba(242,193,78,0.5))]"
              >
                ◆
              </span>
              If I were you
            </div>
            <p
              dir="auto"
              className="mt-2.5 mb-0 text-[15.5px] leading-[1.55] font-semibold break-words text-[var(--vk-text-strong)]"
            >
              {iiwyText}
            </p>
            {iiwyBody && (
              <p className="mt-2 mb-0 text-[13px] leading-[1.6] break-words text-[var(--vk-text-subtle)]">
                {iiwyBody}
              </p>
            )}
            {ifIWereYou?.honest_disclaimer && (
              <>
                <div className="my-3 h-px bg-[rgba(150,178,205,0.14)]" />
                <p className="m-0 text-[12.5px] leading-[1.6] break-words text-[var(--vk-text-muted)] italic">
                  {ifIWereYou.honest_disclaimer}
                </p>
              </>
            )}
            {footerParts.length > 1 && (
              <>
                <div className="my-3 h-px bg-[rgba(150,178,205,0.14)]" />
                <div className="text-[11.5px] text-[var(--vk-note)]">
                  {footerParts.join(' · ')}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
