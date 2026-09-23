'use client';

// Settings — the surface that makes the account preferences reachable.
//
// The language and motion preferences have existed on the account since backend
// v0.22.0 and in the app since the locale layer landed, but there was no way for
// a person to change either. A Persian user could not choose Persian. This is
// that control.
//
// Deliberately small. It exposes exactly the two settings that are real and
// working; a panel padded out with disabled rows for things that do not exist
// teaches people the product is broken.
import * as React from 'react';
import { createPortal } from 'react-dom';

import type { AcceptedLocale } from '@/lib/i18n';
import { useLocale } from '@/lib/i18n/provider';
import { useMotionPreference } from '@/lib/motion-preference';

const LANGUAGES: {
  id: AcceptedLocale;
  key: 'lang.en' | 'lang.fa' | 'lang.ar';
}[] = [
  { id: 'en', key: 'lang.en' },
  { id: 'fa', key: 'lang.fa' },
  { id: 'ar', key: 'lang.ar' },
];

type MotionChoice = 'system' | 'reduced' | 'full';

function choiceOf(override: boolean | null): MotionChoice {
  if (override === true) return 'reduced';
  if (override === false) return 'full';
  return 'system';
}

function overrideOf(choice: MotionChoice): boolean | null {
  if (choice === 'reduced') return true;
  if (choice === 'full') return false;
  return null;
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { t, locale, setLocale } = useLocale();
  // Portalled to <body>: the sidebar that opens this clips its overflow, and a
  // fixed element still gets trapped by any ancestor carrying a transform or
  // filter. Rendering outside that subtree removes the whole class of problem
  // rather than betting on which ancestors stay transform-free.
  const { override, setOverride } = useMotionPreference();
  const ref = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  // Escape closes, and focus returns where it came from — a dialog that strands
  // keyboard focus behind it is worse than no dialog.
  React.useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    ref.current
      ?.querySelector<HTMLElement>('button, [href], select, input')
      ?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  const motion = choiceOf(override);

  // Only ever rendered in response to a click, so the document exists by then.
  // The guard is for the SSR pass, not for a mount race — which is why it reads
  // the environment rather than tracking state in an effect.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="vk-set-scrim" onMouseDown={onClose}>
      <div
        ref={ref}
        className="vk-set-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="vk-set-head">
          <h2 id={titleId}>{t('set.title')}</h2>
          <button
            type="button"
            className="vk-set-x"
            aria-label={t('set.close')}
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <section className="vk-set-section">
          <h3>{t('set.appearance')}</h3>

          <fieldset className="vk-set-field">
            <legend>{t('set.langLabel')}</legend>
            <p className="vk-set-help">{t('set.langHelp')}</p>
            <div
              className="vk-set-choices"
              role="radiogroup"
              aria-label={t('set.langLabel')}
            >
              {LANGUAGES.map(({ id, key }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={locale === id}
                  className="vk-set-choice"
                  data-on={locale === id || undefined}
                  onClick={() => setLocale(id)}
                >
                  {t(key)}
                </button>
              ))}
            </div>
            {/* Said plainly rather than hidden: Arabic lays out RTL but the
                interface text is still English. */}
            {locale === 'ar' && (
              <p className="vk-set-note">{t('lang.arNote')}</p>
            )}
          </fieldset>

          <fieldset className="vk-set-field">
            <legend>{t('set.motionLabel')}</legend>
            <p className="vk-set-help">{t('set.motionHelp')}</p>
            <div
              className="vk-set-choices"
              role="radiogroup"
              aria-label={t('set.motionLabel')}
            >
              {(
                [
                  ['system', 'set.motionSystem'],
                  ['reduced', 'set.motionReduced'],
                  ['full', 'set.motionFull'],
                ] as const
              ).map(([choice, key]) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={motion === choice}
                  className="vk-set-choice"
                  data-on={motion === choice || undefined}
                  onClick={() => setOverride(overrideOf(choice))}
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </fieldset>
        </section>
      </div>
    </div>,
    document.body
  );
}
