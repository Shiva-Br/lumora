'use client';

import * as React from 'react';

import { useT } from '@/lib/i18n/provider';
import type { WorldContext } from '@/lib/taxonomy/resolve';
import { WORLD_ICONS } from '@/lib/taxonomy/world-icons';

export function intentPhrase(prompt: string): string {
  let s = prompt
    .trim()
    .replace(
      /^(please\s+)?(help me|i want to|i'?d like to|can you help me|i need to|i'?m|i am)\s+/i,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > 64) s = s.slice(0, 61) + '…';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function PhaseViz({ accent }: { accent: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, box.width * dpr);
    canvas.height = Math.max(1, box.height * dpr);
    // The design appends 'cc'/'66' alpha suffixes — only #rrggbb can take
    // them; anything else falls back to the gold the arc already uses.
    const tone = /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#28765c';
    const nodes = Array.from({ length: 7 }, () => ({
      a: Math.random() * 6.28,
      r: 8 + Math.random() * 15,
      s: 0.2 + Math.random() * 0.5,
      ph: Math.random() * 6.28,
    }));
    let t = 0;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      t += 0.016;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(242,193,78,.5)';
      ctx.lineWidth = 1.3 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(w, h) * 0.32, t * 0.5, t * 0.5 + 2.4);
      ctx.stroke();
      for (const n of nodes) {
        const x = cx + Math.cos(n.a + t * n.s) * n.r * dpr * 1.4;
        const y = cy + Math.sin(n.a + t * n.s) * n.r * dpr;
        const pulse = 0.5 + 0.5 * Math.sin(t * 2 + n.ph);
        ctx.fillStyle = tone + (pulse > 0.6 ? 'cc' : '66');
        ctx.beginPath();
        ctx.arc(x, y, (1.1 + pulse * 1.4) * dpr, 0, 6.28);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(242,193,78,.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2 * dpr, 0, 6.28);
      ctx.fill();
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [accent]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    />
  );
}

export function WorldHeader({
  context,
  prompt,
  onReturn,
}: {
  context: WorldContext;
  /** The user's first message — becomes the intent subtitle. */
  prompt?: string;
  /** Back to the General Conversation surface. */
  onReturn: () => void;
}) {
  const t = useT();
  const { world, category, sub } = context;
  const subtitle = prompt ? intentPhrase(prompt) : world.description;

  return (
    <div className="vk-anim-in-up flex min-w-0 flex-1 items-center gap-3.5">
      {/* The `cv-phase` tile: gold radial wash, the orbit viz, the emblem. */}
      <span
        aria-hidden="true"
        className="bg-[radial-gradient(120%_120%_at_30%_20%,rgba(242,193,78,0.12),rgba(249, 248, 242, 0.4))] relative grid h-[54px] w-[54px] flex-none place-items-center overflow-hidden rounded-[14px] border border-[rgba(150,178,205,0.16)]"
      >
        <PhaseViz accent={world.tone} />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#28765c"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="relative h-[25px] w-[25px]"
          dangerouslySetInnerHTML={{ __html: WORLD_ICONS[world.id] ?? '' }}
        />
      </span>

      <div className="min-w-0">
        <div className="truncate text-[15px] leading-[1.2] font-semibold text-[var(--vk-text-strong)]">
          {world.name}
        </div>
        {category && (
          <div className="mt-0.5 truncate text-[11.5px] tracking-[0.02em] text-[var(--vk-text-muted)]">
            <b className="font-semibold text-[var(--vk-gold-soft)]">
              {category}
            </b>
            {sub ? <> › {sub}</> : null}
          </div>
        )}
        <div
          dir="auto"
          className="mt-0.5 truncate text-[12.5px] text-[var(--vk-note)]"
        >
          {subtitle}
        </div>
      </div>

      <button
        type="button"
        onClick={onReturn}
        className="ml-auto inline-flex min-h-10 flex-none cursor-pointer items-center gap-1.5 rounded-[9px] border border-[rgba(150,178,205,0.14)] bg-transparent px-3 py-2 text-[12.5px] text-[var(--vk-text-muted)] transition-colors hover:border-[rgba(150,178,205,0.28)] hover:bg-[rgba(150,178,205,0.06)] hover:text-[var(--vk-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            d="M15 6l-6 6 6 6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="max-sm:hidden">{t('chat.returnGeneral')}</span>
      </button>
    </div>
  );
}
