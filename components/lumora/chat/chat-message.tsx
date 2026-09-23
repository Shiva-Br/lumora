'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { LogoMark } from '@/components/lumora/logo';
import { useT } from '@/lib/i18n/provider';
import { cn } from '@/lib/utils';

export function AssistantAvatar() {
  return (
    <span className="inline-flex h-[34px] w-[34px] flex-none items-center justify-center overflow-hidden rounded-full border border-[var(--vk-border)] bg-[var(--vk-surface-2)]">
      <LogoMark size={26} className="vk-mascot-float" />
    </span>
  );
}

export function MicroMark({
  size = 13,
  spinning = false,
  className,
}: {
  size?: number;
  spinning?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid flex-none place-items-center leading-none',
        spinning && 'vk-mark-spin',
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 200 200" style={{ width: size, height: size }}>
        <circle
          cx="100"
          cy="100"
          r="66"
          fill="none"
          stroke="#28765c"
          strokeWidth="1"
          opacity=".26"
        />
        <circle
          cx="100"
          cy="100"
          r="48"
          fill="none"
          stroke="#28765c"
          strokeWidth="1.3"
          opacity=".4"
        />
        <polygon points="100,10 105,86 100,102 95,86" fill="#28765c" />
        <polygon points="100,190 95,114 100,98 105,114" fill="#28765c" />
        <polygon points="190,100 114,105 98,100 114,95" fill="#28765c" />
        <polygon points="10,100 86,95 102,100 86,105" fill="#28765c" />
        <polygon
          points="139,139 104,107 96,96 107,104"
          fill="#28765c"
          opacity=".85"
        />
        <polygon
          points="61,139 93,104 104,96 96,107"
          fill="#28765c"
          opacity=".85"
        />
        <polygon
          points="61,61 96,93 104,104 93,96"
          fill="#28765c"
          opacity=".85"
        />
        <polygon
          points="139,61 107,96 96,104 104,93"
          fill="#28765c"
          opacity=".85"
        />
        <circle cx="100" cy="100" r="6" fill="#28765c" />
        <circle cx="100" cy="100" r="2.3" fill="#fff" />
      </svg>
    </span>
  );
}

export function UserBubble({
  children,
}: {
  initial?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="vk-anim-in-user mb-[26px] flex justify-end">
      <div
        dir="auto"

        className="bg-[rgba(249, 248, 242, 0.7)] max-w-[62%] rounded-[15px] rounded-br-[4px] border border-[rgba(242,193,78,0.28)] px-3.5 py-2.5 text-[14.5px] leading-[1.55] break-words text-[#f2ede1]"
      >
        {children}
      </div>
    </div>
  );
}

export function CardBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('vk-anim-in-up mb-[26px]', className)}>{children}</div>
  );
}

/** The "✦ LUMORA" eyebrow above every assistant block (design `cv-vikhead`).
    The micro-mark spins while LUMORA is thinking. */
export function LumoraEyebrow({ thinking = false }: { thinking?: boolean }) {
  return (
    <div className="mb-[5px] flex items-center gap-[7px]">
      <MicroMark
        spinning={thinking}
        className="[filter:drop-shadow(0_0_5px_rgba(242,193,78,0.35))]"
      />
      <span className="text-[11px] tracking-[0.14em] text-[var(--vk-text-muted)] uppercase">
        LUMORA
      </span>
    </div>
  );
}

/**
 * The reveal-on-hover action row under an assistant reply (design
 * `cv-actions`): Copy is client-side; Regenerate only where the backend can
 * re-run (the last reply); Save stays visible but inert until the backend
 * supports it.
 */
export function AssistantActions({
  text,
  onRegenerate,
}: {
  /** The prose to copy. */
  text: string;
  /** Present only on the reply the backend can regenerate (the last one). */
  onRegenerate?: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = React.useState(false);
  const buttonClass =
    'cursor-pointer rounded-[7px] border-0 bg-transparent px-2 py-0.5 text-[11.5px] text-[var(--vk-text-muted)] transition-colors hover:bg-[rgba(150,178,205,0.07)] hover:text-[var(--vk-text)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--vk-accent-ring)]';
  return (
    <div className="vk-msg-actions">
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
        className={buttonClass}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      {onRegenerate && (
        <button type="button" onClick={onRegenerate} className={buttonClass}>
          Regenerate
        </button>
      )}
      {/* TODO(backend): saving a reply needs a persistence endpoint. */}
      <button
        type="button"
        disabled
        title={t('chat.saveSoon')}
        className={cn(buttonClass, 'cursor-not-allowed opacity-60')}
      >
        Save
      </button>
    </div>
  );
}

export function AssistantBlock({
  children,
  bubble = true,
  wide = false,
  thinking = false,
  actions,
  className,
}: {
  children: React.ReactNode;
  /** Prose flows in the calm-timeline measure; cards opt out. */
  bubble?: boolean;
  /** Let rich cards use the full column. */
  wide?: boolean;
  /** Spins the eyebrow mark while LUMORA works on this block. */
  thinking?: boolean;
  /** Hover-revealed action row (design `cv-actions`). */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'vk-anim-in-up vk-vik-block mb-[26px] flex items-start gap-3',
        className
      )}
    >
      {/* The gold accent rail (design `cv-accent`). */}
      <span
        aria-hidden="true"
        className="mt-0.5 w-[2px] flex-none self-stretch rounded-[2px] bg-linear-[180deg,var(--vk-gold),rgba(242,193,78,0.05)]"
      />
      {/* Relative, so the action row can sit in the block's bottom margin. */}
      <div className="relative min-w-0 flex-1">
        <LumoraEyebrow thinking={thinking} />
        {bubble ? (
          <div
            dir="auto"
            className={cn(
              'text-[15px] leading-[1.72] text-[#243b32]',
              !wide && 'max-w-[740px]'
            )}
          >
            {children}
          </div>
        ) : (
          children
        )}
        {actions}
      </div>
    </div>
  );
}

/**
 * Assistant prose. The backend's replies are markdown (bold labels, lists,
 * the occasional table), so they are rendered as such — safely: react-markdown
 * escapes raw HTML by default, and links open in a new tab with no opener.
 * `remark-breaks` keeps single newlines as line breaks, matching how the
 * assistant lays out question options. Typography lives in `.vk-md`
 * (globals.css) on the design tokens.
 */
export function AssistantProse({ text }: { text: string }) {
  return (
    <div className="vk-md min-w-0 text-[15px] leading-[1.6] break-words text-[var(--vk-text-subtle)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
