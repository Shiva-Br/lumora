'use client';

import { Calendar, Check, TriangleAlert, X } from 'lucide-react';
import * as React from 'react';

import { ScoreBar } from '@/components/lumora/chat/score-bar';
import {
  GmHead,
  MatchPct,
  Meter,
} from '@/components/lumora/chat/workspace-bits';
import { LogoMark } from '@/components/lumora/logo';
import { formatRelativeTime } from '@/lib/api/conversations';
import type {
  CandidateProduct,
  CandidateSet,
  Recommendation,
  RequirementPayload,
  ResearchPeriod,
  ResearchReport,
  ResearchSet,
} from '@/lib/api/types';
import { formatMoney, formatMoneyRange } from '@/lib/format';
import { useT } from '@/lib/i18n/provider';
import { cn } from '@/lib/utils';

const BADGE_TONES: Record<string, string> = {
  'Best Value':
    'text-[#B8DFC0] border-[rgba(95,168,107,0.4)] bg-[rgba(95,168,107,0.16)]',
  'Best Overall':
    'text-[var(--vk-gold-soft)] border-[rgba(232,137,46,0.38)] bg-[rgba(232,137,46,0.12)]',
  'Best Balance':
    'text-[var(--vk-gold-soft)] border-[rgba(232,137,46,0.38)] bg-[rgba(232,137,46,0.12)]',
  'Premium Pick':
    'text-[var(--vk-gold-soft)] border-[rgba(242,193,78,0.34)] bg-[rgba(242,193,78,0.12)]',
  'Feature Pick':
    'text-[var(--vk-text-subtle)] border-[rgba(150,178,205,0.24)] bg-[rgba(150,178,205,0.07)]',
};

/** Text-only badge colour for the comparison-table header. */
const BADGE_TEXT: Record<string, string> = {
  'Best Value': '#B8DFC0',
  'Best Overall': 'var(--vk-gold-soft)',
  'Best Balance': 'var(--vk-gold-soft)',
  'Premium Pick': 'var(--vk-gold-soft)',
  'Feature Pick': 'var(--vk-text-subtle)',
};

/** Why-card bullet dot, toned like the card's badge. */
const BADGE_DOT: Record<string, string> = BADGE_TEXT;

const PERIOD_LABELS: Record<ResearchPeriod['id'], string> = {
  '1m': 'After 1 month',
  '3m': 'After 3 months',
  '6m': 'After 6 months',
};

/** Pricing after the backend's listing-anchor pass (v0.12): a present price is
 *  a live listing price (`price_verified`), a withheld one renders honestly as
 *  unavailable — never a model guess dressed as a number. */
