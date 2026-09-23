'use client';

import * as React from 'react';

import { useT } from '@/lib/i18n/provider';
import { categoriesOf } from '@/lib/taxonomy/atlas';
import { DECISION_WORLDS } from '@/lib/taxonomy/worlds';

type SearchRow = {
  world: string;
  cat: string;
  sub?: string;
  expert?: string;
  hay: string;
};

/** The flattened taxonomy the search scans. Fixed data, built once. */
const FLAT: SearchRow[] = DECISION_WORLDS.flatMap((world) =>
  categoriesOf(world.id).flatMap((category) => {
    const base = `${world.name} ${world.display} ${category.name}`;
    const catRow: SearchRow = {
      world: world.name,
      cat: category.name,
      expert: category.expert,
      hay: `${base} ${category.expert ?? ''}`.toLowerCase(),
    };
    const subRows = category.subs.map((sub): SearchRow => ({
      world: world.name,
      cat: category.name,
      sub,
      expert: category.expert,
      hay: `${base} ${sub} ${category.expert ?? ''}`.toLowerCase(),
    }));
    return [catRow, ...subRows];
  })
);

function searchTaxonomy(query: string): SearchRow[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const out: SearchRow[] = [];
  for (const row of FLAT) {
    if (tokens.every((token) => row.hay.includes(token))) {
      out.push(row);
      if (out.length > 200) break;
    }
  }
  out.sort(
    (a, b) =>
      (a.sub ? 0 : 1) - (b.sub ? 0 : 1) ||
      (a.sub || a.cat).length - (b.sub || b.cat).length
  );
  return out.slice(0, 40);
}

export type SpecSearchHandle = { open: () => void };

