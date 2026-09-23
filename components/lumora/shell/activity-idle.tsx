'use client';

import { useT } from '@/lib/i18n/provider';

const WORD_KEYS = [
  'idle.words.find',
  'idle.words.discover',
  'idle.words.buy',
  'idle.words.understand',
] as const;

export function ActivityIdle({
  onStart,
  onExploreWorlds,
}: {
  /** "Start with any decision" — hand focus to the Home composer. */
  onStart: () => void;
  /** "Explore Decision Worlds" — ride the elevator to Level 2. */
  onExploreWorlds: () => void;
}) {
  const t = useT();
  return (
    <>
      <div className="vk-act-net" aria-hidden="true">
        <div className="vk-mkt-scene">
          <div className="vk-sc-ev">
            <div className="vk-ev-words">
              {WORD_KEYS.map((key, index) => (
                <span
                  key={key}
                  className="vk-ev-w"
                  style={{ '--i': index } as React.CSSProperties}
                >
                  {t(key)}
                </span>
              ))}
            </div>
            <b className="vk-ev-dec">{t('idle.decide')}</b>
            <div className="vk-ev-sig">{t('idle.tagline')}</div>
          </div>
        </div>
      </div>

      <div className="vk-act-body">
        <div className="vk-act-idle-cta">
          <button
            type="button"
            className="vk-asst-btn vk-asst-btn-primary"
            onClick={onStart}
          >
            {t('idle.startAny')}
          </button>
          <button
            type="button"
            className="vk-mkt-link"
            onClick={onExploreWorlds}
          >
            {t('home.exploreWorlds')}
          </button>
        </div>
      </div>
    </>
  );
}
