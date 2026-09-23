// Deal-hunt results — live discounted listings rendered IN the thread (unlike
// candidates, which live in the insight panel): a deal is a browse result, not
// a pipeline stage. Numbers come backend-verified from the marketplaces' own
// published old prices; nothing here is model-generated.
import { ExternalLink } from 'lucide-react';

import type { DealsPayload } from '@/lib/api/types';

function money(v: number, currency?: string): string {
  const n = Number.isInteger(v) ? v.toString() : v.toFixed(2);
  return currency ? `${currency} ${n}` : n;
}

export function DealsCards({ payload }: { payload: DealsPayload }) {
  if (!payload.deals?.length) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[12px] text-[var(--vk-text-muted)]">
        Live discounts on {payload.category} — scanned {payload.scanned_count}{' '}
        listings, showing the {payload.deals.length} deepest genuine markdowns.
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {payload.deals.map((deal) => (
          <a
            key={`${deal.title}-${deal.seller ?? ''}`}
            href={deal.link || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-[rgba(249, 248, 242, 0.56)] flex gap-3 rounded-[14px] border border-[var(--vk-border)] p-3 transition-colors hover:border-[rgba(232,137,46,0.4)]"
          >
            {deal.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={deal.image_url}
                alt=""
                className="h-16 w-16 flex-none rounded-[10px] bg-white object-contain"
              />
            ) : (
              <div className="h-16 w-16 flex-none rounded-[10px] bg-[rgba(150,178,205,0.08)]" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <span className="line-clamp-2 text-[13px] leading-[1.4] font-medium text-[var(--vk-text-strong)]">
                  {deal.title}
                </span>
                <span className="flex-none rounded-md bg-[rgba(90,160,110,0.16)] px-1.5 py-0.5 text-[11.5px] font-bold text-[var(--vk-success)]">
                  −{deal.discount_pct}%
                </span>
              </div>
              <div className="mt-1 text-[13px]">
                <span className="font-semibold text-[var(--vk-text-strong)]">
                  {money(deal.price, deal.currency)}
                </span>{' '}
                <span className="text-[12px] text-[var(--vk-text-faint)] line-through">
                  {money(deal.old_price, deal.currency)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[var(--vk-text-muted)]">
                {deal.seller && <span className="truncate">{deal.seller}</span>}
                {deal.link && (
                  <ExternalLink
                    size={11}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="flex-none opacity-0 transition-opacity group-hover:opacity-100"
                  />
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
