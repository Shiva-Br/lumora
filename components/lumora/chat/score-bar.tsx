import { cn } from '@/lib/utils';

export function ScoreBar({
  fraction,
  tone = 'accent',
  className,
  delayMs,
  dim = false,
}: {
  /** 0..1 fill. Values outside the range are clamped, never invented. */
  fraction: number;
  tone?: 'accent' | 'success';
  className?: string;
  /** Stagger for the grow-in animation. */
  delayMs?: number;
  /** Non-best values in a comparison render with a faded fill. */
  dim?: boolean;
}) {
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <div
      aria-hidden="true"
      className={cn(
        'h-1.5 min-w-[34px] flex-1 overflow-hidden rounded-full bg-[rgba(150,178,205,0.12)]',
        className
      )}
    >
      <div
        className={cn(
          'vk-anim-bar h-full rounded-full',
          tone === 'success'
            ? 'bg-[var(--vk-success)]'
            : 'bg-[var(--vk-accent)]',
          dim && 'opacity-[0.72]'
        )}
        style={{
          width: `${clamped * 100}%`,
          ...(delayMs !== undefined ? { animationDelay: `${delayMs}ms` } : {}),
        }}
      />
    </div>
  );
}
