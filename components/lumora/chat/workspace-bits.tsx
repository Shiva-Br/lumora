'use client';

import * as React from 'react';

import { useT } from '@/lib/i18n/provider';
import { useCountUp, useReducedMotion } from '@/lib/motion';
import type { WorldContext } from '@/lib/taxonomy/resolve';
import { cn } from '@/lib/utils';

/** Two-line section header (design `gmHead`): eyebrow + bold subtitle. */
export function GmHead({ eye, sub }: { eye: string; sub?: string }) {
  return (
    <div className="mb-[13px]">
      <div className="text-[11px] tracking-[0.14em] text-[var(--vk-text-muted)] uppercase">
        {eye}
      </div>
      {sub && (
        <div className="mt-[5px] text-[18px] leading-[1.25] font-bold tracking-[-0.01em] text-[var(--vk-text-strong)]">
          {sub}
        </div>
      )}
    </div>
  );
}

/**
 * What a workspace page shows before its backend stage has produced anything.
 *
 * The alternative — rendering the page head and then nothing — is what makes a
 * tab look broken rather than pending, and it was the whole visible symptom of
 * the workspace bug: chrome, three tabs, and an empty column underneath.
 */
export function GmPending({ body }: { body: string }) {
  const t = useT();
  return (
    <div className="rounded-2xl border border-dashed border-[rgba(150,178,205,0.2)] px-8 py-10 text-center">
      <div className="text-sm font-semibold text-[var(--vk-text-strong)]">
        {t('ws.pendingTitle')}
      </div>
      <p className="mx-auto mt-1.5 mb-0 max-w-[420px] text-[13px] leading-[1.55] text-[var(--vk-text-muted)]">
        {body}
      </p>
    </div>
  );
}