function priceLabel(product: CandidateProduct): string | null {
  if (product.price_unavailable) return null;
  const range = product.price_range;
  if (range && (range.min !== undefined || range.max !== undefined)) {
    const spanned = formatMoneyRange(
      range.min,
      range.max,
      range.currency ?? product.currency
    );
    if (spanned) return spanned;
  }
  if (product.approx_price !== undefined) {
    const money = formatMoney(product.approx_price, product.currency);
    return product.price_verified ? money : `~ ${money}`;
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Bold the backend-marked emphasis terms inside the note text. */
function emphasized(text: string, emphasis?: string[]): React.ReactNode {
  const terms = (emphasis ?? []).filter(Boolean);
  if (terms.length === 0) return text;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'g');
  return text.split(pattern).map((part, index) =>
    terms.includes(part) ? (
      <strong
        // Split positions are stable for a given text — index is the identity.
        key={index}
        className="font-semibold text-[var(--vk-text-strong)]"
      >
        {part}
      </strong>
    ) : (
      part
    )
  );
}

function CandidateCard({
  product,
  selected,
  disabled,
  onToggle,
}: {
  product: CandidateProduct;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const price = priceLabel(product);
  const scores = product.scores;
  const why = product.survival_reason ?? product.why_relevant;
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      aria-label={`Select ${product.name} to compare`}
      onClick={() => {
        if (!disabled) onToggle();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        'relative flex min-w-0 cursor-pointer flex-col gap-[11px] rounded-[14px] border p-3 text-left outline-none',
        'transition-[border-color,box-shadow] duration-[180ms]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent)]',
        product.recommended
          ? 'bg-linear-[180deg,rgba(242,193,78,0.1),rgba(249, 248, 242, 0.5)] border-[rgba(242,193,78,0.4)] shadow-[0_16px_46px_-22px_rgba(242,193,78,0.65)]'
          : 'bg-[rgba(249, 248, 242, 0.5)] border-[rgba(150,178,205,0.14)] hover:border-[rgba(242,193,78,0.3)]',
        selected &&
          'border-[var(--vk-gold)] shadow-[0_0_0_1px_var(--vk-gold),0_16px_44px_-22px_rgba(242,193,78,0.55)]',
        disabled && 'cursor-default opacity-75'
      )}
    >
      {/* Tags row (design `.cd-tags`) */}
      <div className="flex min-h-[17px] flex-wrap items-center gap-1.5">
        {product.recommended && (
          <span className="rounded-[5px] bg-linear-[150deg,#348568,#28765c] px-2 py-0.5 text-[8.5px] font-bold tracking-[0.06em] text-[#ffffff] uppercase">
            LUMORA recommendation
          </span>
        )}
        {product.badge && !product.recommended && (
          <span
            className={cn(
              'rounded-[5px] border px-2 py-0.5 text-[8.5px] font-bold tracking-[0.06em] uppercase',
              BADGE_TONES[product.badge] ?? BADGE_TONES['Feature Pick']
            )}
          >
            {product.badge}
          </span>
        )}
        {selected ? (
          <span className="ml-auto rounded-[5px] border border-[var(--vk-gold)] px-[7px] py-0.5 text-[8.5px] font-bold tracking-[0.05em] text-[var(--vk-gold)] uppercase">
            Currently selected
          </span>
        ) : (
          <span className="ml-auto rounded-[5px] border border-[rgba(150,178,205,0.14)] px-[7px] py-0.5 text-[8.5px] tracking-[0.05em] text-[var(--vk-note-quiet)] uppercase">
            Select
          </span>
        )}
      </div>

      {/* Head: name/sub · match% (design `.cd-head`, thumb removed) */}
      <div className="flex items-center gap-[11px]">
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'text-[13px] leading-[1.15] font-semibold break-words',
              product.recommended
                ? 'text-[var(--vk-gold-soft)]'
                : 'text-[var(--vk-text-strong)]'
            )}
          >
            {product.name}
          </div>
          {(product.brand || product.variant) && (
            <div className="mt-0.5 truncate text-[10.5px] text-[var(--vk-note-quiet)]">
              {[product.brand, product.variant].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        {scores && (
          <div className="flex-none text-right">
            <MatchPct
              value={scores.match}
              className="block text-[17px] leading-none font-semibold text-[var(--vk-gold-soft)]"
            />
            <span className="text-[8px] tracking-[0.05em] text-[var(--vk-note-quiet)] uppercase">
              match{scores.estimated ? ' · est.' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Price line */}
      {price ? (
        <div className="-mt-[5px] flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[15px] font-semibold text-[var(--vk-gold-soft)] tabular-nums">
            {price}
          </span>
          {product.old_price !== undefined && (
            <span className="text-[11px] text-[var(--vk-text-faint)] tabular-nums line-through">
              {formatMoney(product.old_price, product.currency)}
            </span>
          )}
          {product.discount_pct ? (
            <span className="rounded-full border border-[rgba(95,168,107,0.45)] bg-[rgba(95,168,107,0.12)] px-1.5 py-px text-[10px] font-bold text-[#9FD8AC]">
              −{product.discount_pct}%
            </span>
          ) : null}
          {product.price_verified && (
            <span
              className="text-[9px] font-semibold tracking-[0.04em] text-[var(--vk-text-faint)] uppercase"
              title={
                product.price_checked_at
                  ? t('prod.livePriceChecked', {
                      when: new Date(product.price_checked_at).toLocaleString(),
                    })
                  : t('prod.livePrice')
              }
            >
              live
            </span>
          )}
        </div>
      ) : (
        <div className="-mt-[5px] text-[11px] text-[var(--vk-text-faint)]">
          Price unavailable — no live listing matched
        </div>
      )}

      {/* Why it made the shortlist (design `.cd-why`, 2-line clamp) */}
      {why && (
        <div
          dir="auto"
          className="line-clamp-2 text-[11.5px] leading-[1.4] text-[var(--vk-text-subtle)]"
        >
          {why}
        </div>
      )}

      {/* Key specs (design `.cd-kv` rhythm — real spec strings only) */}
      {product.key_specs && product.key_specs.length > 0 && (
        <div className="mt-auto flex flex-col gap-[3px]">
          {product.key_specs.slice(0, 4).map((spec) => (
            <div
              key={spec}
              className="flex items-baseline gap-1.5 text-[10.5px] leading-[1.35] text-[var(--vk-text-muted)]"
            >
              <span
                aria-hidden="true"
                className="h-1 w-1 flex-none translate-y-[-1px] rounded-full bg-[rgba(242,193,78,0.5)]"
              />
              <span className="min-w-0 break-words">{spec}</span>
            </div>
          ))}
        </div>
      )}

      {product.source_url && (
        <a
          href={product.source_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-[#243b32] underline-offset-2 hover:underline"
        >
          View listing{product.seller ? ` — ${product.seller}` : ''} ↗
        </a>
      )}
    </div>
  );
}

/** Legacy flat report view — for payloads without the time-window periods. */
function BuyerFlatReport({ report }: { report: ResearchReport }) {
  const t = useT();
  return (
    <div className="mt-4 flex flex-col gap-2.5">
      {report.satisfaction && (
        <p className="m-0 text-[13.5px] leading-[1.6] break-words text-[var(--vk-text-subtle)]">
          {report.satisfaction}
        </p>
      )}
      {report.reliability && (
        <p className="m-0 text-[12.5px] leading-[1.55] break-words text-[var(--vk-text-muted)]">
          Reliability: {report.reliability}
        </p>
      )}
      {(
        [
          [t('prod.ownersLike'), report.pros, 'bg-[var(--vk-success)]'],
          [t('prod.complaints'), report.cons, 'bg-[var(--vk-warning)]'],
          [
            t('prod.recurring'),
            report.recurring_issues,
            'bg-[var(--vk-danger)]',
          ],
        ] as const
      ).map(([title, points, dot]) =>
        points?.length ? (
          <div key={title}>
            <div className="mb-1.5 text-[11px] font-bold tracking-[0.05em] text-[var(--vk-text-muted)] uppercase">
              {title}
            </div>
            <div className="flex flex-col gap-[7px]">
              {points.map((point) => (
                <div key={point} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      'mt-[7px] h-[5px] w-[5px] flex-none rounded-full',
                      dot
                    )}
                  />
                  <span className="text-[12.5px] leading-[1.55] break-words text-[var(--vk-text-subtle)]">
                    {point}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}

function BuyerExperience({
  product,
  report,
}: {
  product: CandidateProduct;
  report: ResearchReport | null;
}) {
  const t = useT();
  // Only windows with data arrive; the first one is the default tab.
  const periods = report?.periods ?? [];
  const [activeId, setActiveId] = React.useState(periods[0]?.id ?? null);
  const active = periods.find((p) => p.id === activeId) ?? periods[0] ?? null;

  return (
    <div className="bg-[rgba(249, 248, 242, 0.56)] mt-[18px] rounded-2xl border border-[var(--vk-border)] p-[22px]">
      <div className="flex items-start gap-[11px]">
        <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] border border-[rgba(232,137,46,0.3)] bg-[rgba(232,137,46,0.12)] text-[var(--vk-gold-soft)]">
          <Calendar size={18} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="m-0 text-base font-semibold tracking-[-0.01em] text-[var(--vk-text-strong)]">
            Real buyer experience
          </h3>
          <p className="mt-[5px] mb-0 text-[13px] leading-[1.5] text-[var(--vk-text-muted)]">
            What owners typically say about the{' '}
            <strong className="font-semibold text-[var(--vk-text-subtle)]">
              {product.name}
            </strong>{' '}
            over time.
          </p>
        </div>
      </div>

      {periods.length > 0 ? (
        <>
          <div
            role="tablist"
            aria-label={t('ws.timeSince')}
            className="bg-[rgba(249, 248, 242, 0.6)] mt-4 grid gap-1.5 rounded-xl border border-[rgba(150,178,205,0.14)] p-1"
            style={{
              gridTemplateColumns: `repeat(${periods.length}, minmax(0, 1fr))`,
            }}
          >
            {periods.map((period) => {
              const isActive = period.id === (active?.id ?? null);
              return (
                <button
                  key={period.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveId(period.id)}
                  className={cn(
                    'inline-flex cursor-pointer items-center justify-center rounded-[9px] border px-3 py-[9px] text-[13px] font-semibold outline-none',
                    'transition-[background,color,border-color] duration-[180ms] ease-[var(--vk-ease-standard)]',
                    'focus-visible:shadow-[0_0_0_2px_rgba(232,137,46,0.35)]',
                    isActive
                      ? 'border-[rgba(232,137,46,0.44)] bg-[rgba(232,137,46,0.12)] text-[var(--vk-gold-soft)]'
                      : 'border-transparent text-[var(--vk-text-muted)] hover:bg-[rgba(120,150,180,0.07)] hover:text-[var(--vk-text-subtle)]'
                  )}
                >
                  {period.label ?? PERIOD_LABELS[period.id]}
                </button>
              );
            })}
          </div>

          {active && (
            <div
              key={active.id}
              role="tabpanel"
              className="mt-4 flex [animation:vk-fade-in_220ms_cubic-bezier(0.2,0,0,1)] flex-col gap-2.5"
            >
              {active.summary && (
                <p className="m-0 text-[13.5px] leading-[1.6] break-words text-[var(--vk-text-subtle)]">
                  {active.summary}
                </p>
              )}
              {active.points && active.points.length > 0 && (
                <div className="flex flex-col gap-[9px]">
                  {active.points.map((point) => (
                    <div key={point} className="flex items-start gap-2.5">
                      <span className="mt-[5px] h-[5px] w-[5px] flex-none rounded-full bg-[var(--vk-accent)]" />
                      <span className="text-[12.5px] leading-[1.55] break-words text-[var(--vk-text-subtle)]">
                        {point}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {active.data_quality && active.data_quality !== 'full' && (
                <span className="text-[10.5px] text-[var(--vk-text-faint)]">
                  {active.data_quality === 'limited'
                    ? 'Limited data for this window'
                    : 'Not verified — treat as indicative'}
                </span>
              )}
            </div>
          )}
        </>
      ) : report ? (
        <BuyerFlatReport report={report} />
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-[rgba(150,178,205,0.2)] px-4 py-3.5 text-[13px] leading-[1.5] text-[var(--vk-text-muted)]">
          Buyer experience insights are not available for this product yet.
        </div>
      )}

      {report?.source_note && (
        <p className="mt-3 mb-0 text-[11.5px] leading-[1.5] break-words text-[var(--vk-note)]">
          {report.source_note}
        </p>
      )}
    </div>
  );
}

function IfIWereYouTeaser({
  recommendation,
}: {
  recommendation: Recommendation;
}) {
  const t = useT();
  const iiwy = recommendation.if_i_were_you;
  const text = iiwy?.text ?? recommendation.summary ?? null;
  const level =
    iiwy?.confidence_level ??
    recommendation.decision_summary?.confidence_level ??
    null;
  const scores = recommendation.recommendation?.scores ?? null;
  const changes = recommendation.confidence_detail?.what_would_change ?? [];
  const checked = recommendation.generated_at
    ? formatRelativeTime(recommendation.generated_at)
    : null;

  if (!text && !scores) return null;

  return (
    <div className="bg-linear-[135deg,rgba(232,137,46,0.1),rgba(249, 248, 242, 0.9)_55%] mt-[18px] flex gap-[15px] rounded-2xl border border-l-[3px] border-[rgba(232,137,46,0.3)] border-l-[var(--vk-accent)] px-[22px] py-5">
      <div className="shadow-[inset_0_2px_8px_rgba(249, 248, 242, 0.3)] flex h-[74px] w-[58px] flex-none items-center justify-center rounded-[13px] border border-[rgba(150,178,205,0.18)] bg-radial-[120%_90%_at_50%_25%,rgba(232,137,46,0.14),rgba(150,178,205,0.02)_70%]">
        <LogoMark size={46} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="m-0 text-base font-semibold tracking-[-0.01em] text-[var(--vk-text-strong)]">
            If I were you
          </h3>
          {level && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B8DFC0] capitalize">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7FC08B]" />
              {level} confidence
            </span>
          )}
        </div>
        {text && (
          <p className="mt-[9px] mb-0 max-w-[800px] text-sm leading-[1.65] break-words text-[var(--vk-text-subtle)]">
            {text}
          </p>
        )}
        {scores && (
          <div className="mt-4 rounded-[13px] border border-[rgba(95,168,107,0.24)] bg-[rgba(95,168,107,0.06)] px-4 py-[15px]">
            <div className="mb-3 text-[11px] font-bold tracking-[0.05em] text-[var(--vk-text-muted)] uppercase">
              Why it fits you
            </div>
            <div className="flex flex-col gap-[11px]">
              {(
                [
                  [
                    t('prod.lumoraScore'),
                    scores.lumora / 10,
                    scores.lumora > 9,
                    scores.lumora.toFixed(1),
                  ],
                  [
                    t('prod.personalScore'),
                    scores.personal / 10,
                    scores.personal > 9,
                    scores.personal.toFixed(1),
                  ],
                  [
                    t('ws.matchScore'),
                    scores.match / 100,
                    scores.match > 90,
                    `${Math.round(scores.match)}%`,
                  ],
                ] as const
              ).map(([label, fraction, strong, valueLabel]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-24 flex-none text-[12.5px] text-[var(--vk-text-subtle)]">
                    {label}
                  </span>
                  <ScoreBar
                    fraction={fraction}
                    tone={strong ? 'success' : 'accent'}
                  />
                  <span className="min-w-[26px] flex-none text-right font-mono text-[12.5px] font-semibold text-[var(--vk-text-strong)]">
                    {valueLabel}
                  </span>
                </div>
              ))}
            </div>
            {scores.estimated && (
              <div className="mt-2.5 text-[10.5px] text-[var(--vk-text-faint)]">
                Estimated by Lumora — not a measured score
              </div>
            )}
          </div>
        )}
        {(changes.length > 0 || checked) && (
          <p className="mt-3 mb-0 text-[11.5px] leading-[1.5] break-words text-[var(--vk-note)]">
            {changes.length > 0 &&
              `What could change this: ${changes.join(', ')}.`}
            {changes.length > 0 && checked && ' '}
            {checked && `Last checked ${checked}.`}
          </p>
        )}
      </div>
    </div>
  );
}

export function PanelProducts({
  candidates,
  requirement,
  research,
  recommendation,
  selectedIds,
  analysing = false,
  analysisProgress = null,
  onToggleProduct,
  onCompareSelected,
  streaming,
}: {
  candidates: CandidateSet;
  requirement: RequirementPayload | null;
  research: ResearchSet | null;
  /** Present once the recommendation stage has run — closes the tab. */
  recommendation: Recommendation | null;
  selectedIds: ReadonlySet<string>;
  /** The detached analysis job is running — the CTA reports it, not `streaming`. */
  analysing?: boolean;
  analysisProgress?: { pct: number; label: string; detail?: string } | null;
  onToggleProduct: (product: CandidateProduct) => void;
  onCompareSelected: () => void;
  streaming: boolean;
}) {
  const t = useT();

  const products = candidates.products ?? [];
  const comparison = candidates.comparison;
  const summary = requirement?.summary;
  const [eliminationOpen, setEliminationOpen] = React.useState(false);
  const [confidenceOpen, setConfidenceOpen] = React.useState(false);

  const focusProduct =
    products.find((p) => selectedIds.has(p.id)) ??
    products.find((p) => p.recommended) ??
    products[0] ??
    null;
  const focusReport =
    (focusProduct &&
      research?.reports?.find(
        (r) =>
          (r.product_id && r.product_id === focusProduct.id) ||
          r.product === focusProduct.name
      )) ||
    null;

  const requirementConfidencePct = summary
    ? Math.round(Math.min(1, Math.max(0, summary.requirement_confidence)) * 100)
    : null;

  const columnProducts = comparison
    ? comparison.products.map(
        (name, index) =>
          products.find(
            (p) =>
              (comparison.product_ids?.[index] !== undefined &&
                p.id === comparison.product_ids[index]) ||
              p.name === name
          ) ?? null
      )
    : [];

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[rgba(150,178,205,0.2)] p-[22px] text-center">
        <div className="text-sm font-semibold text-[var(--vk-text-strong)]">
          No products to compare yet
        </div>
        <div className="mt-1.5 text-[13px] leading-[1.5] text-[var(--vk-text-muted)]">
          Keep answering Lumora&rsquo;s questions — the shortlist appears here
          once discovery has run.
        </div>
      </div>
    );
  }

  return (
    <div className="vk-ws-seq">
      {/* Decision preview — the deterministic requirement confidence */}
      {summary && requirementConfidencePct !== null && (
        <div className="mb-[18px]">
          <div className="mb-2.5 text-[11px] font-bold tracking-[0.06em] text-[var(--vk-text-muted)] uppercase">
            Lumora decision preview
            {requirement?.category && ` — ${requirement.category}`}
          </div>
          <div className="bg-[rgba(249, 248, 242, 0.56)] rounded-[14px] border border-[var(--vk-border)] px-[18px] py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-none">
                <div className="text-sm font-semibold text-[var(--vk-text-strong)]">
                  Requirement Confidence
                </div>
                {summary.confidence_explanation && (
                  <button
                    type="button"
                    onClick={() => setConfidenceOpen((v) => !v)}
                    aria-expanded={confidenceOpen}
                    className="mt-[3px] inline-flex cursor-pointer items-center gap-[5px] border-0 border-b border-dashed border-[rgba(232,137,46,0.42)] bg-transparent p-0 text-xs text-[var(--vk-text-muted)] transition-colors hover:text-[var(--vk-text-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)]"
                  >
                    Why {requirementConfidencePct}%?
                  </button>
                )}
              </div>
              <ScoreBar
                fraction={summary.requirement_confidence}
                tone="success"
                className="h-2 min-w-[120px]"
              />
              <div className="flex-none font-mono text-[19px] font-bold text-[var(--vk-text-strong)]">
                {requirementConfidencePct}%
              </div>
            </div>
            {confidenceOpen && summary.confidence_explanation && (
              <p className="mt-3 mb-0 text-[12.5px] leading-[1.55] break-words text-[var(--vk-text-muted)]">
                {summary.confidence_explanation}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Criteria chips from the requirement summary — the panel keeps them
          all quiet (the ready card is where hard constraints stand apart). */}
      {summary?.chips && summary.chips.length > 0 && (
        <div className="mb-[18px] flex flex-wrap items-center gap-2">
          <span className="mr-0.5 text-[11px] font-bold tracking-[0.06em] text-[var(--vk-text-muted)] uppercase">
            Your criteria
          </span>
          {[
            ...(requirement?.category
              ? [{ id: '__category', label: requirement.category }]
              : []),
            ...summary.chips,
          ].map((chip) => (
            <span
              key={chip.id}
              className="rounded-full border border-[rgba(150,178,205,0.2)] bg-[rgba(150,178,205,0.06)] px-[11px] py-1.5 text-xs text-[var(--vk-text-subtle)]"
            >
              {chip.label}
            </span>
          ))}
        </div>
      )}

      {/* Decision focus (design `.df-bars`): what the comparison is weighted
          around — the backend's estimated buying-profile weights. A weight it
          could not compute is absent, never zero. */}
      {(summary?.buying_profile?.weights?.filter(
        (w) => typeof w.weight_pct === 'number'
      ).length ?? 0) > 0 && (
        <div className="mb-[18px]">
          <GmHead
            eye="Your decision focus"
            sub="What the comparison below is weighted around"
          />
          <div className="flex flex-col gap-2">
            {summary!
              .buying_profile!.weights!.filter(
                (w) => typeof w.weight_pct === 'number'
              )
              .slice()
              .sort((a, b) => b.weight_pct! - a.weight_pct!)
              .map((weight) => (
                <div
                  key={weight.id}
                  className="grid grid-cols-[104px_1fr] items-center gap-3"
                >
                  <span className="truncate text-[12px] text-[var(--vk-text-strong)]">
                    {weight.label}
                  </span>
                  <span className="h-2 overflow-hidden rounded-[4px] bg-[rgba(150,178,205,0.14)]">
                    <span
                      className="block h-full rounded-[inherit] bg-linear-[90deg,#348568,#28765c]"
                      style={{
                        width: `${Math.min(100, Math.max(0, weight.weight_pct!))}%`,
                      }}
                    />
                  </span>
                </div>
              ))}
          </div>
          {summary!.buying_profile!.estimated && (
            <div className="mt-1.5 text-[10.5px] text-[var(--vk-text-faint)]">
              Estimated from your conversation — not a measured weighting
            </div>
          )}
        </div>
      )}

      {/* Finalist cards (design `.cd-cards`: three equal columns) */}
      <div className="vk-anim-in-up">
        <GmHead
          eye={`The ${products.length} finalists`}
          sub="Who’s in the running — and the role each plays"
        />
        <div className="grid grid-cols-1 items-stretch gap-2.5 sm:grid-cols-3">
          {products.map((product) => (
            <CandidateCard
              key={product.id}
              product={product}
              selected={selectedIds.has(product.id)}
              disabled={streaming}
              onToggle={() => onToggleProduct(product)}
            />
          ))}
        </div>
      </div>

      {/* The decision CTA.
          It used to send a selection message, which ran the pipeline inside a
          turn deadline that cannot fund the evidence stages — so it always
          ended with the recommendation withheld. It now runs the detached
          analysis job, which weighs every finalist with no deadline. The
          selection no longer narrows it, so the button no longer says it
          does. */}
      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={analysing || streaming}
          onClick={onCompareSelected}
          className={cn(
            'inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[11px] border border-[rgba(232,137,46,0.48)] bg-linear-[150deg,#348568,#28765c] px-4 text-[13px] font-semibold text-[var(--vk-on-accent)] outline-none',
            'shadow-[0_10px_26px_-8px_rgba(232,137,46,0.5)]',
            'transition-[transform,background] duration-[var(--vk-duration-fast)] ease-[var(--vk-ease-standard)]',
            'hover:-translate-y-px hover:bg-linear-[150deg,#F6BC5C,#F09A3B]',
            'focus-visible:shadow-[0_0_0_3px_var(--vk-accent-ring)]',
            'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0'
          )}
        >
          {analysing ? t('prod.analysing') : t('prod.runAnalysis')}
        </button>
        <span className="text-xs text-[var(--vk-text-muted)]">
          {t('prod.analysisNote')}
        </span>
      </div>
      {analysisProgress && (
        <div className="mt-2.5 flex flex-wrap items-baseline gap-2 text-xs text-[var(--vk-text-muted)]">
          <span className="font-semibold text-[var(--vk-gold-soft)]">
            {analysisProgress.pct}%
          </span>
          <span>{analysisProgress.label}</span>
          {analysisProgress.detail && (
            <span className="text-[var(--vk-note-quiet)]">
              · {analysisProgress.detail}
            </span>
          )}
        </div>
      )}

      {/* Real buyer experience (research stage) — reset per product */}
      {focusProduct && research && (
        <BuyerExperience
          key={focusProduct.id}
          product={focusProduct}
          report={focusReport}
        />
      )}

      {/* Lumora confidence */}
      {comparison?.lumora_confidence && (
        <div className="bg-linear-[135deg,rgba(232,137,46,0.1),rgba(249, 248, 242, 0.5)] mt-[18px] rounded-2xl border border-[rgba(232,137,46,0.28)] px-[22px] py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-[9px]">
                <LogoMark size={22} />
                <h3 className="m-0 text-base font-semibold tracking-[-0.01em] text-[var(--vk-text-strong)]">
                  Lumora Confidence
                </h3>
              </div>
              {comparison.lumora_confidence.explanation && (
                <p className="mt-[7px] mb-0 text-[13px] leading-[1.5] break-words text-[var(--vk-text-muted)]">
                  {comparison.lumora_confidence.explanation}
                </p>
              )}
            </div>
            <span className="inline-flex flex-none items-center gap-[7px] rounded-full border border-[rgba(95,168,107,0.42)] bg-[rgba(95,168,107,0.15)] px-[13px] py-[9px] text-[13px] font-semibold text-[#B8DFC0] capitalize">
              <Check size={15} strokeWidth={2.3} aria-hidden="true" />
              {comparison.lumora_confidence.level} confidence
            </span>
          </div>
          {comparison.lumora_confidence.factors &&
            comparison.lumora_confidence.factors.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {comparison.lumora_confidence.factors.map((factor) => (
                  <span
                    key={factor.label}
                    className={cn(
                      'inline-flex items-center gap-[7px] rounded-full border px-3 py-[7px] text-xs',
                      factor.highlight
                        ? 'border-[rgba(232,137,46,0.4)] bg-[rgba(232,137,46,0.12)] font-semibold text-[var(--vk-gold-soft)]'
                        : 'border-[rgba(150,178,205,0.2)] bg-[rgba(150,178,205,0.05)] text-[var(--vk-text-subtle)]'
                    )}
                  >
                    {factor.highlight && (
                      <Check size={13} strokeWidth={2.4} aria-hidden="true" />
                    )}
                    {factor.label}
                  </span>
                ))}
              </div>
            )}
        </div>
      )}

      {/* Scan summary — only real numbers, absent means unknown */}
      {candidates.scan_summary &&
        candidates.scan_summary.scanned_count !== undefined && (
          <div className="mt-[18px] mb-3.5 flex items-start gap-[11px] rounded-[13px] border border-[rgba(95,168,107,0.24)] bg-[rgba(95,168,107,0.06)] px-3.5 py-[13px]">
            <Check
              size={17}
              strokeWidth={2}
              aria-hidden="true"
              className="mt-px flex-none text-[var(--vk-success)]"
            />
            <span className="text-[13px] leading-[1.55] text-[var(--vk-text-subtle)]">
              Scanned{' '}
              <strong className="font-semibold text-[var(--vk-text-strong)]">
                {candidates.scan_summary.scanned_count} products
              </strong>
              {candidates.scan_summary.eliminated_count !== undefined && (
                <>
                  {' '}
                  and eliminated{' '}
                  <strong className="font-semibold text-[var(--vk-text-strong)]">
                    {candidates.scan_summary.eliminated_count}
                  </strong>
                </>
              )}
              {' — '}
              <strong className="font-semibold text-[var(--vk-text-strong)]">
                {products.length} survived all filters
              </strong>
              .
            </span>
          </div>
        )}

      {/* Elimination reasons */}
      {candidates.elimination_reasons &&
        candidates.elimination_reasons.length > 0 && (
          <div className="bg-[rgba(249, 248, 242, 0.5)] mt-3.5 overflow-hidden rounded-[13px] border border-[rgba(150,178,205,0.14)]">
            <button
              type="button"
              onClick={() => setEliminationOpen((v) => !v)}
              aria-expanded={eliminationOpen}
              className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-3 text-left"
            >
              <X
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
                className="flex-none text-[var(--vk-text-muted)]"
              />
              <span className="flex-1 text-[13.5px] font-semibold text-[var(--vk-text)]">
                Why were products eliminated?
              </span>
              <span className="text-xs text-[var(--vk-note)]">
                {eliminationOpen ? 'Hide' : 'Show'} breakdown
              </span>
            </button>
            {eliminationOpen && (
              <div className="flex flex-col gap-2 px-3.5 pb-3.5 pl-10">
                {candidates.elimination_reasons.map((reason) => (
                  <div
                    key={reason}
                    className="flex gap-[9px] text-[12.5px] leading-[1.5] text-[var(--vk-text-muted)]"
                  >
                    <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-[var(--vk-warning)]" />
                    {reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      {/* Why these N survived */}
      {products.some((p) => p.survival_reason) && (
        <div className="mt-[18px]">
          <div className="mb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--vk-text-muted)] uppercase">
            Why these {products.length} survived
          </div>
          <div className="bg-[rgba(249, 248, 242, 0.56)] overflow-hidden rounded-2xl border border-[var(--vk-border)]">
            {products.map((product, index) => (
              <div
                key={product.id}
                className={cn(
                  'flex gap-[13px] px-4 py-3.5',
                  index > 0 && 'border-t border-[rgba(150,178,205,0.1)]'
                )}
              >
                {product.badge && (
                  <span
                    className={cn(
                      'h-fit flex-none rounded-full border px-2.5 py-1 text-[11px] font-bold',
                      BADGE_TONES[product.badge] ?? BADGE_TONES['Feature Pick']
                    )}
                  >
                    {product.badge}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--vk-text-strong)]">
                    {product.name}
                  </div>
                  {product.survival_reason && (
                    <div className="mt-[3px] text-[12.5px] leading-[1.55] break-words text-[var(--vk-text-muted)]">
                      {product.survival_reason}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preference vs Required note */}
      {summary?.preference_note && (
        <div className="mt-3.5 flex gap-3 rounded-[14px] border border-l-[3px] border-[rgba(201,154,78,0.26)] border-l-[var(--vk-warning)] bg-[rgba(201,154,78,0.06)] px-4 py-3.5">
          <TriangleAlert
            size={17}
            strokeWidth={1.9}
            aria-hidden="true"
            className="mt-px flex-none text-[var(--vk-warning)]"
          />
          <p className="m-0 min-w-0 text-[13px] leading-[1.6] break-words text-[var(--vk-text-subtle)]">
            {summary.preference_note.field && (
              <strong className="font-semibold text-[var(--vk-gold-soft)]">
                {summary.preference_note.field}:{' '}
              </strong>
            )}
            {emphasized(
              summary.preference_note.text,
              summary.preference_note.emphasis
            )}
          </p>
        </div>
      )}

      {/* The factor comparison — rows arrive category-aware; render as given */}
      {comparison && comparison.rows.length > 0 && (
        <div className="mt-[18px]">
          <GmHead
            eye={`The ${comparison.rows.length}-factor comparison`}
            sub="Every row is a real question — the bold cell wins it"
          />
          {/* No fixed min-width: the grid compresses to the panel (≥560px on
              desktop), so the factor column never scrolls out of view. The
              overflow guard only kicks in on very narrow phone viewports. */}
          <div className="overflow-x-auto rounded-2xl border border-[var(--vk-border)]">
            <div>
              <div
                className="bg-[rgba(249, 248, 242, 0.72)] grid"
                style={{
                  gridTemplateColumns: `1.5fr repeat(${comparison.products.length}, 1fr)`,
                }}
              >
                <div className="self-center px-3.5 py-3 text-[11px] font-bold tracking-[0.05em] text-[var(--vk-text-muted)] uppercase">
                  Factor
                </div>
                {comparison.products.map((name, index) => {
                  const columnProduct = columnProducts[index];
                  return (
                    <div
                      key={name}
                      className={cn(
                        'flex flex-col gap-0.5 px-3 py-3 text-center',
                        columnProduct?.recommended &&
                          'bg-[rgba(232,137,46,0.08)]'
                      )}
                    >
                      <span className="text-[13px] leading-[1.25] font-semibold break-words text-[var(--vk-text-strong)]">
                        {name}
                      </span>
                      {columnProduct?.badge && (
                        <span
                          className="text-[10.5px] font-bold tracking-[0.04em] uppercase"
                          style={{
                            color: BADGE_TEXT[columnProduct.badge] ?? '#C7C6C4',
                          }}
                        >
                          {columnProduct.badge}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {comparison.rows.map((row, rowIndex) => {
                const best =
                  row.kind === 'bar'
                    ? Math.max(
                        ...row.values.map((v) =>
                          typeof v === 'number' ? v : Number.NEGATIVE_INFINITY
                        )
                      )
                    : null;
                return (
                  <div
                    key={row.factor}
                    className={cn(
                      'grid items-stretch border-t border-[rgba(150,178,205,0.10)]',
                      rowIndex % 2 === 1 && 'bg-[rgba(150,178,205,0.02)]'
                    )}
                    style={{
                      gridTemplateColumns: `1.5fr repeat(${comparison.products.length}, 1fr)`,
                    }}
                  >
                    <div className="flex items-center border-r border-[rgba(150,178,205,0.08)] px-3.5 py-[11px] text-[13px] font-medium text-[var(--vk-text-subtle)]">
                      {row.factor}
                    </div>
                    {/* Alignment invariant: values[i] belongs to column i. */}
                    {row.values.map((value, columnIndex) => (
                      <div
                        key={columnIndex}
                        className={cn(
                          'flex min-w-0 items-center gap-[9px] px-3 py-[11px]',
                          row.kind === 'text' && 'justify-center',
                          columnProducts[columnIndex]?.recommended &&
                            'bg-[rgba(232,137,46,0.06)]'
                        )}
                      >
                        {row.kind === 'bar' && typeof value === 'number' ? (
                          // Design cell anatomy: toned meter over the value,
                          // ✓ on the row winner (`.cx-meter` + `.cx-v .cx-ck`).
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <Meter pct={value * 10} />
                            <span
                              className={cn(
                                'text-[12.5px] tabular-nums',
                                value === best
                                  ? 'font-semibold text-[var(--vk-text-strong)]'
                                  : 'text-[var(--vk-text-subtle)]'
                              )}
                            >
                              {value.toFixed(1)}
                              {value === best && (
                                <i className="ml-1 text-[11px] text-[#7cc79a] not-italic">
                                  ✓
                                </i>
                              )}
                            </span>
                          </div>
                        ) : (
                          <span
                            className={cn(
                              'text-center text-[13px] break-words text-[var(--vk-text-subtle)]',
                              /[0-9]/.test(String(value))
                                ? 'font-mono font-semibold'
                                : 'font-medium'
                            )}
                          >
                            {String(value)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Why cards */}
      {comparison?.why_cards && comparison.why_cards.length > 0 && (
        <div className="mt-[18px] grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {comparison.why_cards.map((card) => (
            <div
              key={card.product}
              className="bg-[rgba(249, 248, 242, 0.56)] flex flex-col gap-2.5 rounded-[14px] border border-[var(--vk-border)] p-4"
            >
              {/* The tag and dots carry the card's badge tone. */}
              <span
                className={cn(
                  'inline-flex self-start rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.02em]',
                  BADGE_TONES[card.title] ??
                    'border-[rgba(232,137,46,0.4)] bg-[rgba(232,137,46,0.12)] text-[var(--vk-gold-soft)]'
                )}
              >
                Why&nbsp;{card.title}
              </span>
              <h4 className="m-0 text-sm font-semibold text-[var(--vk-text-strong)]">
                {card.product}
              </h4>
              <div className="flex flex-col gap-[9px]">
                {card.points.map((point) => (
                  <div
                    key={point}
                    className="flex gap-[9px] text-[12.5px] leading-[1.5] text-[var(--vk-text-subtle)]"
                  >
                    <span
                      className="mt-1.5 h-[5px] w-[5px] flex-none rounded-full"
                      style={{
                        background: BADGE_DOT[card.title] ?? 'var(--vk-accent)',
                      }}
                    />
                    <span className="break-words">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Final recommendation teaser — design's closing block for this tab */}
      {recommendation && <IfIWereYouTeaser recommendation={recommendation} />}

      {candidates.notes && (
        <p className="mt-3.5 mb-0 text-xs leading-[1.55] break-words text-[var(--vk-text-muted)]">
          {candidates.notes}
        </p>
      )}
    </div>
  );
}
