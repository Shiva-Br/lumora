'use client';

import { ExternalLink, Package } from 'lucide-react';
import * as React from 'react';

import {
  CardEye,
  GmAlternatives,
  GmBoundary,
  type BoundaryItem,
  GmCall,
  GmContext,
  GmDecisive,
  GmEvidence,
  GmGlance,
  GmHead,
  GmOpen,
  GmPending,
  GmTrust,
  MatchPct,
  contextMetaFromWorld,
  meterTone,
} from '@/components/lumora/chat/workspace-bits';
import type {
  AnalysisPayload,
  CandidateProduct,
  CandidateSet,
  ComparisonTable,
  Recommendation,
  RequirementPayload,
} from '@/lib/api/types';
import { formatMoney, formatShortDate } from '@/lib/format';
import type { Translate } from '@/lib/i18n';
import { useT } from '@/lib/i18n/provider';
import type { WorldContext } from '@/lib/taxonomy/resolve';
import { cn } from '@/lib/utils';

type Finalist = AnalysisPayload['compare']['finalists'][number];
type MarketOffer = AnalysisPayload['market']['items'][number]['offers'][number];

type PriorityRow = {
  label: string;
  score: number;
  why?: string;
};

type CompareCell = {
  value: string;
  score: number;
};

type CompareGroup = {
  label: string;
  rows: {
    factor: string;
    priority: boolean;
    cells: CompareCell[];
  }[];
};

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// Takes the translator rather than returning English: these helpers build
// display data outside any component, so they cannot call a hook themselves.
function importanceLabel(score: number, t: Translate): string {
  if (score >= 85) return t('importance.veryHigh');
  if (score >= 70) return t('importance.high');
  if (score >= 55) return t('importance.important');
  return t('importance.moderate');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function titleKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function productForFinalist(
  finalist: Finalist,
  candidates?: CandidateSet | null
): CandidateProduct | null {
  const products = candidates?.products ?? null;
  if (!products) return null;
  return (
    products.find(
      (product) =>
        product.id === finalist.product_id || product.name === finalist.name
    ) ?? null
  );
}

function compareProductByName(
  name: string,
  candidates?: CandidateSet | null
): CandidateProduct | null {
  const products = candidates?.products ?? null;
  if (!products) return null;
  return products.find((product) => product.name === name) ?? null;
}

function priceLabel(product: CandidateProduct | null): string | null {
  if (!product) return null;
  if (product.price_unavailable) return null;
  if (product.price_range?.min !== undefined) {
    return formatMoney(
      product.price_range.min,
      product.price_range.currency ?? product.currency
    );
  }
  if (product.approx_price !== undefined) {
    return formatMoney(product.approx_price, product.currency);
  }
  return null;
}

function finalistPrice(finalist: Finalist, candidate: CandidateProduct | null) {
  return finalist.price ?? priceLabel(candidate);
}

function derivePriorityRows(
  analysis: AnalysisPayload,
  requirement?: RequirementPayload | null
): PriorityRow[] {
  const fits = analysis.rec.fit ?? [];
  const whyMap = new Map(
    (analysis.rec.why_won ?? []).map((row) => [
      titleKey(row.priority),
      row.performance,
    ])
  );
  const optimizedMap = new Map(
    (analysis.rec.optimized ?? []).map((item) => [
      titleKey(item.title),
      item.line,
    ])
  );

  if (fits.length > 0) {
    return fits
      .map((fit) => ({
        label: fit.label,
        score: clampPct(fit.score),
        why:
          whyMap.get(titleKey(fit.label)) ??
          optimizedMap.get(titleKey(fit.label)),
      }))
      .sort((a, b) => b.score - a.score);
  }

  const weights =
    requirement?.summary?.buying_profile?.weights?.filter(
      (weight) => typeof weight.weight_pct === 'number'
    ) ?? [];
  if (weights.length > 0) {
    return weights
      .map((weight) => ({
        label: weight.label,
        score: clampPct(weight.weight_pct ?? 0),
        why: weight.chip,
      }))
      .sort((a, b) => b.score - a.score);
  }

  return (analysis.rec.optimized ?? []).map((item, index) => ({
    label: item.title,
    score: Math.max(58, 92 - index * 10),
    why: item.line,
  }));
}

function deriveDecisionWhyPage(
  analysis: AnalysisPayload,
  priorities: PriorityRow[]
): React.ReactNode {
  const top = priorities.slice(0, 2).map((row) => row.label);
  if (top.length >= 2) {
    return (
      <>
        This page keeps the recommendation anchored to <b>{top[0]}</b> and{' '}
        <b>{top[1]}</b>, so the winner is judged against your real priorities
        instead of the biggest specification sheet.
      </>
    );
  }
  return analysis.rec.summary ?? analysis.goal ?? null;
}

function deriveCompareWhyPage(priorities: PriorityRow[]): React.ReactNode {
  const top = priorities.slice(0, 2).map((row) => row.label);
  if (top.length >= 2) {
    return (
      <>
        This comparison is weighted around <b>{top[0]}</b> and <b>{top[1]}</b>,
        not around raw specifications alone.
      </>
    );
  }
  return 'This page compares the finalists against the priorities that matter most to you.';
}

function deriveMarketWhyPage(
  productName: string | null,
  offerCount: number
): React.ReactNode {
  if (productName) {
    return (
      <>
        This page shifts from product fit to buying risk for{' '}
        <b>{productName}</b>: verified price, seller trust, warranty, returns
        and delivery.
        {offerCount > 0
          ? ` ${offerCount} real offer${offerCount === 1 ? '' : 's'} are in scope.`
          : ''}
      </>
    );
  }
  return 'This page narrows the decision from product fit to buying risk: price, trust, warranty and returns.';
}

function deriveGlanceItems(analysis: AnalysisPayload, t: Translate) {
  const rows = analysis.rec.why_won ?? [];
  const protectedCount = rows.filter((row) => row.ok === 'yes').length;
  const broken = rows.filter((row) => row.ok === 'no').length;
  const sacrifice =
    rows.filter((row) => row.ok === 'ok').length +
    (analysis.rec.best.tradeoffs?.length ?? 0);

  // Zeroes are meaningful ONLY once there is a board to count. With no
  // `why_won` rows at all, "0 · 0 · 0" is not reassurance, it is three empty
  // pills claiming a decision was checked.
  if (rows.length === 0 && sacrifice === 0) return [];

  return [
    { n: String(protectedCount), l: t('ws.nonNegotiables') },
    { n: String(broken), l: t('ws.dealBreakersHit'), amb: broken > 0 },
    { n: String(sacrifice), l: t('ws.acceptableSacrifice'), amb: true },
  ];
}

function deriveTrustBullets(
  analysis: AnalysisPayload,
  recommendation?: Recommendation | null
): React.ReactNode[] {
  const bullets: React.ReactNode[] = [];

  for (const row of (analysis.rec.why_won ?? []).slice(0, 3)) {
    bullets.push(
      <>
        It stays strong on <b>{row.priority}</b>
        {row.performance ? ` — ${row.performance}` : ''}.
      </>
    );
  }

  for (const point of analysis.rec.best.why ?? []) {
    if (bullets.length >= 3) break;
    bullets.push(point);
  }

  if (
    bullets.length < 3 &&
    recommendation?.confidence_detail?.explanation &&
    !bullets.some(
      (bullet) => bullet === recommendation.confidence_detail?.explanation
    )
  ) {
    bullets.push(recommendation.confidence_detail.explanation);
  }

  return bullets.slice(0, 3);
}

/** The backend bolds the pivotal phrase with **asterisks**; render it. */
function renderBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, index) =>
    index % 2 === 1 ? <b key={index}>{part}</b> : part
  );
}

