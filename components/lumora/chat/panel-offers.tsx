'use client';

import { ExternalLink, Smartphone } from 'lucide-react';
import * as React from 'react';

import { GmHead } from '@/components/lumora/chat/workspace-bits';
import type {
  CandidateSet,
  MarketplaceComparison,
  ProductMarketplace,
  Recommendation,
} from '@/lib/api/types';
import { formatMoney } from '@/lib/format';
import { useT } from '@/lib/i18n/provider';
import { cn } from '@/lib/utils';

/** A component, not a constant: the label is translated, and a hook cannot be
 *  called at module scope. */
function NotAvailable() {
  const t = useT();
  return (
    <span className="text-[var(--vk-note-quiet)]">{t('ws.notAvailable')}</span>
  );
}

function OfferTable({ item }: { item: ProductMarketplace }) {
  const t = useT();
  // `offers` can be null — guard, and say so instead of rendering nothing.
  const offers = item.offers ?? [];
  if (offers.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-[rgba(150,178,205,0.2)] p-4 text-[13px] leading-[1.5] text-[var(--vk-text-muted)]">
        No exact-match offers are available for this configuration right now.
      </div>
    );
  }

  return (
    <div className="mt-3.5 overflow-x-auto rounded-2xl border border-[var(--vk-border)]">
      <div className="min-w-[660px]">
        <div className="bg-[rgba(249, 248, 242, 0.72)] grid grid-cols-[1.3fr_1fr_0.9fr_0.9fr_0.9fr_0.8fr_72px] gap-2.5 px-3.5 py-[10px] text-[10px] font-bold tracking-[0.06em] text-[var(--vk-text-muted)] uppercase">
          <div>{t('ws.seller')}</div>
          <div>{t('ws.price')}</div>
          <div>{t('ws.availability')}</div>
          <div>{t('ws.shipping')}</div>
          <div>{t('ws.warranty')}</div>
          <div>{t('ws.returns')}</div>
          <div className="text-center">{t('ws.action')}</div>
        </div>
        {offers.map((offer, index) => (
          <div
            key={`${offer.seller}-${offer.price ?? index}`}
            className={cn(
              'vk-anim-row grid grid-cols-[1.3fr_1fr_0.9fr_0.9fr_0.9fr_0.8fr_72px] items-center gap-2.5 border-t border-[rgba(150,178,205,0.1)] px-3.5 py-3',
              index === 0 && 'bg-[rgba(242,193,78,0.06)]'
            )}
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <div className="min-w-0 text-[13px] font-semibold break-words text-[var(--vk-text-strong)]">
              {offer.seller}
            </div>
            <div className="text-[13px] font-semibold text-[var(--vk-text-strong)] tabular-nums">
              {offer.discount_label && (
                <span className="mr-1.5 rounded-md bg-[rgba(90,160,110,0.16)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--vk-success)]">
                  {offer.discount_label}
                </span>
              )}
              {offer.old_price !== undefined && (
                <span className="mr-1 text-[11px] text-[var(--vk-text-faint)] line-through">
                  {formatMoney(offer.old_price, offer.currency)}
                </span>
              )}
              {offer.price !== undefined ? (
                formatMoney(offer.price, offer.currency)
              ) : (
                <NotAvailable />
              )}
            </div>
            <div className="text-[12px] break-words text-[var(--vk-text-subtle)]">
              {offer.availability ?? <NotAvailable />}
            </div>
            <div className="text-[12px] break-words text-[var(--vk-text-subtle)]">
              {offer.shipping ?? <NotAvailable />}
            </div>
            <div className="text-[12px] break-words text-[var(--vk-text-subtle)]">
              {offer.warranty ?? <NotAvailable />}
            </div>
            <div className="text-[12px] break-words text-[var(--vk-text-subtle)]">
              {offer.return_policy ?? <NotAvailable />}
            </div>
            <div className="text-center">
              {offer.url ? (
                <a
                  href={offer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${offer.seller} offer in a new tab`}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-[8px] border border-[rgba(242,193,78,0.3)] bg-[rgba(242,193,78,0.06)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--vk-gold-soft)] transition hover:brightness-[1.08]"
                >
                  Open
                  <ExternalLink
                    size={11}
                    strokeWidth={2.2}
                    aria-hidden="true"
                  />
                </a>
              ) : (
                <span className="text-[11px] text-[var(--vk-note-quiet)]">
                  —
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PanelOffers({
  marketplace,
  candidates,
  recommendation,
}: {
  /** Null when only the recommendation's destination exists (partial tab). */
  marketplace: MarketplaceComparison | null;
  candidates: CandidateSet | null;
  /** For the verified "recommended destination" hero, once it exists. */
  recommendation?: Recommendation | null;
}) {
  const t = useT();
  const items = marketplace?.items ?? [];
  const [focusIndex, setFocusIndex] = React.useState(0);
  const focused = items[Math.min(focusIndex, items.length - 1)] ?? null;
  const focusedProduct =
    (focused &&
      candidates?.products?.find((p) => p.name === focused.product)) ||
    null;

  const buyFrom =
    recommendation?.decision_summary?.buy_from ??
    recommendation?.recommendation?.seller ??
    null;
  const offerUrl = recommendation?.actions?.primary_offer_url ?? null;

  // No offer table AND no verified destination — the one truly empty case.
  if (items.length === 0 && !buyFrom && !offerUrl) {
    return (
      <div className="rounded-2xl border border-dashed border-[rgba(150,178,205,0.2)] p-[22px] text-center">
        <div className="text-sm font-semibold text-[var(--vk-text-strong)]">
          No offers yet
        </div>
        <div className="mt-1.5 text-[13px] leading-[1.5] text-[var(--vk-text-muted)]">
          Pick products to compare in the chat — Lumora then gathers exact-match
          seller offers for them.
        </div>
      </div>
    );
  }

  return (
    <div className="vk-ws-seq">
      {/* Recommended destination (design `.mkx-hero`) — only from the
          backend's own verified pick, never inferred client-side. */}
      {buyFrom && (
        <div className="mb-[18px]">
          <div className="mb-2.5 text-[10px] font-extrabold tracking-[0.14em] text-[#e6b3a4] uppercase">
            Best place to buy · recommended destination
          </div>
          <div className="bg-linear-[135deg,rgba(242,193,78,0.08),rgba(249, 248, 242, 0.6)_55%] flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgba(242,193,78,0.3)] px-[17px] py-3.5">
            <div className="min-w-0">
              <div className="text-[16px] font-semibold break-words text-[var(--vk-text-strong)]">
                {buyFrom}
              </div>
              <div className="mt-0.5 text-[12px] text-[var(--vk-text-muted)]">
                Lumora’s verified destination for your pick
              </div>
            </div>
            {offerUrl && (
              <a
                href={offerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 flex-none cursor-pointer items-center gap-1.5 rounded-[9px] bg-linear-[150deg,#348568,#28765c] px-[15px] py-[9px] text-[13px] font-semibold text-[#ffffff] transition hover:brightness-[1.04]"
              >
                Open the offer
                <ExternalLink size={13} strokeWidth={2.2} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      )}

      <div>
        <GmHead
          eye="Where to spend"
          sub="Every exact-match offer for your selection"
        />

        {/* Product switcher (one table per compared product) */}
        {items.length > 1 && (
          <div
            role="tablist"
            aria-label={t('ws.compared')}
            className="bg-[rgba(249, 248, 242, 0.6)] mb-3.5 flex flex-wrap gap-1.5 rounded-xl border border-[rgba(150,178,205,0.14)] p-1"
          >
            {items.map((item, index) => (
              <button
                key={item.product}
                type="button"
                role="tab"
                aria-selected={index === focusIndex}
                onClick={() => setFocusIndex(index)}
                className={cn(
                  'inline-flex min-h-[38px] cursor-pointer items-center justify-center rounded-[9px] border px-3 py-[9px] text-[13px] font-semibold outline-none',
                  'transition-[background,color,border-color] duration-[var(--vk-duration-fast)] ease-[var(--vk-ease-standard)]',
                  'focus-visible:shadow-[0_0_0_2px_var(--vk-accent-ring)]',
                  index === focusIndex
                    ? 'border-[rgba(232,137,46,0.44)] bg-[rgba(232,137,46,0.12)] text-[var(--vk-gold-soft)]'
                    : 'border-transparent text-[var(--vk-text-muted)] hover:bg-[rgba(120,150,180,0.07)] hover:text-[var(--vk-text-subtle)]'
                )}
              >
                {item.product}
              </button>
            ))}
          </div>
        )}

        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[rgba(150,178,205,0.2)] p-4 text-[13px] leading-[1.5] text-[var(--vk-text-muted)]">
            The per-seller offer table appears here once Lumora has compared
            live sellers for your pick.
          </div>
        )}

        {focused && (
          <>
            {/* Selected product header */}
            <div className="vk-anim-selected bg-[rgba(249, 248, 242, 0.74)] flex items-center gap-3.5 rounded-[14px] border border-[var(--vk-border)] p-3.5">
              <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-xl border border-[rgba(150,178,205,0.18)] bg-linear-[145deg,rgba(150,178,205,0.08),rgba(150,178,205,0.02)] text-[var(--vk-text-muted)]">
                <Smartphone size={24} strokeWidth={1.4} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-bold tracking-[0.05em] text-[var(--vk-text-muted)] uppercase">
                  Selected product
                </div>
                <div className="mt-[3px] truncate text-[15px] font-semibold text-[var(--vk-text-strong)]">
                  {focused.product}
                </div>
                {focusedProduct?.variant && (
                  <div className="mt-0.5 text-[12.5px] text-[var(--vk-text-muted)]">
                    {focusedProduct.variant}
                  </div>
                )}
              </div>
              {focusedProduct?.scores && (
                <div className="hidden flex-none text-right sm:block">
                  <div className="text-[17px] leading-none font-semibold text-[var(--vk-gold-soft)] tabular-nums">
                    {Math.round(focusedProduct.scores.match)}%
                  </div>
                  <div className="mt-0.5 text-[8px] tracking-[0.05em] text-[var(--vk-note-quiet)] uppercase">
                    match{focusedProduct.scores.estimated ? ' · est.' : ''}
                  </div>
                </div>
              )}
            </div>

            <OfferTable item={focused} />
          </>
        )}
      </div>

      {marketplace?.notes && (
        <p className="mt-3.5 mb-0 text-xs leading-[1.55] break-words text-[var(--vk-text-muted)]">
          {marketplace.notes}
        </p>
      )}
    </div>
  );
}
