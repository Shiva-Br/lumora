'use client';

import { ArrowUp, Mic, Paperclip } from 'lucide-react';
import * as React from 'react';

import { useT } from '@/lib/i18n/provider';
import { cn } from '@/lib/utils';

export function Composer({
  value,
  onValueChange,
  onSubmit,
  busy = false,
  allowEmpty = false,
  placeholder = 'Ask Lumora anything...',
  leading,
  onStop,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (message: string) => void;
  /** Session is loading, or a submission is in flight. */
  busy?: boolean;
  /** Allow submitting with no text — e.g. answers picked as chips. */
  allowEmpty?: boolean;
  placeholder?: string;
  /**
   * Rendered inside the field, before the text — e.g. the selected answer
   * chips on the chat screen, tag-input style. The field wraps and grows
   * when it takes up room.
   */
  leading?: React.ReactNode;

  onStop?: () => void;
}) {
  const t = useT();
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const hasText = value.trim().length > 0;
  const canSubmit = (hasText || allowEmpty) && !busy;

  React.useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = '26px';

    field.style.height = `${Math.min(field.scrollHeight, 150)}px`;
  }, [value, leading]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit(value.trim());
  };

  return (
    <form
      onSubmit={handleSubmit}
      // Home's `.gc-field` shell at the compact scale both composers share:
      // gradient glass, 16px radius, 8/8/8/14 padding, 8px gap, 14px blur.
      className={cn(
        'bg-linear-[180deg,rgba(249, 248, 242, 0.78),rgba(249, 248, 242, 0.8)] flex w-full items-center gap-2 rounded-[16px] border py-2 pr-2 pl-3.5 backdrop-blur-[14px] transition-[border-color,box-shadow] duration-[450ms] ease-[ease]',
        focused
          ? 'shadow-[0_26px_80px_-30px_rgba(249, 248, 242, 0.95),0_0_0_4px_rgba(232,137,46,0.07)] border-[rgba(232,137,46,0.42)]'
          : 'shadow-[0_26px_70px_-32px_rgba(249, 248, 242, 0.92),inset_0_1px_0_rgba(255,255,255,0.03)] border-[rgba(150,178,205,0.14)]'
      )}
    >
      <button
        type="button"
        disabled
        tabIndex={-1}
        aria-label={t('home.voice')}
        className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-[10px] border border-[rgba(150,178,205,0.12)] bg-[rgba(255,255,255,0.02)] text-[#5b6d63] opacity-100"
      >
        <Mic size={16} strokeWidth={1.7} aria-hidden="true" />
      </button>

      {/* Clicks on the field's empty space land here and focus the text
          input, like a plain input would — including after removing a chip. */}
      <div
        className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
        onClick={() => inputRef.current?.focus()}
      >
        {leading}
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (!canSubmit) return;
              onSubmit(value.trim());
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // Text-level direction only: an RTL sentence aligns itself without
          // moving the field's buttons or flipping the shell.
          dir="auto"
          aria-label={t('composer.ask')}
          placeholder={placeholder}
          className={cn(
            'min-h-[26px] min-w-0 flex-1 resize-none border-none bg-transparent text-[16.5px] leading-[26px] text-[#243b32] outline-none placeholder:text-[14px] placeholder:text-[#5b6d63]',
            // With chips in the field, the input takes a full row below them
            // so the placeholder never gets clipped beside the chips.
            leading != null && 'basis-full'
          )}
        />
      </div>

      <div className="flex items-center gap-2">
        {/* One attachment entry point for files and images alike. */}
        <button
          type="button"
          disabled
          tabIndex={-1}
          aria-label={t('home.attach')}
          className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-[10px] border border-[rgba(150,178,205,0.12)] bg-[rgba(255,255,255,0.02)] text-[#5b6d63] opacity-100"
        >
          <Paperclip size={16} strokeWidth={1.7} aria-hidden="true" />
        </button>

        {onStop ? (
          <button
            type="button"
            aria-label="Stop"
            onClick={onStop}
            className={cn(
              'inline-flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-[11px] border-0 bg-linear-[150deg,#348568,#28765c] text-[var(--vk-on-accent)] outline-none',
              'shadow-[0_10px_26px_-8px_rgba(232,137,46,0.5)]',
              'transition-[transform,box-shadow] duration-[250ms] ease-[ease]',
              'hover:-translate-y-px hover:scale-[1.03] hover:shadow-[0_14px_32px_-8px_rgba(232,137,46,0.62)]',
              'focus-visible:shadow-[0_0_0_3px_var(--vk-accent-ring)]'
            )}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="currentColor"
              aria-hidden="true"
            >
              <rect x="7" y="7" width="10" height="10" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            aria-label="Send"
            disabled={!canSubmit}
            aria-busy={busy}
            className={cn(
              'inline-flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-[11px] border-0 bg-linear-[150deg,#348568,#28765c] text-[var(--vk-on-accent)] outline-none',
              'shadow-[0_10px_26px_-8px_rgba(232,137,46,0.5)]',
              'transition-[transform,box-shadow,opacity] duration-[250ms] ease-[ease]',
              'hover:-translate-y-px hover:scale-[1.03] hover:shadow-[0_14px_32px_-8px_rgba(232,137,46,0.62)]',
              'disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:scale-100',
              canSubmit ? 'opacity-100' : 'opacity-[0.9]'
            )}
          >
            <ArrowUp size={17} strokeWidth={2.2} aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  );
}