function deriveBoundaryItems(
  analysis: AnalysisPayload | null,
  recommendation?: Recommendation | null
): BoundaryItem[] {
  if (analysis?.rec.boundary?.length) {
    return analysis.rec.boundary.map((row) => ({
      when: row.if,
      text: renderBold(row.then),
    }));
  }
  if ((recommendation?.conditional?.length ?? 0) > 0) {
    return recommendation!.conditional!.map((branch) => ({
      when: branch.if,
      text: (
        <>
          I would switch to <b>{branch.then_product}</b>
          {branch.why ? ` — ${branch.why}` : ''}.
        </>
      ),
    }));
  }

  return (recommendation?.confidence_detail?.what_would_change ?? []).map(
    (item) => ({ text: item })
  );
}

function deriveReasoningRows(
  analysis: AnalysisPayload,
  priorities: PriorityRow[],
  t: Translate
) {
  if (analysis.rec.reasoning_flow?.length) {
    return analysis.rec.reasoning_flow.map((step) => ({
      priority: step.priority,
      weight: step.weight ?? 'Medium',
      rule: step.rule,
      effect: step.effect,
    }));
  }
  const reasons = analysis.rec.reasoning ?? [];
  return reasons.slice(0, 4).map((reason, index) => ({
    priority:
      priorities[index]?.label ??
      (index === 0
        ? (analysis.goal ?? t('ws.yourPriorities'))
        : `Step ${index + 1}`),
    weight: index < 2 ? 'High' : 'Medium',
    rule: reason,
    effect:
      index === reasons.length - 1
        ? `${analysis.rec.best.name} remains ahead.`
        : index === 0
          ? 'Shapes the shortlist.'
          : 'Narrows the decision further.',
  }));
}

function deriveTradeoffRows(analysis: AnalysisPayload) {
  if (analysis.rec.tradeoffs_rec?.length) {
    return analysis.rec.tradeoffs_rec.map((row) => ({
      gain: row.gain,
      give: row.give,
      why: row.why,
    }));
  }
  const gains =
    analysis.rec.best.why ??
    (analysis.rec.why_won ?? []).map((row) =>
      row.performance ? `${row.priority} — ${row.performance}` : row.priority
    );
  const gives =
    analysis.rec.best.tradeoffs ??
    (analysis.rec.avoided ?? []).map((item) => item.reason);
  const count = Math.max(gains.length, gives.length);

  return Array.from({ length: count }, (_, index) => ({
    gain: gains[index] ?? '—',
    give: gives[index] ?? '—',
    why: analysis.rec.avoided?.[index]?.reason,
  })).filter((row) => row.gain !== '—' || row.give !== '—');
}

function normalizeCompareCell(cell: unknown): CompareCell | null {
  if (typeof cell === 'string') return { value: cell, score: 0 };
  if (typeof cell === 'number') {
    return {
      value: String(cell),
      score: clampPct(cell <= 10 ? cell * 10 : cell),
    };
  }
  const record = asRecord(cell);
  if (!record) return null;
  const value =
    asString(record.value) ??
    asString(record.v) ??
    asString(record.label) ??
    asString(record.text);
  if (!value) return null;
  const score =
    asNumber(record.score) ??
    asNumber(record.s) ??
    asNumber(record.pct) ??
    asNumber(record.match) ??
    0;
  return {
    value,
    score: clampPct(score <= 10 ? score * 10 : score),
  };
}

function normalizeCompareGroups(
  table: unknown,
  columnCount: number
): CompareGroup[] {
  const source = Array.isArray(table)
    ? table
    : Array.isArray(asRecord(table)?.groups)
      ? ((asRecord(table)?.groups as unknown[]) ?? [])
      : Array.isArray(asRecord(table)?.rows)
        ? [table]
        : [];

  const groups: CompareGroup[] = [];
  for (const entry of source) {
    const groupRecord = asRecord(entry);
    if (!groupRecord) continue;
    const label =
      asString(groupRecord.label) ?? asString(groupRecord.g) ?? 'Comparison';
    const rawRows = Array.isArray(groupRecord.rows)
      ? groupRecord.rows
      : Array.isArray(entry)
        ? entry
        : [];
    const rows: CompareGroup['rows'] = [];

    for (const rawRow of rawRows) {
      if (Array.isArray(rawRow)) {
        const [factor, cells, priority] = rawRow;
        if (typeof factor !== 'string' || !Array.isArray(cells)) continue;
        const normalized = cells
          .map((cell) => normalizeCompareCell(cell))
          .filter((cell): cell is CompareCell => Boolean(cell))
          .slice(0, columnCount);
        if (normalized.length === columnCount) {
          rows.push({
            factor,
            priority: priority === true,
            cells: normalized,
          });
        }
        continue;
      }

      const rowRecord = asRecord(rawRow);
      if (!rowRecord) continue;
      const factor =
        asString(rowRecord.factor) ??
        asString(rowRecord.label) ??
        asString(rowRecord.name);
      const rawCells = Array.isArray(rowRecord.cells)
        ? rowRecord.cells
        : Array.isArray(rowRecord.values)
          ? rowRecord.values
          : null;
      if (!factor || !rawCells) continue;
      const normalized = rawCells
        .map((cell) => normalizeCompareCell(cell))
        .filter((cell): cell is CompareCell => Boolean(cell))
        .slice(0, columnCount);
      if (normalized.length === columnCount) {
        rows.push({
          factor,
          priority: rowRecord.priority === true,
          cells: normalized,
        });
      }
    }

    if (rows.length > 0) groups.push({ label, rows });
  }

  return groups;
}

function evidenceFromGroups(finalists: Finalist[], groups: CompareGroup[]) {
  if (groups.length === 0) return [];
  const counts = finalists.map(() => ({
    strong: 0,
    acceptable: 0,
    tradeoffs: 0,
    dealbreakers: 0,
  }));

  for (const group of groups) {
    for (const row of group.rows) {
      row.cells.forEach((cell, index) => {
        if (cell.score >= 80) counts[index].strong += 1;
        else if (cell.score >= 60) counts[index].acceptable += 1;
        else if (cell.score >= 40) counts[index].tradeoffs += 1;
        else counts[index].dealbreakers += 1;
      });
    }
  }

  return finalists.map((finalist, index) => ({
    name: finalist.name,
    pill: finalist.price,
    strong: String(counts[index].strong),
    acceptable: String(counts[index].acceptable),
    tradeoffs: String(counts[index].tradeoffs),
    dealbreakers: String(counts[index].dealbreakers),
    win: Boolean(finalist.best),
  }));
}

function evidenceFromFlatComparison(
  finalists: Finalist[],
  comparison?: ComparisonTable | null
) {
  if (!comparison) return [];
  const counts = finalists.map(() => ({
    strong: 0,
    acceptable: 0,
    tradeoffs: 0,
    dealbreakers: 0,
  }));

  for (const row of comparison.rows) {
    if (row.kind !== 'bar') continue;
    row.values.forEach((value, index) => {
      if (typeof value !== 'number') return;
      const score = clampPct(value <= 10 ? value * 10 : value);
      if (score >= 80) counts[index].strong += 1;
      else if (score >= 60) counts[index].acceptable += 1;
      else if (score >= 40) counts[index].tradeoffs += 1;
      else counts[index].dealbreakers += 1;
    });
  }

  return finalists.map((finalist, index) => ({
    name: finalist.name,
    pill: finalist.price,
    strong: String(counts[index].strong),
    acceptable: String(counts[index].acceptable),
    tradeoffs: String(counts[index].tradeoffs),
    dealbreakers: String(counts[index].dealbreakers),
    win: Boolean(finalist.best),
  }));
}

