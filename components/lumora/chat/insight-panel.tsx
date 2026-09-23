'use client';

// The LUMORA Workspace — chrome, tab bar, and close choreography, from
// LUMORA_v3_0_FINAL (`rp-analysis`): three identity tabs, each a two-line
// button (label + role word), per-tab surface tint on the scroll body.
//
// Tabs light up as their backend stage delivers data; a tab with no data yet
// still stays clickable so the user can inspect that surface's empty/partial
// state instead of being blocked by the chrome.
import { X } from 'lucide-react';
import * as React from 'react';

import type { TranslationKey } from '@/lib/i18n';
import { useLocale } from '@/lib/i18n/provider';
import { cn } from '@/lib/utils';

export type PanelTab = 'products' | 'analysis' | 'offers';

// The tab labels live as translation KEYS rather than strings: this is module
// scope, where a hook cannot run, and baking English here is how the workspace
// tabs stayed untranslated while every other check passed.
const TAB_META: Record<
  PanelTab,
  {
    glyph: string;
    labelKey: TranslationKey;
    subKey: TranslationKey;
    surf: string;
  }
> = {
  // Design order: My Best Choice (Decision) → Why It Wins (Proof) → Best
  // Place to Buy (Action). `products` is the proof tab (finalists live
  // there); `analysis` is the decision tab; `offers` is the action tab.
  analysis: {
    glyph: '◆',
    labelKey: 'tabs.rec',
    subKey: 'tabs.recSub',
    surf: 'vk-surf-rec',
  },
  products: {
    glyph: '▤',
    labelKey: 'tabs.cmp',
    subKey: 'tabs.cmpSub',
    surf: 'vk-surf-cmp',
  },
  offers: {
    glyph: '◇',
    labelKey: 'tabs.mkt',
    subKey: 'tabs.mktSub',
    surf: 'vk-surf-mkt',
  },
};

/** Design tab order — decision first, proof, then action. */
const TAB_ORDER: PanelTab[] = ['analysis', 'products', 'offers'];

const CLOSE_ANIMATION_MS = 580;

/** DOM ids, so the tabs and the panel they control can point at each other. */
const PANEL_ID = 'vk-ws-panel';
const tabId = (tab: PanelTab) => `vk-ws-tab-${tab}`;