export function SpecSearch({ ref }: { ref?: React.Ref<SpecSearchHandle> }) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [kbd, setKbd] = React.useState(-1);
  const [showResults, setShowResults] = React.useState(false);

  const rootRef = React.useRef<HTMLElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const handleRef = React.useRef<HTMLButtonElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const fillRef = React.useRef<HTMLSpanElement>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  const results = React.useMemo(() => searchTaxonomy(query), [query]);

  const openSearch = React.useCallback(() => {
    setOpen(true);
    // The field mounts with the open state; focus once it exists.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  React.useImperativeHandle(ref, () => ({ open: openSearch }), [openSearch]);

  const closeSearch = () => {
    setOpen(false);
    setQuery('');
    setKbd(-1);
    setShowResults(false);
  };

  // ---- the pull-right handle, faithful to the design: an actual drag past
  // 60% of the track opens the search; a keyboard press opens it directly.
  const dragState = React.useRef<{ dragging: boolean; startX: number }>({
    dragging: false,
    startX: 0,
  });

  const setProgress = (dx: number): number => {
    const handle = handleRef.current;
    const track = trackRef.current;
    if (!handle || !track) return 0;
    const max = track.clientWidth - handle.offsetWidth - 6;
    const px = Math.max(0, Math.min(max, dx));
    handle.style.transform = `translateY(-50%) translateX(${px}px)`;
    if (fillRef.current)
      fillRef.current.style.width = `${px + handle.offsetWidth / 2}px`;
    return max ? px / max : 0;
  };

  const resetHandle = () => {
    const handle = handleRef.current;
    if (handle) {
      handle.removeAttribute('data-dragging');
      handle.style.transform = 'translateY(-50%) translateX(0)';
    }
    if (fillRef.current) fillRef.current.style.width = '0';
  };

  const onHandlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (open) return;
    dragState.current = { dragging: true, startX: event.clientX };
    handleRef.current?.setAttribute('data-dragging', '');
    try {
      handleRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort; the drag still tracks via move events.
    }
    event.preventDefault();
  };

  const onHandlePointerMove = (
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (!dragState.current.dragging) return;
    setProgress(event.clientX - dragState.current.startX);
  };

  const onHandlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;
    handleRef.current?.removeAttribute('data-dragging');
    const progress = setProgress(event.clientX - dragState.current.startX);
    if (progress >= 0.6) openSearch();
    else resetHandle();
  };

  // Keep the keyboard-highlighted row inside the results panel's fold.
  React.useEffect(() => {
    if (kbd < 0) return;
    resultsRef.current
      ?.querySelector('[data-kbd]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [kbd]);

  // Click anywhere outside hides the results dropdown, like the design.
  React.useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node))
        setShowResults(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const grouped = React.useMemo(() => {
    const byWorld = new Map<string, { row: SearchRow; index: number }[]>();
    results.forEach((row, index) => {
      const list = byWorld.get(row.world) ?? [];
      list.push({ row, index });
      byWorld.set(row.world, list);
    });
    return [...byWorld.entries()];
  }, [results]);

  return (
    <section ref={rootRef} className="vk-spec" data-open={open ? '1' : '0'}>
      <div className="vk-spec-titles">
        <div className="vk-spec-title-row">
          <h3 className="vk-spec-title">
            Find a <b>{t('home.specialized')}</b> Decision Area
          </h3>
          {!open && (
            <div className="vk-spec-pull" dir="ltr">
              <div ref={trackRef} className="vk-spec-track">
                <span ref={fillRef} className="vk-spec-fill" />
                <button
                  ref={handleRef}
                  type="button"
                  className="vk-spec-handle"
                  aria-expanded={open}
                  aria-label={t('home.openSearch')}
                  title={t('home.pullRight')}
                  onPointerDown={onHandlePointerDown}
                  onPointerMove={onHandlePointerMove}
                  onPointerUp={onHandlePointerUp}
                  onPointerCancel={() => {
                    dragState.current.dragging = false;
                    resetHandle();
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' ||
                      event.key === ' ' ||
                      event.key === 'ArrowRight'
                    ) {
                      event.preventDefault();
                      openSearch();
                    }
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12h13M12 5l7 7-7 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span className="vk-spec-hint">{t('home.pullRight')}</span>
              </div>
            </div>
          )}
        </div>
        <p className="vk-spec-sub">
          Search <strong>{t('sidebar.decisionWorlds')}</strong> and go directly
          to the specialized area you need.
        </p>
      </div>

      {open && (
        <div className="vk-spec-field-wrap">
          <div className="vk-spec-field">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5b6d63"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              placeholder={t('home.searchPlaceholder')}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setKbd(-1);
                setShowResults(Boolean(event.target.value.trim()));
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  if (showResults) setShowResults(false);
                  else if (!query.trim()) closeSearch();
                  return;
                }
                if (results.length === 0) return;
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setKbd((k) => Math.min(results.length - 1, k + 1));
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setKbd((k) => Math.max(0, k - 1));
                }
              }}
            />
            <span className="vk-kbd">⌘ K</span>
            <button
              type="button"
              className="vk-spec-close"
              aria-label={t('home.closeSearch')}
              onClick={closeSearch}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div
            ref={resultsRef}
            className="vk-spec-results"
            data-show={showResults && query.trim() ? '' : undefined}
          >
            {results.length === 0 ? (
              <div className="vk-sr-empty">No matching intelligence found.</div>
            ) : (
              grouped.map(([world, rows]) => (
                <div key={world} className="vk-sr-group">
                  <div className="vk-sr-phase">{world}</div>
                  {rows.map(({ row, index }) => (
                    <div
                      key={`${row.cat}|${row.sub ?? ''}`}
                      className="vk-sr-item"
                      data-kbd={index === kbd ? '' : undefined}
                    >
                      <div className="vk-sr-crumb">
                        <div className="vk-sr-lead">{row.sub ?? row.cat}</div>
                        <div className="vk-sr-path">
                          <b>{row.cat}</b>
                          {row.sub ? <> → {row.sub}</> : null}
                          {row.expert ? (
                            <>
                              {' '}
                              ·{' '}
                              <span className="vk-sr-expert">{row.expert}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <span className="vk-sr-go">Enter →</span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