function rowWinCounts(
  finalists: Finalist[],
  groups: CompareGroup[],
  comparison?: ComparisonTable | null
): { counts: number[]; total: number } {
  const counts = finalists.map(() => 0);
  let total = 0;

  const tally = (scores: (number | null)[]) => {
    const valid = scores.filter((score): score is number => score !== null);
    if (valid.length < 2) return;
    const max = Math.max(...valid);
    if (max <= 0) return;
    total += 1;
    scores.forEach((score, index) => {
      if (score === max && index < counts.length) counts[index] += 1;
    });
  };

  if (groups.length > 0) {
    for (const group of groups) {
      for (const row of group.rows) {
        tally(row.cells.map((cell) => cell.score));
      }
    }
    return { counts, total };
  }

  for (const row of comparison?.rows ?? []) {
    if (row.kind !== 'bar') continue;
    tally(
      row.values.map((value) =>
        typeof value === 'number'
          ? clampPct(value <= 10 ? value * 10 : value)
          : null
      )
    );
  }
  return { counts, total };
}

function riskToneClass(riskBand: string): string {
  const normalized = riskBand.toLowerCase();
  if (normalized.includes('low')) return 'r-safe';
  if (normalized.includes('medium') || normalized.includes('moderate')) {
    return 'r-warn';
  }
  return 'r-bad';
}

function pickTopOffer(
  offers: MarketOffer[],
  recommendation?: Recommendation | null
): MarketOffer | null {
  const fromDecision =
    recommendation?.decision_summary?.buy_from ??
    recommendation?.recommendation?.seller;
  if (fromDecision) {
    const match = offers.find((offer) => offer.seller === fromDecision);
    if (match) return match;
  }
  return (
    [...offers].sort(
      (a, b) =>
        b.buy_score - a.buy_score ||
        b.trust - a.trust ||
        a.risk_score - b.risk_score
    )[0] ?? null
  );
}

function topTwoOffers(offers: MarketOffer[]) {
  return [...offers]
    .sort(
      (a, b) =>
        b.buy_score - a.buy_score ||
        b.trust - a.trust ||
        a.risk_score - b.risk_score
    )
    .slice(0, 2);
}

function marketWhyHero(top: MarketOffer, selectedName: string | null) {
  const pieces = [
    top.authority,
    top.warranty,
    top.returns,
    top.delivery,
  ].filter(Boolean);
  if (pieces.length === 0) {
    return selectedName
      ? `For ${selectedName}, this seller holds the strongest overall buy score.`
      : 'This seller holds the strongest overall buy score.';
  }
  return selectedName
    ? `${top.seller} leads for ${selectedName} because it combines ${pieces
        .slice(0, 2)
        .join(' and ')}.`
    : `${top.seller} leads because it combines ${pieces.slice(0, 2).join(' and ')}.`;
}

type OfferAdvantage =
  'price' | 'delivery' | 'warranty' | 'returns' | 'authority' | null;

function offerAdvantage(badge?: string): OfferAdvantage {
  const b = (badge ?? '').toLowerCase();
  if (!b) return null;
  if (/discount|lowest|price|deal|payment|installment/.test(b)) return 'price';
  if (/delivery|fastest|ship/.test(b)) return 'delivery';
  if (/warranty/.test(b)) return 'warranty';
  if (/return/.test(b)) return 'returns';
  if (/official|brand|first|verified/.test(b)) return 'authority';
  return null;
}

/** One seller-board cell, green-tagged when it is this offer's own advantage. */
function OfferCell({
  value,
  sub,
  advantage,
  column,
  badge,
}: {
  value: string;
  sub?: string;
  advantage: OfferAdvantage;
  column: Exclude<OfferAdvantage, null>;
  badge?: string;
}) {
  const hit = advantage === column;
  return (
    <td>
      <span className={cn('mkx-v', hit && 'sem-win')}>{value}</span>
      {sub ? <span className="mkx-sub">{sub}</span> : null}
      {hit && badge ? <span className="sem-tag t-win">{badge}</span> : null}
    </td>
  );
}

function lowestVerifiedPrice(offers: MarketOffer[]): string | null {
  let best: MarketOffer | null = null;
  for (const offer of offers) {
    if (offer.authority === 'Third-party seller') continue;
    if (offer.price === undefined) continue;
    if (best?.price === undefined || offer.price < best.price) best = offer;
  }
  return best?.price !== undefined
    ? formatMoney(best.price, best.currency)
    : null;
}

function riskCallout(offers: MarketOffer[]) {
  const sorted = [...offers].sort((a, b) => b.risk_score - a.risk_score);
  const riskiest = sorted[0] ?? null;
  if (!riskiest) return null;
  if (riskiest.risk_band.toLowerCase().includes('low')) return null;
  return {
    tag: riskiest.risk_band,
    text: `${riskiest.seller} carries the highest risk on this page. Check ${riskiest.warranty ? 'warranty' : 'seller terms'} and ${riskiest.returns ? 'returns' : 'return policy'} before choosing the cheapest option.`,
  };
}

function reassuranceTiles(offer: MarketOffer, t: Translate) {
  return [
    {
      key: 'Authority',
      value: offer.authority,
      sub: t('ws.sellerType'),
      green: offer.trust >= 80,
    },
    {
      key: 'Delivery',
      value: offer.delivery ?? t('ws.notStated'),
      sub: 'Fulfilment',
      green: Boolean(offer.delivery),
    },
    {
      key: 'Warranty',
      value: offer.warranty ?? t('ws.notStated'),
      sub: t('ws.afterPurchase'),
      green: Boolean(offer.warranty),
    },
    {
      key: 'Returns',
      value: offer.returns ?? t('ws.notStated'),
      sub: t('ws.returnWindow'),
      green: Boolean(offer.returns),
    },
  ];
}

function marketCall(top: MarketOffer, selectedName: string | null) {
  return {
    quote: selectedName
      ? `If I were buying ${selectedName} today, I’d take ${top.seller} — it balances buy score, seller trust and after-purchase protection better than the rest of this board.`
      : `If I were buying this today, I’d take ${top.seller} — it balances buy score, seller trust and after-purchase protection better than the rest of this board.`,
    sub: top.url
      ? 'This stays dynamic: once backend offer data changes, the destination and reasoning update with it.'
      : 'TODO(backend): expose a first-class marketplace timing / final-buy narrative for the closing summary.',
  };
}

function ProductImage({
  imageUrl,
  className,
  iconSize = 22,
}: {
  imageUrl?: string;
  className: string;
  iconSize?: number;
}) {
  const [broken, setBroken] = React.useState(false);
  const showImage = Boolean(imageUrl) && !broken;
  return (
    <span
      className={cn(
        'grid flex-none place-items-center overflow-hidden',
        className
      )}
    >
      {showImage ? (
        // Third-party URL — next/image cannot allowlist arbitrary hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <Package
          size={iconSize}
          strokeWidth={1.6}
          aria-hidden="true"
          className="text-[var(--vk-note)]"
        />
      )}
    </span>
  );
}