export function InsightPanel({
  tab,
  availability,
  onSelectTab,
  onClose,
  width,
  children,
}: {
  tab: PanelTab;
  availability: Record<PanelTab, boolean>;
  onSelectTab: (tab: PanelTab) => void;
  onClose: () => void;
  /** Desktop width (px or %); small screens take the full column. */
  width: string;
  children: React.ReactNode;
}) {
  const { t, dir } = useLocale();
  const [closing, setClosing] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const tablistRef = React.useRef<HTMLDivElement>(null);

  const onTablistKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const rtl = dir === 'rtl';
    const index = TAB_ORDER.indexOf(tab);

    let next: number | null = null;
    if (event.key === 'ArrowRight') next = rtl ? index - 1 : index + 1;
    else if (event.key === 'ArrowLeft') next = rtl ? index + 1 : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TAB_ORDER.length - 1;
    if (next === null) return;

    event.preventDefault();
    const target = TAB_ORDER[(next + TAB_ORDER.length) % TAB_ORDER.length];
    onSelectTab(target);
    // Focus has to follow the selection, or the roving tabIndex leaves the
    // keyboard user parked on a tab that is no longer the selected one.
    tablistRef.current
      ?.querySelector<HTMLButtonElement>(`#${tabId(target)}`)
      ?.focus();
  };

  const requestClose = React.useCallback(() => {
    if (closing) return;
    setClosing(true);
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    window.setTimeout(onClose, reduced ? 150 : CLOSE_ANIMATION_MS);
  }, [closing, onClose]);

  // Escape closes the panel, like the design prototype.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);

  return (
    <div
      ref={panelRef}
      role="complementary"
      aria-label={t('ws.title')}
      style={{ '--panel-w': width } as React.CSSProperties}
      className={cn(
        // The design separates the workspace with a gold-tinted hairline
        // (`.rp-analysis` border) — the panel body carries its radial wash.
        'vk-panel bg-[rgba(249, 248, 242, 0.94)] absolute inset-0 z-30 flex h-full overflow-hidden border-l border-[rgba(242,193,78,0.16)]',
        'lg:static lg:z-auto lg:w-[var(--panel-w)] lg:max-w-[calc(100%_-_360px)] lg:min-w-[560px] lg:flex-none',
        closing && 'vk-panel-closing'
      )}
    >
      <div className="bg-[radial-gradient(120%_88%_at_50%_0%,rgba(249, 248, 242, 0.5),rgba(249, 248, 242, 0.96)_55%,rgba(249, 248, 242, 0.99))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_30px_90px_rgba(249, 248, 242, 0.55)] flex h-full max-h-full w-full flex-col overflow-hidden">
        {/* Header (design `rpa-head`: 12/16/6, plain 13px title) */}
        <div className="flex flex-none items-center justify-between gap-2.5 px-4 pt-3 pb-1.5">
          <h2 className="m-0 text-[13px] font-semibold text-[var(--vk-text-strong)]">
            LUMORA Workspace
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label={t('ws.close')}
            className="grid h-[30px] w-[30px] flex-none cursor-pointer place-items-center rounded-lg border border-[var(--vk-border)] bg-transparent text-[var(--vk-text-muted)] transition-colors outline-none hover:bg-[rgba(150,178,205,0.08)] hover:text-[var(--vk-text-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent)]"
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* Tab bar (design `rpa-nav`): three equal two-line identity tabs. */}
        <div
          ref={tablistRef}
          role="tablist"
          aria-label={t('ws.pages')}
          onKeyDown={onTablistKeyDown}
          className="flex flex-none gap-[7px] border-b border-[rgba(150,178,205,0.1)] px-3.5 pt-1 pb-3"
        >
          {TAB_ORDER.map((key) => {
            const meta = TAB_META[key];
            const active = key === tab;
            const available = availability[key];
            return (
              <button
                key={key}
                id={tabId(key)}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={PANEL_ID}
                tabIndex={active ? 0 : -1}
                onClick={() => onSelectTab(key)}
                title={available ? undefined : t('ws.stepNotRun')}
                className={cn(
                  'flex min-h-[46px] flex-1 flex-wrap content-center items-center justify-center gap-x-[7px] gap-y-0.5 rounded-xl border px-2 py-2 text-[11.5px] leading-[1.12] outline-none',
                  'transition-[color,background,border-color] duration-[180ms]',
                  active
                    ? 'cursor-default border-[rgba(242,193,78,0.32)] bg-[rgba(242,193,78,0.08)] font-semibold text-[var(--vk-gold-soft)] shadow-[inset_0_-2px_0_var(--vk-gold)]'
                    : 'cursor-pointer border-[rgba(150,178,205,0.14)] bg-[rgba(150,178,205,0.05)] text-[var(--vk-text-muted)] hover:text-[var(--vk-text-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)]',
                  !available &&
                    !active &&
                    'border-[rgba(150,178,205,0.1)] text-[var(--vk-text-faint)] hover:border-[rgba(150,178,205,0.18)] hover:bg-[rgba(150,178,205,0.06)] hover:text-[var(--vk-text-muted)]'
                )}
              >
                <span aria-hidden="true" className="text-[11px] opacity-90">
                  {meta.glyph}
                </span>
                <span className="font-[650]">{t(meta.labelKey)}</span>
                <span
                  className={cn(
                    'mt-px basis-full text-center text-[8px] font-extrabold tracking-[0.15em] uppercase',
                    active ? 'opacity-75' : 'opacity-55'
                  )}
                >
                  {t(meta.subKey)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab content — keyed by tab so the staggered reveal replays. */}
        <div
          key={tab}
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={tabId(tab)}
          tabIndex={0}
          className={cn(
            'min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-4 pb-[26px]',
            TAB_META[tab].surf
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
