'use client';

import * as React from 'react';

import { useT } from '@/lib/i18n/provider';

// Keys, not copy: this is module scope where a hook cannot run, and the
// rotating examples are the first words a new user reads.
const EXAMPLE_KEYS = [
  'examples.unsure',
  'examples.laptop',
  'examples.career',
  'examples.live',
  'examples.dentist',
  'examples.fitness',
  'examples.business',
  'home.describePlaceholder',
] as const;

export function GeneralConversation({
  value,
  onValueChange,
  onSubmit,
  busy = false,
  onExploreWorlds,
  inputRef,
  notices,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  /** Ride the elevator down to the Decision Worlds level. */
  onExploreWorlds: () => void;
  /** Exposes the field so Level 2's "Start a Decision" can focus it. */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** Resume/error status line, rendered where the design parks attachments. */
  notices?: React.ReactNode;
}) {
  const t = useT();
  const ownRef = React.useRef<HTMLTextAreaElement>(null);
  const rotRef = React.useRef<HTMLSpanElement>(null);
  const indexRef = React.useRef(EXAMPLE_KEYS.length - 1);
  const valueRef = React.useRef(value);

  const setInput = (el: HTMLTextAreaElement | null) => {
    ownRef.current = el;
    if (inputRef) inputRef.current = el;
  };

  React.useEffect(() => {
    valueRef.current = value;
    const rot = rotRef.current;
    if (rot) rot.style.opacity = value ? '0' : '1';
    const field = ownRef.current;
    if (field) {
      field.style.height = '26px';
      field.style.height = `${Math.min(field.scrollHeight, 104)}px`;
    }
  }, [value]);

  React.useEffect(() => {
    const id = setInterval(() => {
      const rot = rotRef.current;
      if (!rot) return;
      if (document.activeElement === ownRef.current || valueRef.current) return;
      indexRef.current = (indexRef.current + 1) % EXAMPLE_KEYS.length;
      const next = t(EXAMPLE_KEYS[indexRef.current]!);
      rot.style.opacity = '0';
      rot.style.transform = 'translateY(-8px)';
      setTimeout(() => {
        rot.textContent = next;
        rot.style.transform = 'translateY(8px)';
        requestAnimationFrame(() => {
          rot.style.opacity = valueRef.current ? '0' : '1';
          rot.style.transform = 'none';
        });
      }, 450);
    }, 3600);
    return () => clearInterval(id);
  }, [t]);

  const submit = () => {
    if (!busy && value.trim()) onSubmit();
  };

  return (
    <section className="vk-genconv">
      <h2 className="vk-gc-title">
        What are we <b>deciding</b> today?
      </h2>
      <p className="vk-gc-sub">
        Tell <strong>LUMORA</strong> what you need.
        <br />
        We&rsquo;ll understand your situation and guide you toward the right
        decision.
      </p>

      <div className="vk-gc-action-row">
        <div className="vk-gc-field">
          <button
            type="button"
            className="vk-gc-ic"
            disabled
            title={t('home.voiceSoon')}
            aria-label={t('home.voice')}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M6 11a6 6 0 0 0 12 0M12 17v4" strokeLinecap="round" />
            </svg>
          </button>

          <div className="vk-gc-ph">
            <span ref={rotRef} className="vk-gc-rot" aria-hidden="true">
              {t(EXAMPLE_KEYS[EXAMPLE_KEYS.length - 1]!)}
            </span>
            <textarea
              ref={setInput}
              rows={1}
              autoComplete="off"
              aria-label={t('home.describe')}
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          </div>

          {/* One attachment entry point for files and images alike. */}
          <button
            type="button"
            className="vk-gc-ic"
            disabled
            title={t('home.attachSoon')}
            aria-label={t('home.attach')}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path
                d="M21 11l-8.5 8.5a4 4 0 0 1-6-6L14 5.5a2.7 2.7 0 0 1 4 4l-8.7 8.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            className="vk-gc-send"
            aria-label="Send"
            aria-busy={busy || undefined}
            disabled={busy}
            onClick={submit}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.4"
              aria-hidden="true"
            >
              <path
                d="M12 19V5M6 11l6-6 6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <button
          type="button"
          className="vk-explore-elevator"
          aria-label={t('home.bringWorlds')}
          data-elev-focus="down"
          onClick={onExploreWorlds}
        >
          <span className="vk-explore-label">{t('home.exploreWorlds')}</span>
          <span className="vk-explore-arrow" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.6"
            >
              <path
                d="M12 5v14M6 13l6 6 6-6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </div>

      <div className="vk-gc-notices" aria-live="polite">
        {notices}
      </div>

      <div className="vk-gc-hint">
        LUMORA understands your goal, finds the right intelligence, and opens a
        guided Decision Workspace.
      </div>
    </section>
  );
}
