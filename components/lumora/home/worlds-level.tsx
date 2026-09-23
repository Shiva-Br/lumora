'use client';

import * as React from 'react';

import {
  SpecSearch,
  type SpecSearchHandle,
} from '@/components/lumora/home/spec-search';
import { useT } from '@/lib/i18n/provider';
import { setMood } from '@/lib/shell/shell-store';
import { categoriesOf } from '@/lib/taxonomy/atlas';
import { WORLD_ICONS } from '@/lib/taxonomy/world-icons';
import { DECISION_WORLDS, type DecisionWorld } from '@/lib/taxonomy/worlds';

import {
  overlayOpen,
  rideDuration,
  type GoLevel,
  type HomeLevel,
} from './home-elevator';

type WorldSort = 'default' | 'recent' | 'alpha';

const SORTS: {
  id: WorldSort;
  labelKey: 'sort.default' | 'home.recentlyUsed' | 'sort.alpha';
}[] = [
  { id: 'default', labelKey: 'sort.default' },
  { id: 'recent', labelKey: 'home.recentlyUsed' },
  { id: 'alpha', labelKey: 'sort.alpha' },
];

function sortedWorlds(sort: WorldSort): DecisionWorld[] {
  const worlds = [...DECISION_WORLDS];
  if (sort === 'alpha')
    worlds.sort((a, b) => a.display.localeCompare(b.display));
  // 'recent' needs the visit history a later phase records; until then it
  // keeps the taxonomy order, exactly as the design does with no recents.
  return worlds;
}

function WorldCard({ world, index }: { world: DecisionWorld; index: number }) {
  return (
    <div
      className="vk-wcard"
      data-world={world.id}
      title={world.name}
      style={{ '--c': world.tone, '--i': index } as React.CSSProperties}
      onMouseEnter={() => setMood(world.tone)}
      onMouseLeave={() => setMood(null)}
    >
      <span className="vk-wc-atmos" />
      <span className="vk-wc-drift" />
      <span className="vk-wc-hover" />
      <span className="vk-wc-grain" />
      <span className="vk-wc-emblem">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: WORLD_ICONS[world.id] ?? '' }}
        />
      </span>
      <span className="vk-wc-body">
        <span className="vk-wc-title">{world.display}</span>
        <span className="vk-wc-desc">{world.description}</span>
        <span className="vk-wc-foot">
          <span className="vk-wc-meta">
            {categoriesOf(world.id).length} categories
          </span>
          <span className="vk-wc-enter">Enter →</span>
        </span>
      </span>
    </div>
  );
}

export function WorldsLevel({
  goLevel,
  level,
  onStartDecision,
}: {
  goLevel: GoLevel;
  level: HomeLevel;
  /** "Start a Decision": ride up and focus the conversation field. */
  onStartDecision: () => void;
}) {
  const t = useT();
  const [sort, setSort] = React.useState<WorldSort>('default');
  const gridRef = React.useRef<HTMLDivElement>(null);
  const specRef = React.useRef<SpecSearchHandle>(null);
  const worlds = sortedWorlds(sort);

  const levelRef = React.useRef(level);
  React.useEffect(() => {
    levelRef.current = level;
    // Wheel-riding up can slide a hovered card away without a mouseleave, so
    // the tone would stick — arriving back at Level 1 always resets the mood.
    if (level === 1) setMood(null);
  }, [level]);
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k')
        return;
      if (overlayOpen()) return;
      event.preventDefault();
      if (levelRef.current !== 2) {
        goLevel(2);
        setTimeout(() => specRef.current?.open(), rideDuration() + 20);
      } else {
        specRef.current?.open();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [goLevel]);

  // Pointer-follow light on the cards, exactly like the design: the grid
  // tracks the pointer and each card's hover gradient follows it.
  const onGridPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const card = (event.target as HTMLElement).closest<HTMLElement>(
      '.vk-wcard'
    );
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty(
      '--px',
      `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`
    );
    card.style.setProperty(
      '--py',
      `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`
    );
  };

  return (
    <>
      <div className="vk-lvl-nav vk-lvl-nav-up">
        <button
          type="button"
          className="vk-lvl-btn"
          aria-label={t('home.returnWelcome')}
          data-elev-focus="up"
          onClick={() => goLevel(1)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden="true"
          >
            <path
              d="M6 15l6-6 6 6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{t('home.backToConversation')}</span>
        </button>
      </div>

      <SpecSearch ref={specRef} />

      <div className="vk-wsec-head">
        <div>
          <h3 className="vk-wsec-title">{t('sidebar.decisionWorlds')}</h3>
          <p className="vk-wsec-sub">
            Choose a world to enter its specialized decision intelligence.
          </p>
        </div>
        <div
          className="vk-wsort"
          role="group"
          aria-label={t('home.sortWorlds')}
        >
          {SORTS.map(({ id, labelKey }) => (
            <button
              key={id}
              type="button"
              data-on={sort === id ? '' : undefined}
              aria-pressed={sort === id}
              onClick={() => setSort(id)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div ref={gridRef} className="vk-wgrid" onPointerMove={onGridPointerMove}>
        {worlds.map((world, index) => (
          <WorldCard key={world.id} world={world} index={index} />
        ))}
      </div>

      <section className="vk-dash-sec">
        <div className="vk-dash-head">
          <h3>{t('home.continueDecisions')}</h3>
        </div>
        <div className="vk-dash-empty">
          <p>
            No unfinished decisions. Start a new decision whenever you&rsquo;re
            ready.
          </p>
          <button
            type="button"
            className="vk-dash-btn vk-dash-btn-primary"
            onClick={onStartDecision}
          >
            Start a Decision
          </button>
        </div>
      </section>

      <section className="vk-dash-sec">
        <div className="vk-dash-head">
          <h3>{t('home.recentExperts')}</h3>
        </div>
        <div className="vk-dash-empty">
          <p>
            No recently used Experts. Explore Decision Worlds to begin a
            specialized decision.
          </p>
          <button
            type="button"
            className="vk-dash-btn"
            onClick={() =>
              gridRef.current?.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                  .matches
                  ? 'auto'
                  : 'smooth',
                block: 'start',
              })
            }
          >
            Explore Decision Worlds
          </button>
        </div>
      </section>
    </>
  );
}