function PriorityTable({ rows }: { rows: PriorityRow[] }) {
  const t = useT();
  if (rows.length === 0) return null;
  return (
    <div>
      <GmHead
        eye="What LUMORA understood"
        sub="How much each thing matters to you"
      />
      <div className="rc-table">
        <table className="rc-tbl">
          <thead>
            <tr>
              <th>{t('ws.priority')}</th>
              <th>{t('ws.importance')}</th>
              <th>{t('ws.reason')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.label}
                className={index < 2 ? 'bg-[rgba(242,193,78,0.05)]' : undefined}
              >
                <td
                  className={cn(
                    'rc-td-lead',
                    // Design `.rc-tr-pri`: the two leading priorities carry a
                    // gold inset bar on the lead cell.
                    index < 2 && 'shadow-[inset_3px_0_0_var(--vk-gold)]'
                  )}
                >
                  <span className="mr-2 inline-grid h-[17px] w-[17px] place-items-center rounded-[5px] border border-[rgba(242,193,78,0.3)] text-[10px] font-semibold text-[var(--vk-gold-soft)]">
                    {index + 1}
                  </span>
                  {row.label}
                </td>
                <td className="whitespace-nowrap">
                  <span className="rc-impbar">
                    <span
                      className={meterTone(row.score)}
                      style={{ width: `${row.score}%` }}
                    />
                  </span>
                  <span className="text-[11.5px] text-[var(--vk-text-subtle)]">
                    {importanceLabel(row.score, t)}
                  </span>
                </td>
                <td className="rc-td-dim">
                  {row.why ?? 'Weighted from the active decision profile.'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReasoningFlow({
  analysis,
  priorities,
}: {
  analysis: AnalysisPayload;
  priorities: PriorityRow[];
}) {
  const t = useT();
  const rows = deriveReasoningRows(analysis, priorities, t);
  if (rows.length === 0) return null;
  return (
    <div>
      <GmHead
        eye="How LUMORA decided"
        sub="From your priorities to this choice"
      />
      <div className="rf-phases">
        <span className="rf-ph">{t('ws.yourPriorities')}</span>
        <span className="rf-sep">→</span>
        <span className="rf-ph">{t('ws.thinking')}</span>
        <span className="rf-sep">→</span>
        <span className="rf-ph">{t('ws.finalDecision')}</span>
      </div>
      <div className="rf-flow">
        {rows.map((row, index) => (
          <div key={`${row.priority}-${index}`} className="rf-row">
            <div className="rf-cell rf-pri">{row.priority}</div>
            <span className="rf-a">→</span>
            <div className="rf-cell">
              <span
                className={cn(
                  'inline-flex rounded-[5px] border px-[7px] py-[2px] text-[9.5px] tracking-[0.03em] uppercase',
                  row.weight === 'High'
                    ? 'border-[rgba(242,193,78,0.3)] bg-[rgba(242,193,78,0.06)] text-[var(--vk-gold-soft)]'
                    : 'border-[rgba(150,178,205,0.16)] text-[var(--vk-text-muted)]'
                )}
              >
                {row.weight}
              </span>
            </div>
            <span className="rf-a">→</span>
            <div className="rf-cell rf-rule">{row.rule}</div>
            <span className="rf-a">→</span>
            <div className="rf-cell rf-eff">{row.effect}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TradeoffTable({
  rows,
}: {
  rows: ReturnType<typeof deriveTradeoffRows>;
}) {
  const t = useT();
  if (rows.length === 0) return null;
  return (
    <div>
      <GmHead eye="The trade-off" sub="What you gain, what you give up" />
      <div className="rc-table">
        <table className="rc-tbl rc-trades-tbl">
          <thead>
            <tr>
              <th>{t('ws.youGain')}</th>
              <th>{t('ws.youGiveUp')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <React.Fragment key={`${row.gain}-${row.give}-${index}`}>
                <tr className="rc-tr-to">
                  <td className="text-[#9fd6b4]">{row.gain}</td>
                  <td className="text-[#e0b892]">{row.give}</td>
                </tr>
                {row.why ? (
                  <tr className="rc-tr-why">
                    <td colSpan={2}>{row.why}</td>
                  </tr>
                ) : null}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinalistCards({
  finalists,
  candidates,
  selectedIndex,
  onSelect,
}: {
  finalists: Finalist[];
  candidates?: CandidateSet | null;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const t = useT();
  if (finalists.length === 0) return null;
  return (
    <div>
      <GmHead
        eye={t('ws.finalistsCount', { count: finalists.length })}
        sub="Who’s in the running — and the role each plays"
      />
      <div className="cd-cards">
        {finalists.map((finalist, index) => {
          const selected = index === selectedIndex;
          const product = productForFinalist(finalist, candidates);
          const whyCard =
            candidates?.comparison?.why_cards?.find(
              (card) =>
                card.product_id === finalist.product_id ||
                card.product === finalist.name
            ) ?? null;
          const price = finalistPrice(finalist, product);
          const strength =
            whyCard?.points?.[0] ??
            finalist.why_finalist ??
            product?.survival_reason ??
            null;

          return (
            <div
              key={finalist.product_id}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`Select ${finalist.name} for Best Place to Buy`}
              onClick={() => onSelect(index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(index);
                }
              }}
              className={cn(
                'relative flex min-w-0 cursor-pointer flex-col gap-[11px] rounded-[14px] border p-3 text-left outline-none',
                'transition-[border-color,box-shadow] duration-[180ms]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent)]',
                finalist.best
                  ? 'bg-linear-[180deg,rgba(242,193,78,0.1),rgba(249, 248, 242, 0.5)] border-[rgba(242,193,78,0.4)] shadow-[0_16px_46px_-22px_rgba(242,193,78,0.65)]'
                  : 'bg-[rgba(249, 248, 242, 0.5)] border-[rgba(150,178,205,0.14)] hover:border-[rgba(242,193,78,0.3)]',
                selected &&
                  'border-[var(--vk-gold)] shadow-[0_0_0_1px_var(--vk-gold),0_16px_44px_-22px_rgba(242,193,78,0.55)]'
              )}
            >
              <div className="flex min-h-[17px] flex-wrap items-center gap-1.5">
                {finalist.best && (
                  <span className="rounded-[5px] bg-linear-[150deg,#348568,#28765c] px-2 py-0.5 text-[8.5px] font-bold tracking-[0.06em] text-[#ffffff] uppercase">
                    LUMORA recommendation
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

              <div className="flex items-center gap-[11px]">
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'text-[13px] leading-[1.15] font-semibold break-words',
                      finalist.best
                        ? 'text-[var(--vk-gold-soft)]'
                        : 'text-[var(--vk-text-strong)]'
                    )}
                  >
                    {finalist.name}
                  </div>
                  <div className="mt-0.5 truncate text-[10.5px] text-[var(--vk-note-quiet)]">
                    {[finalist.brand ?? product?.brand, product?.variant]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <div className="flex-none text-right">
                  <MatchPct
                    value={finalist.match}
                    className="block text-[17px] leading-none font-semibold text-[var(--vk-gold-soft)]"
                  />
                  <span className="text-[8px] tracking-[0.05em] text-[var(--vk-note-quiet)] uppercase">
                    match
                  </span>
                </div>
              </div>

              {price && (
                <div className="text-[15px] font-semibold text-[var(--vk-gold-soft)] tabular-nums">
                  {price}
                </div>
              )}

              {strength && (
                <div className="border-t border-[rgba(150,178,205,0.08)] pt-2 text-[11.5px] leading-[1.45] text-[var(--vk-text-subtle)]">
                  {strength}
                </div>
              )}

              {(finalist.for_who ||
                whyCard?.points?.[1] ||
                whyCard?.points?.[2]) && (
                <div className="cd-kv">
                  {finalist.for_who && (
                    <div className="cd-kv-row">
                      <span className="cd-kv-k">{t('ws.bestFor')}</span>
                      <span className="cd-kv-v">{finalist.for_who}</span>
                    </div>
                  )}
                  {whyCard?.points?.[1] && (
                    <div className="cd-kv-row">
                      <span className="cd-kv-k pos">{t('ws.strength')}</span>
                      <span className="cd-kv-v">{whyCard.points[1]}</span>
                    </div>
                  )}
                  {whyCard?.points?.[2] && (
                    <div className="cd-kv-row">
                      <span className="cd-kv-k neg">{t('ws.limitation')}</span>
                      <span className="cd-kv-v">{whyCard.points[2]}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReadHonestly({
  finalists,
  groups,
  comparison,
}: {
  finalists: Finalist[];
  groups: CompareGroup[];
  comparison?: ComparisonTable | null;
}) {
  const t = useT();
  const { counts, total } = rowWinCounts(finalists, groups, comparison);
  if (total === 0 || finalists.length < 2) return null;

  const best = finalists.find((finalist) => finalist.best) ?? finalists[0];
  const bestIndex = finalists.indexOf(best);
  const top = Math.max(...counts);
  if (top === 0) return null;

  // A tie is not a lead. Naming one finalist "ahead" on a split board is the
  // exact dishonesty this paragraph exists to prevent, so a tie says so.
  const leaders = counts.reduce<number[]>(
    (acc, count, index) => (count === top ? [...acc, index] : acc),
    []
  );
  const leaderIndex = leaders[0];

  const claim =
    leaders.length > 1
      ? t('ws.rowsTied', { total })
      : t('ws.rowsWonMost', {
          name: finalists[leaderIndex].name,
          count: top,
          total,
        });
  const verdict =
    leaders.length > 1
      ? t('ws.rowsTiedVerdict', { best: best.name })
      : leaderIndex === bestIndex
        ? t('ws.rowsAlsoWins', { best: best.name })
        : t('ws.rowsButLoses', { best: best.name });

  return (
    <p className="mb-0 text-[13px] leading-[1.65] text-[var(--vk-text-subtle)]">
      <span className="font-bold text-[var(--vk-text-strong)]">
        {t('ws.readHonestly')}
      </span>
      {': '}
      {claim} {verdict}
    </p>
  );
}

function DecisionFocus({ rows }: { rows: PriorityRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <GmHead
        eye="Your decision focus"
        sub="What the table below is weighted around"
      />
      <div className="df-bars">
        {rows.map((row) => (
          <div key={row.label} className="df-row">
            <span className="df-k">{row.label}</span>
            <span className="df-bar">
              <span style={{ width: `${row.score}%` }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * One cell's three-layer semantics, exactly as the frozen `cmpHTML` computes
 * them: the winning cell of every row, plus — on PRIORITY rows only — an
 * explicit word for a weak or merely acceptable value.
 *
 * Priority-gating matters. A low score on a factor the person ranked last is
 * not a problem worth flagging; the same score on one they marked critical is
 * the whole decision. Tagging both would train the reader to ignore the tag.
 */
function cellSemantics(
  win: boolean,
  priority: boolean,
  score: number,
  t: Translate
): { sem: string; tag: { text: string; tone: string } | null } {
  if (win) {
    return {
      sem: 'sem-win',
      tag: priority ? { text: t('ws.semBest'), tone: 't-win' } : null,
    };
  }
  if (priority && score < 40) {
    return { sem: 'sem-bad', tag: { text: t('ws.semWeak'), tone: 't-bad' } };
  }
  if (priority && score < 58) {
    return {
      sem: 'sem-warn',
      tag: { text: t('ws.semTradeoff'), tone: 't-warn' },
    };
  }
  return { sem: '', tag: null };
}

/** The finalist column header (design `cx-col` / `cx-col-n` / `cx-hb`). */
function CompareHead({ finalists }: { finalists: Finalist[] }) {
  const t = useT();
  return (
    <thead>
      <tr>
        <th className="cx-dim">{t('ws.decisionFactor')}</th>
        {finalists.map((finalist) => (
          <th
            key={finalist.product_id}
            className={cn('cx-col', finalist.best && 'cx-col0')}
          >
            <span className="cx-col-n">{finalist.name}</span>
            {finalist.best && (
              <span className="cx-hb">{t('ws.lumoraPick')}</span>
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** One scored cell (design `cx-cell`). */
function CompareCellTd({
  value,
  score,
  win,
  priority,
}: {
  value: string;
  score: number;
  win: boolean;
  priority: boolean;
}) {
  const t = useT();
  const { sem, tag } = cellSemantics(win, priority, score, t);
  return (
    <td className={cn('cx-cell', win && 'cx-cwin')}>
      <div className="cx-meter" aria-hidden="true">
        <span
          className={meterTone(score)}
          style={{ width: `${clampPct(score)}%` }}
        />
      </div>
      <span className={cn('cx-v', sem)}>
        {value}
        {win && (
          <i className="cx-ck" aria-hidden="true">
            ✓
          </i>
        )}
      </span>
      {tag && <span className={cn('sem-tag', tag.tone)}>{tag.text}</span>}
    </td>
  );
}

/**
 * The grouped comparison board — ONE table with `cx-grp` separator rows.
 *
 * It used to render a separate table per group, which let each group size its
 * own columns: the same finalist sat at a different x-position in every block,
 * so the columns could not be read down the page.
 */
function GroupedCompareTable({
  groups,
  finalists,
}: {
  groups: CompareGroup[];
  finalists: Finalist[];
}) {
  const t = useT();
  const factorCount = groups.reduce((sum, group) => sum + group.rows.length, 0);
  if (groups.length === 0) return null;
  return (
    <div>
      <GmHead
        eye={t('ws.factorComparison', { count: factorCount })}
        sub={t('ws.everyRowReal')}
      />
      <div className="cx-wrap">
        <table className="cx-tbl">
          <CompareHead finalists={finalists} />
          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group.label}>
                <tr className="cx-grp">
                  <td colSpan={finalists.length + 1}>{group.label}</td>
                </tr>
                {group.rows.map((row) => {
                  const max = Math.max(...row.cells.map((cell) => cell.score));
                  return (
                    <tr
                      key={`${group.label}-${row.factor}`}
                      className={cn('cx-row', row.priority && 'cx-prow')}
                    >
                      <td className="cx-dim">
                        {row.factor}
                        {row.priority && (
                          <span className="cx-pritag">{t('ws.priority')}</span>
                        )}
                      </td>
                      {row.cells.map((cell, index) => (
                        <CompareCellTd
                          key={`${row.factor}-${index}`}
                          value={cell.value}
                          score={cell.score}
                          win={cell.score === max}
                          priority={row.priority}
                        />
                      ))}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The fallback board, for a backend that sends the flat `comparison` table
 * rather than grouped rows. Same `cx-*` chrome so the two shapes are one
 * component visually; the flat contract carries no priority flag, so only the
 * winning cell is marked — there is nothing to gate a "Weak" tag on.
 */
function FlatCompareTable({
  comparison,
  finalists,
  candidates,
}: {
  comparison: ComparisonTable;
  finalists: Finalist[];
  candidates?: CandidateSet | null;
}) {
  const t = useT();
  const columns = comparison.products.map((name, index) => {
    const finalist = finalists[index];
    const product =
      comparison.product_ids?.[index] && candidates
        ? (candidates.products?.find(
            (candidate) => candidate.id === comparison.product_ids?.[index]
          ) ?? null)
        : compareProductByName(name, candidates);
    return {
      product_id: comparison.product_ids?.[index] ?? name,
      name,
      match: finalist?.match ?? 0,
      best: Boolean(finalist?.best) || Boolean(product?.recommended),
    } as Finalist;
  });

  return (
    <div>
      <GmHead
        eye={t('ws.factorComparison', { count: comparison.rows.length })}
        sub={t('ws.everyRowReal')}
      />
      <div className="cx-wrap">
        <table className="cx-tbl">
          <CompareHead finalists={columns} />
          <tbody>
            {comparison.rows.map((row) => {
              const scores = row.values.map((value) =>
                row.kind === 'bar' && typeof value === 'number'
                  ? clampPct(value <= 10 ? value * 10 : value)
                  : null
              );
              const valid = scores.filter((s): s is number => s !== null);
              const max = valid.length > 1 ? Math.max(...valid) : null;
              return (
                <tr key={row.factor} className="cx-row">
                  <td className="cx-dim">{row.factor}</td>
                  {row.values.map((value, index) => {
                    const score = scores[index];
                    if (score === null) {
                      return (
                        <td key={`${row.factor}-${index}`} className="cx-cell">
                          <span className="cx-v">{String(value)}</span>
                        </td>
                      );
                    }
                    return (
                      <CompareCellTd
                        key={`${row.factor}-${index}`}
                        value={`${score}%`}
                        score={score}
                        win={max !== null && score === max}
                        priority={false}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= Tab 1 · My Best Choice (Decision) ================= */

export function AnalysisDecisionTab({
  analysis,
  world,
  requirement,
  recommendation,
}: {
  analysis: AnalysisPayload;
  world?: WorldContext | null;
  requirement?: RequirementPayload | null;
  recommendation?: Recommendation | null;
}) {
  const t = useT();
  const best = analysis.rec.best;
  const priorities = derivePriorityRows(analysis, requirement);
  const trustBullets = deriveTrustBullets(analysis, recommendation);
  const boundaryItems = deriveBoundaryItems(analysis, recommendation);
  const tradeoffRows = deriveTradeoffRows(analysis);
  const context = contextMetaFromWorld(world, analysis.category);
  const callQuote =
    recommendation?.if_i_were_you?.text ?? analysis.rec.signature ?? null;
  const callSub =
    recommendation?.if_i_were_you?.honest_disclaimer ??
    analysis.rec.best.tradeoffs?.[0] ??
    null;
  // A named winner is what every block below is ABOUT. Without one the page
  // has nothing to say, and saying it with empty cards reads as a bug.
  const hasPick = Boolean(best.name);

  const winner =
    analysis.compare.finalists.find((finalist) => finalist.best) ??
    analysis.compare.finalists[0] ??
    null;
  const bestFor =
    winner?.for_who ??
    (priorities.length
      ? priorities
          .slice(0, 2)
          .map((row) => row.label)
          .join(', ')
      : null);
  const heroBrand =
    [best.brand, winner?.for_who].filter(Boolean).join(' · ') || null;

  return (
    <div className="vk-ws-seq">
      <GmContext meta={context} />

      <GmOpen>{deriveDecisionWhyPage(analysis, priorities)}</GmOpen>

      {!hasPick && <GmPending body={t('ws.pendingDecision')} />}

      {hasPick && (
        <div>
          <div className="mb-2">
            <CardEye>My best choice · LUMORA’s decision</CardEye>
          </div>
          <div className="bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_42%),linear-gradient(180deg,rgba(242,193,78,0.08),rgba(249, 248, 242, 0.5))] rounded-2xl border border-[rgba(242,193,78,0.32)] px-[17px] py-4 shadow-[0_0_0_1px_rgba(242,193,78,0.06),0_22px_60px_-30px_rgba(242,193,78,0.5)]">
            <div className="mb-[11px] flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full border border-[rgba(95,168,107,0.34)] bg-[rgba(95,168,107,0.12)] px-2.5 py-0.5 text-[11px] font-semibold text-[#B8DFC0]">
                Ready for decision
              </span>
              <span className="text-[11px] text-[var(--vk-text-muted)]">
                {analysis.category}
              </span>
            </div>

            {(analysis.rec.summary || analysis.goal) && (
              <p className="mb-[13px] text-[13.5px] leading-[1.6] text-[var(--vk-text-subtle)]">
                {analysis.rec.summary ?? analysis.goal}
              </p>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="bg-[rgba(249, 248, 242, 0.35)] rounded-[11px] border border-[rgba(150,178,205,0.1)] px-3 py-2.5">
                <div className="text-[10px] tracking-[0.08em] text-[var(--vk-note-quiet)] uppercase">
                  Recommended
                </div>
                <div className="mt-1 text-[13.5px] font-semibold text-[var(--vk-gold-soft)]">
                  {best.name}
                </div>
              </div>
              <div className="bg-[rgba(249, 248, 242, 0.35)] rounded-[11px] border border-[rgba(150,178,205,0.1)] px-3 py-2.5">
                <div className="text-[10px] tracking-[0.08em] text-[var(--vk-note-quiet)] uppercase">
                  Decision confidence
                </div>
                <div className="mt-1 text-[13.5px] font-semibold text-[var(--vk-text-strong)]">
                  {analysis.confidence.word}{' '}
                  <span className="text-[var(--vk-note-quiet)]">·</span>{' '}
                  <MatchPct value={analysis.confidence.pct} />
                </div>
              </div>
              {analysis.goal && (
                <div className="bg-[rgba(249, 248, 242, 0.35)] rounded-[11px] border border-[rgba(150,178,205,0.1)] px-3 py-2.5">
                  <div className="text-[10px] tracking-[0.08em] text-[var(--vk-note-quiet)] uppercase">
                    Your goal
                  </div>
                  <div className="mt-1 text-[13.5px] font-medium text-[var(--vk-text-strong)]">
                    {analysis.goal}
                  </div>
                </div>
              )}
              {bestFor && (
                <div className="bg-[rgba(249, 248, 242, 0.35)] rounded-[11px] border border-[rgba(150,178,205,0.1)] px-3 py-2.5">
                  <div className="text-[10px] tracking-[0.08em] text-[var(--vk-note-quiet)] uppercase">
                    {t('ws.bestFor')}
                  </div>
                  <div className="mt-1 text-[13.5px] font-medium text-[var(--vk-text-strong)]">
                    {bestFor}
                  </div>
                </div>
              )}
            </div>

            <div className="my-3.5 h-px bg-[rgba(150,178,205,0.12)]" />

            <div className="text-[10px] font-extrabold tracking-[0.14em] text-[var(--vk-gold-soft)] uppercase">
              LUMORA recommends
            </div>
            <div className="mt-2.5 flex items-center gap-3.5">
              <ProductImage
                imageUrl={best.image_url}
                className="h-[72px] w-[92px] rounded-[12px] border border-[rgba(150,178,205,0.18)] bg-radial-[120%_90%_at_50%_25%,rgba(232,137,46,0.14),rgba(150,178,205,0.02)_70%]"
                iconSize={26}
              />
              <div className="min-w-0 flex-1">
                {heroBrand && (
                  <div className="text-[10.5px] tracking-[0.06em] text-[var(--vk-text-muted)] uppercase">
                    {heroBrand}
                  </div>
                )}
                <div className="text-[17px] leading-[1.25] font-semibold break-words text-[var(--vk-text-strong)]">
                  {best.name}
                </div>
                {best.price && (
                  <div className="mt-1 text-[15px] font-semibold text-[var(--vk-gold-soft)] tabular-nums">
                    {best.price}
                  </div>
                )}
              </div>
              <div className="hidden text-right sm:block">
                <MatchPct
                  value={analysis.rec.scores.match}
                  className="block text-[22px] leading-none font-semibold text-[var(--vk-gold-soft)]"
                />
                <span className="text-[8.5px] tracking-[0.05em] text-[var(--vk-note-quiet)] uppercase">
                  match
                </span>
              </div>
            </div>

            {(analysis.rec.why_won?.length ?? 0) > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-[11px] font-bold tracking-[0.05em] text-[var(--vk-text-muted)] uppercase">
                  How it meets your priorities
                </div>
                <div className="rc-table">
                  <table className="rc-tbl">
                    <thead>
                      <tr>
                        <th>{t('ws.yourPriority')}</th>
                        <th>{t('ws.winnerPerf')}</th>
                        <th className="rc-c">{t('ws.result')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.rec.why_won!.map((row) => (
                        <tr key={row.priority}>
                          <td className="rc-td-lead">{row.priority}</td>
                          <td className="rc-td-dim">
                            {row.performance ?? '—'}
                          </td>
                          <td className="rc-c">
                            {row.ok === 'yes'
                              ? '✓'
                              : row.ok === 'ok'
                                ? '◦'
                                : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <GmGlance items={deriveGlanceItems(analysis, t)} />

      <PriorityTable rows={priorities} />

      <ReasoningFlow analysis={analysis} priorities={priorities} />

      <TradeoffTable rows={tradeoffRows} />

      <GmTrust
        title={
          analysis.confidence.word
            ? t('ws.confidenceHere', { word: analysis.confidence.word })
            : t('ws.myConfidence')
        }
        bullets={trustBullets}
        note={
          analysis.confidence.pct > 0 || analysis.confidence.word ? (
            <>
              Fit to your needs: <b>{clampPct(analysis.confidence.pct)}%</b>
              {analysis.confidence.word
                ? ` · ${analysis.confidence.word} confidence`
                : ''}
              {(analysis.confidence.unresolved?.length ?? 0) > 0
                ? ` · ${analysis.confidence.unresolved!.length} open consideration${analysis.confidence.unresolved!.length === 1 ? '' : 's'}`
                : ''}
              .
            </>
          ) : undefined
        }
      />

      <GmBoundary
        items={boundaryItems}
        note={
          analysis.rec.boundary_note ??
          (analysis.confidence.unresolved?.length
            ? `Still uncertain: ${analysis.confidence.unresolved.join(' · ')}`
            : undefined)
        }
      />

      <GmCall title={t('ws.afterAllOfIt')} quote={callQuote} sub={callSub} />
    </div>
  );
}

/* ================= Tab 2 · Why It Wins (Proof) ================= */

export function AnalysisCompareTab({
  analysis,
  world,
  candidates,
  requirement,
  recommendation,
  selectedIndex,
  onSelect,
}: {
  analysis: AnalysisPayload;
  world?: WorldContext | null;
  candidates?: CandidateSet | null;
  requirement?: RequirementPayload | null;
  recommendation?: Recommendation | null;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const t = useT();
  const finalists = analysis.compare.finalists;
  const priorities = derivePriorityRows(analysis, requirement);
  const context = contextMetaFromWorld(world, analysis.category);
  const groups = normalizeCompareGroups(
    analysis.compare.table,
    finalists.length
  );
  const flatComparison = candidates?.comparison ?? null;
  const evidence =
    groups.length > 0
      ? evidenceFromGroups(finalists, groups)
      : evidenceFromFlatComparison(finalists, flatComparison);
  const alternatives =
    (recommendation?.conditional?.length ?? 0) > 0
      ? recommendation!.conditional!.map((branch) => ({
          name: branch.then_product,
          text: `${branch.if}${branch.why ? ` — ${branch.why}` : ''}`,
        }))
      : finalists
          .filter((finalist) => !finalist.best)
          .slice(0, 2)
          .map((finalist) => ({
            name: finalist.name,
            text:
              finalist.for_who ??
              finalist.why_finalist ??
              'this trade-off matters more in your case.',
          }));

  return (
    <div className="vk-ws-seq">
      <GmContext meta={context} />

      <GmOpen>{deriveCompareWhyPage(priorities)}</GmOpen>

      {finalists.length === 0 && <GmPending body={t('ws.pendingProof')} />}

      <FinalistCards
        finalists={finalists}
        candidates={candidates}
        selectedIndex={selectedIndex}
        onSelect={onSelect}
      />

      <DecisionFocus rows={priorities.slice(0, 6)} />

      {groups.length > 0 ? (
        <GroupedCompareTable groups={groups} finalists={finalists} />
      ) : flatComparison ? (
        <FlatCompareTable
          comparison={flatComparison}
          finalists={finalists}
          candidates={candidates}
        />
      ) : null}

      <ReadHonestly
        finalists={finalists}
        groups={groups}
        comparison={flatComparison}
      />

      <GmEvidence items={evidence} />

      <GmDecisive text={analysis.compare.wins} />

      <GmAlternatives items={alternatives} />

      <GmCall
        title={t('ws.afterReading')}
        quote={
          recommendation?.if_i_were_you?.text ??
          analysis.rec.signature ??
          analysis.compare.wins
        }
        sub="This closing block stays dynamic and updates as the shortlist or ranking changes."
      />
    </div>
  );
}

/* ================= Tab 3 · Best Place to Buy (Action) ================= */

export function AnalysisMarketTab({
  analysis,
  world,
  recommendation,
  selectedIndex,
}: {
  analysis: AnalysisPayload;
  world?: WorldContext | null;
  recommendation?: Recommendation | null;
  selectedIndex: number;
}) {
  const t = useT();
  const finalists = analysis.compare.finalists;
  const selected = finalists[selectedIndex] ?? finalists[0] ?? null;
  const item =
    (selected &&
      analysis.market.items.find(
        (marketItem) => marketItem.product_id === selected.product_id
      )) ??
    analysis.market.items[0] ??
    null;
  const offers = item?.offers ?? [];
  const bestFinalist = finalists.find((finalist) => finalist.best) ?? null;
  const topOffer = pickTopOffer(offers, recommendation);
  const [winner, runnerUp] = topTwoOffers(offers);
  const risk = riskCallout(offers);
  const lowestVerified = lowestVerifiedPrice(offers);
  const context = contextMetaFromWorld(world, analysis.category);
  const call = topOffer
    ? marketCall(topOffer, item?.product ?? selected?.name ?? null)
    : null;

  return (
    <div className="vk-ws-seq">
      <GmContext meta={context} />

      {selected && bestFinalist && !selected.best && (
        <div className="mkx-selban">
          <span className="text-[9px] tracking-[0.06em] text-[var(--vk-text-muted)] uppercase">
            Selected product
          </span>
          <span className="text-[14px] font-semibold text-[var(--vk-gold-soft)]">
            {selected.name}
          </span>
          <span className="text-[11.5px] text-[var(--vk-text-muted)]">
            Offers below are for this product — not LUMORA’s recommendation (
            {bestFinalist.name}).
          </span>
        </div>
      )}

      <GmOpen>
        {deriveMarketWhyPage(
          item?.product ?? selected?.name ?? null,
          offers.length
        )}
      </GmOpen>

      {offers.length === 0 && <GmPending body={t('ws.pendingAction')} />}

      {topOffer && (
        <div>
          <div className="mb-3 text-[10px] font-extrabold tracking-[0.14em] text-[#e6b3a4] uppercase">
            Best place to buy · recommended destination
          </div>
          <div className="mkx-hero">
            <div className="mkx-hero-l">
              <span className="mkx-logo">
                {topOffer.seller.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <div className="mkx-hero-name">
                  {recommendation?.decision_summary?.buy_from ??
                    topOffer.seller}
                </div>
                <div className="mkx-hero-sub">
                  {marketWhyHero(
                    topOffer,
                    item?.product ?? selected?.name ?? null
                  )}
                </div>
              </div>
            </div>
            {topOffer.url ? (
              <a
                href={topOffer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-[9px] bg-linear-[150deg,#348568,#28765c] px-[15px] py-[9px] text-[13px] font-semibold text-[#ffffff] transition hover:brightness-[1.04]"
              >
                Open the offer
                <ExternalLink size={13} strokeWidth={2.2} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
      )}

      {winner && runnerUp && (
        <div>
          <GmHead eye="#1 vs #2" sub="Why the top pick beats the runner-up" />
          <div className="mkx-top2">
            <div className="mkx-t2c win">
              <div className="mkx-t2h">
                <span className="mkx-t2n">{winner.seller}</span>
                <span className="mkx-t2r gold">#1</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-[var(--vk-text-subtle)]">
                <li className="flex justify-between gap-3">
                  <span className="text-[var(--vk-note)]">{t('ws.price')}</span>
                  <span>
                    {winner.price !== undefined
                      ? formatMoney(winner.price, winner.currency)
                      : t('ws.notAvailable')}
                  </span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-[var(--vk-note)]">
                    {t('ws.delivery')}
                  </span>
                  <span>{winner.delivery ?? t('ws.notStated')}</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-[var(--vk-note)]">
                    {t('ws.warranty')}
                  </span>
                  <span>{winner.warranty ?? t('ws.notStated')}</span>
                </li>
              </ul>
            </div>
            <div className="mkx-vs">vs</div>
            <div className="mkx-t2c">
              <div className="mkx-t2h">
                <span className="mkx-t2n">{runnerUp.seller}</span>
                <span className="mkx-t2r neu">#2</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-[var(--vk-text-subtle)]">
                <li className="flex justify-between gap-3">
                  <span className="text-[var(--vk-note)]">{t('ws.price')}</span>
                  <span>
                    {runnerUp.price !== undefined
                      ? formatMoney(runnerUp.price, runnerUp.currency)
                      : t('ws.notAvailable')}
                  </span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-[var(--vk-note)]">
                    {t('ws.delivery')}
                  </span>
                  <span>{runnerUp.delivery ?? t('ws.notStated')}</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-[var(--vk-note)]">
                    {t('ws.warranty')}
                  </span>
                  <span>{runnerUp.warranty ?? t('ws.notStated')}</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mkx-why1">
            <div className="k">Why #1 wins</div>
            <div className="t">
              {winner.buy_score > runnerUp.buy_score
                ? `${winner.seller} leads on overall buy score, trust and after-purchase protection.`
                : `${winner.seller} remains the safer overall destination for this decision.`}
            </div>
          </div>
        </div>
      )}

      {offers.length > 0 ? (
        <div>
          <GmHead eye={t('ws.whereToBuy')} sub={t('ws.buyingSources')} />
          <div className="mkx-wrap">
            <table className="mkx-tbl">
              <thead>
                <tr>
                  <th className="mkx-th-s">{t('ws.sellerRole')}</th>
                  <th>{t('ws.price')}</th>
                  <th>{t('ws.authentic')}</th>
                  <th>{t('ws.warranty')}</th>
                  <th>{t('ws.returns')}</th>
                  <th>{t('ws.delivery')}</th>
                  <th>{t('ws.buyScore')}</th>
                  <th>{t('ws.risk')}</th>
                  <th>{t('ws.action')}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="mkx-grp">
                  <td colSpan={9}>{t('ws.topRanked')}</td>
                </tr>
                {offers
                  .slice()
                  .sort((a, b) => b.buy_score - a.buy_score)
                  .map((offer, index) => {
                    const advantage = offerAdvantage(offer.badge);
                    return (
                      <tr key={`${offer.seller}-${offer.url ?? index}`}>
                        <td className="mkx-seller">
                          <span className="mkx-sn">
                            {topOffer?.seller === offer.seller ? (
                              <span className="mkx-star">★</span>
                            ) : null}
                            {offer.seller}
                          </span>
                          <span
                            className={cn(
                              'mkx-role',
                              topOffer?.seller === offer.seller
                                ? 'role-gold'
                                : 'role-grn'
                            )}
                          >
                            {topOffer?.seller === offer.seller
                              ? 'LUMORA pick'
                              : offer.authority}
                          </span>
                        </td>
                        <OfferCell
                          value={
                            offer.price !== undefined
                              ? formatMoney(offer.price, offer.currency)
                              : t('ws.notAvailable')
                          }
                          sub={
                            offer.old_price !== undefined
                              ? t('ws.wasPrice', {
                                  price: formatMoney(
                                    offer.old_price,
                                    offer.currency
                                  ),
                                })
                              : undefined
                          }
                          advantage={advantage}
                          column="price"
                          badge={offer.badge}
                        />
                        <OfferCell
                          value={offer.authority}
                          sub={t('ws.trustScore', { score: offer.trust })}
                          advantage={advantage}
                          column="authority"
                          badge={offer.badge}
                        />
                        <OfferCell
                          value={offer.warranty ?? t('ws.notStated')}
                          advantage={advantage}
                          column="warranty"
                          badge={offer.badge}
                        />
                        <OfferCell
                          value={offer.returns ?? t('ws.notStated')}
                          advantage={advantage}
                          column="returns"
                          badge={offer.badge}
                        />
                        <OfferCell
                          value={offer.delivery ?? t('ws.notStated')}
                          advantage={advantage}
                          column="delivery"
                          badge={offer.badge}
                        />
                        <td>
                          <span className="mkx-v mkx-ok">
                            {offer.buy_score}
                          </span>
                        </td>
                        <td>
                          <span
                            className={cn(
                              'mkx-risk',
                              riskToneClass(offer.risk_band)
                            )}
                          >
                            {offer.risk_band}
                          </span>
                        </td>
                        <td>
                          {offer.url ? (
                            <a
                              href={offer.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-[7px] border border-[rgba(242,193,78,0.3)] bg-[rgba(242,193,78,0.08)] px-2 py-1 text-[10.5px] font-semibold text-[var(--vk-gold-soft)]"
                            >
                              Open
                              <ExternalLink
                                size={10}
                                strokeWidth={2.2}
                                aria-hidden="true"
                              />
                            </a>
                          ) : (
                            <span className="mkx-sub">
                              {t('ws.unavailable')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                <tr className="mkx-foot">
                  <td colSpan={9}>
                    {t('ws.offersFooter', {
                      verified: offers.filter(
                        (offer) => offer.authority !== 'Third-party seller'
                      ).length,
                      total: offers.length,
                    })}
                    {lowestVerified !== null
                      ? ` ${t('ws.lowestVerified', { price: lowestVerified })}`
                      : ''}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {analysis.market.note && (
            <div className="an-note">{analysis.market.note}</div>
          )}
        </div>
      ) : null}

      {risk ? (
        <div>
          <GmHead eye="The buying risk to avoid" sub="Cheapest is not safest" />
          <div className="mkx-risk-box">
            <div className="mkx-risk-tag">{risk.tag}</div>
            <p>{risk.text}</p>
          </div>
        </div>
      ) : null}

      {topOffer && (
        <div>
          <GmHead
            eye="Why you can buy with confidence"
            sub="Every purchase risk, cleared"
          />
          <div className="mkx-tiles">
            {reassuranceTiles(topOffer, t).map((tile) => (
              <div
                key={tile.key}
                className={cn('mkx-tile', tile.green && 'ok')}
              >
                <div className="mkx-tk">{tile.key}</div>
                <div className={cn('mkx-tv', tile.green && 'g')}>
                  {tile.value}
                  <small>{tile.sub}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TODO(backend): expose an explicit buy-now / wait signal on
          `analysis.market` so this card can state a verdict instead of
          reporting only when the offers were last verified. */}
      {analysis.generated_at && (
        <div>
          <GmHead eye={t('ws.timing')} sub={t('ws.buyNowOrWait')} />
          <div className="mkx-timing">
            <p>
              {t('ws.lastRefreshed', {
                date: formatShortDate(analysis.generated_at),
              })}{' '}
              {t('ws.timingPending')}
            </p>
          </div>
        </div>
      )}

      <GmCall title={t('ws.afterRisk')} quote={call?.quote} sub={call?.sub} />
    </div>
  );
}

/* ================= In-thread “decision ready” card ================= */

/**
 * The compact thread presence of an `analysis` result (design: the journey
 * ends with “Your decision is ready.” and the workspace holds the content).
 */
export function AnalysisReadyCard({ analysis }: { analysis: AnalysisPayload }) {
  const best = analysis.rec.best;
  return (
    <div
      dir="auto"
      className="bg-linear-[135deg,rgba(242,193,78,0.08),rgba(249, 248, 242, 0.6)_55%] max-w-[664px] rounded-[14px] border border-l-[3px] border-[rgba(242,193,78,0.3)] border-l-[var(--vk-gold)] px-4 py-3.5"
    >
      <div className="text-[14.5px] font-semibold text-[var(--vk-gold-soft)]">
        Your decision is ready.
      </div>
      <div className="mt-1 text-[13px] leading-[1.55] text-[var(--vk-text-subtle)]">
        <span className="font-semibold text-[var(--vk-text-strong)]">
          {best.name}
        </span>{' '}
        leads for your {analysis.category.toLowerCase()} —{' '}
        <span className="text-[var(--vk-gold-soft)] tabular-nums">
          {Math.round(analysis.rec.scores.match)}%
        </span>{' '}
        match.
      </div>
    </div>
  );
}