/** Ember card eyebrow (design `.gm-cardeye`). */
export function CardEye({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-extrabold tracking-[0.14em] text-[#e6b3a4] uppercase">
      {children}
    </div>
  );
}

export type WorkspaceContextMeta = {
  code?: string;
  name?: string;
  expert?: string;
  scenario?: string;
};

export function contextMetaFromWorld(
  context?: WorldContext | null,
  fallbackName?: string
): WorkspaceContextMeta | null {
  if (!context && !fallbackName) return null;
  return {
    code: context?.categoryId,
    name: context?.category ?? fallbackName,
    expert: context?.expert,
  };
}

export function GmContext({ meta }: { meta: WorkspaceContextMeta | null }) {
  if (!meta?.name && !meta?.code) return null;
  return (
    <div className="gm-ctx-sec">
      <div className="gm-ctx">
        {meta.code && <span className="gm-ctx-id">{meta.code}</span>}
        <div className="gm-ctx-b">
          {meta.name && <div className="gm-ctx-name">{meta.name}</div>}
          {meta.expert && <div className="gm-ctx-exp">{meta.expert}</div>}
          {meta.scenario && <div className="gm-ctx-scn">{meta.scenario}</div>}
        </div>
      </div>
    </div>
  );
}

export function GmOpen({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="gm-open">
      <span aria-hidden="true" className="gm-open-mark">
        ◆
      </span>
      <div>
        <div className="gm-open-k">LUMORA · Why this page</div>
        <div className="gm-open-s">{children}</div>
      </div>
    </div>
  );
}

export function GmGlance({
  title,
  items,
}: {
  title?: string;
  items: { n: string; l: string; amb?: boolean }[];
}) {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-[13px] font-semibold text-[var(--vk-text-strong)]">
        {title ?? t('gm.atGlance')}
      </div>
      <div className="gm-glance">
        {items.map((item) => (
          <div
            key={`${item.n}-${item.l}`}
            className={cn('gm-pill', item.amb && 'amb')}
          >
            <div className="gm-pill-n">{item.n}</div>
            <div className="gm-pill-l">{item.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GmTrust({
  title,
  bullets,
  note,
}: {
  title?: string;
  bullets: React.ReactNode[];
  note?: React.ReactNode;
}) {
  if (bullets.length === 0 && !note) return null;
  return (
    <div>
      <GmHead eye="Why you can trust it" sub={title} />
      <div className="gm-trust">
        {bullets.length > 0 && (
          <ul>
            {bullets.map((bullet, index) => (
              <li key={index}>{bullet}</li>
            ))}
          </ul>
        )}
        {note && <div className="gm-trust-m">{note}</div>}
      </div>
    </div>
  );
}

export type BoundaryItem = { when?: string; text: React.ReactNode };

export function GmBoundary({
  title,
  subtitle,
  items,
  note,
}: {
  title?: string;
  subtitle?: string;
  items: BoundaryItem[];
  note?: React.ReactNode;
}) {
  const t = useT();
  if (items.length === 0 && !note) return null;
  return (
    <div>
      <GmHead
        eye={title ?? t('ws.boundary')}
        sub={subtitle ?? t('ws.changeMyMind')}
      />
      {items.length > 0 && (
        <div className="gm-bound">
          {items.map((item, index) => (
            <div
              key={`${item.when ?? ''}-${index}`}
              className={cn('gm-bnode', !item.when && 'solo')}
            >
              {item.when && <span className="gm-bif">{item.when}</span>}
              <span className="gm-bt">{item.text}</span>
            </div>
          ))}
        </div>
      )}
      {note && <div className="gm-bnote">{note}</div>}
    </div>
  );
}

export function GmEvidence({
  items,
}: {
  items: {
    name: string;
    pill?: string;
    strong: string;
    acceptable: string;
    tradeoffs: string;
    dealbreakers: string;
    win?: boolean;
  }[];
}) {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <div>
      <GmHead
        eye="Decision evidence summary"
        sub="The whole board, counted per finalist"
      />
      <div className="gm-des">
        {items.map((item) => (
          <div key={item.name} className={cn('gm-desc', item.win && 'win')}>
            <div className="gm-dn">
              {item.name}
              {item.pill ? <span className="gm-dp">{item.pill}</span> : null}
            </div>
            <div className="gm-drow">
              <span className="gm-dl">{t('ws.strongFits')}</span>
              <span className="gm-dc c-grn">{item.strong}</span>
            </div>
            <div className="gm-drow">
              <span className="gm-dl">{t('ws.acceptable')}</span>
              <span className="gm-dc c-neu">{item.acceptable}</span>
            </div>
            <div className="gm-drow">
              <span className="gm-dl">Trade-offs</span>
              <span className="gm-dc c-amb">{item.tradeoffs}</span>
            </div>
            <div className="gm-drow">
              <span className="gm-dl">Deal-breakers</span>
              <span className="gm-dc c-emb">{item.dealbreakers}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GmDecisive({
  title,
  text,
}: {
  title?: string;
  text?: React.ReactNode;
}) {
  const t = useT();
  if (!text) return null;
  return (
    <div className="gm-decisive">
      <div className="gm-dec-h">
        <span className="gm-dec-eye">{t('ws.decisive')}</span>
        {title ? <span className="gm-dec-tag">{title}</span> : null}
      </div>
      <p>{text}</p>
    </div>
  );
}

export function GmAlternatives({
  title,
  items,
}: {
  title?: string;
  items: { name: string; text: React.ReactNode }[];
}) {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <div>
      <GmHead eye="No universal best" sub={title ?? t('ws.pickAnother')} />
      <div className="gm-alt">
        {items.map((item) => (
          <div key={item.name} className="gm-altc">
            <div className="gm-an">{item.name}</div>
            <div className="gm-aw">{t('ws.chooseIf')}</div>
            <div className="gm-at">{item.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GmCall({
  title,
  quote,
  sub,
}: {
  title?: string;
  quote?: React.ReactNode;
  sub?: React.ReactNode;
}) {
  if (!quote) return null;
  return (
    <div>
      <GmHead eye="LUMORA’s personal call" sub={title} />
      <div className="gm-call">
        <div className="gm-call-k">
          <span aria-hidden="true" className="gm-call-mark">
            ◆
          </span>
          If I were you
        </div>
        <div className="gm-call-q">{quote}</div>
        {sub ? <div className="gm-call-s">{sub}</div> : null}
      </div>
    </div>
  );
}

/** Design `cxTone`: score → tone gradient. `pct` is 0–100. */
export function meterTone(pct: number): string {
  if (pct >= 80) return 'bg-linear-[90deg,#57b085,#7cc79a]';
  if (pct >= 60) return 'bg-linear-[90deg,#348568,#28765c]';
  if (pct >= 45) return 'bg-linear-[90deg,#5b6d63,#5b6d63]';
  return 'bg-linear-[90deg,#c8735a,#e08a6f]';
}

/** The comparison meter (design `.cx-meter`) — 6px toned bar. */
export function Meter({ pct, className }: { pct: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div
      aria-hidden="true"
      className={cn(
        'h-[6px] w-full overflow-hidden rounded-[3px] bg-[rgba(150,178,205,0.14)]',
        className
      )}
    >
      <span
        className={cn('block h-full rounded-[inherit]', meterTone(clamped))}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** Counted percentage (design `.an-pct` count-up: 1s cubic ease-out). */
export function MatchPct({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const target = Math.round(Math.min(100, Math.max(0, value)));
  const counted = useCountUp(target, !reduced);
  return (
    <span className={cn('tabular-nums', className)}>
      <span aria-hidden="true">{reduced ? target : counted}%</span>
      <span className="sr-only">{target}%</span>
    </span>
  );
}
