'use client';

import * as React from 'react';

import { useT } from '@/lib/i18n/provider';
import { useCountUp, useReducedMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface JourneyCounts {
  scanned?: number;
  finalists?: number;
  marketplaces?: number;
}

interface AnalysisJourneyProps {
  /** Named progress types seen so far, in arrival order. */
  types: readonly string[];
  counts: JourneyCounts;
  running: boolean;
  failed: boolean;
  errorText?: string | null;
  /** A reloaded thread with the result payload present: everything is done. */
  completed: boolean;

  showFinal: boolean;
}

/** The LUMORA compass mark, from the design (`.cv-mark` / `.proc-logo`). */
function CompassMark({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <circle
        cx="100"
        cy="100"
        r="66"
        fill="none"
        stroke="#28765c"
        strokeWidth="6"
        opacity=".26"
      />
      <circle
        cx="100"
        cy="100"
        r="48"
        fill="none"
        stroke="#28765c"
        strokeWidth="8"
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
  );
}

const N = (v: number) => v.toLocaleString('en-US');

export function AnalysisJourney({
  types,
  counts,
  running,
  failed,
  errorText,
  completed,
  showFinal,
}: AnalysisJourneyProps) {
  const t = useT();
  const reduced = useReducedMotion();
  const has = (type: string) => completed || types.includes(type);

  const { scanned, finalists, marketplaces } = counts;
  // The design counts the figures up as they land ("Searching 4,309 relevant
  // products…"). A completed/reloaded journey — and reduced motion — render
  // the settled numbers directly.
  const animate = !completed && !reduced;
  const scannedUp = useCountUp(scanned ?? 0, animate && Boolean(scanned), 1200);
  const marketsUp = useCountUp(
    marketplaces ?? 0,
    animate && Boolean(marketplaces),
    900
  );
  const scannedShown = animate ? scannedUp : (scanned ?? 0);
  const marketsShown = animate ? marketsUp : (marketplaces ?? 0);
  const steps: { done: boolean; label: string }[] = [
    {
      done: has('profile_ready'),
      label: t('journey.profile'),
    },
    {
      done: has('candidates_ready'),
      label: scanned
        ? t('journey.search', { n: N(scannedShown) })
        : t('journey.searchPending'),
    },
    {
      done: has('candidates_ready'),
      label:
        scanned && finalists
          ? t('journey.narrow', { n: N(scanned), m: finalists })
          : t('journey.narrowPending'),
    },
    {
      done: has('results_ready'),
      label: finalists
        ? t('journey.compare', { m: finalists })
        : t('journey.comparePending'),
    },
    {
      done: has('marketplace_ready'),
      label: marketplaces
        ? t('journey.market', { k: N(marketsShown) })
        : t('journey.marketPending'),
    },
  ];
  const activeIndex = running || failed ? steps.findIndex((s) => !s.done) : -1;

  return (
    <div dir="auto" className="max-w-[664px]">
      {/* The design's LUMORA voice head. */}
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] tracking-[0.14em] text-[var(--vk-text-muted)] uppercase">
        <CompassMark className="h-3.5 w-3.5" />
        LUMORA
      </div>

      <div
        role="status"
        aria-live="polite"
        className="relative ml-[7px] border-l border-[rgba(242,193,78,0.22)] pb-0.5"
      >
        {steps.map((step, index) => {
          const active = index === activeIndex;
          const stepFailed = failed && active;
          return (
            <div
              key={index}
              className="vk-j-step relative flex items-start gap-3 py-[7px] pl-4"
              // The design builds the list and lets the rows rise one after
              // another; each one waits its turn.
              style={{ animationDelay: `${index * 110}ms` }}
            >
              <span
                aria-hidden="true"
                className="absolute top-[11px] -left-[8px] grid h-4 w-4 place-items-center"
              >
                {active ? (
                  <CompassMark
                    className="h-4 w-4"

                    style={
                      stepFailed || reduced
                        ? undefined
                        : { animation: 'vk-spin 2.6s linear infinite' }
                    }
                  />
                ) : (
                  <span
                    // Keyed by state so the fill animation replays exactly
                    // once — at the moment the step completes.
                    key={step.done ? 'done' : 'pending'}
                    className={cn(
                      'h-[9px] w-[9px] rounded-full border transition-colors duration-500',
                      step.done
                        ? 'vk-j-dot-done border-transparent bg-[var(--vk-gold)] shadow-[0_0_8px_rgba(242,193,78,0.55)]'
                        : 'border-[rgba(150,178,205,0.35)] bg-transparent'
                    )}
                  />
                )}
              </span>
              <div className="min-w-0">
                <div
                  className={cn(
                    'text-[14.5px] leading-[1.55] transition-[color,opacity] duration-500',
                    step.done
                      ? 'text-[var(--vk-text-subtle)]'
                      : active
                        ? 'text-[var(--vk-text-strong)]'
                        : 'text-[var(--vk-text-muted)] opacity-70'
                  )}
                >
                  {step.label}
                </div>
                {stepFailed ? (
                  <div className="mt-1 text-[12.5px] leading-[1.5] text-[#e08f8f]">
                    {errorText || t('journey.failed')}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {showFinal ? (
        <div className="vk-j-final mt-2 pl-4 text-[14.5px] font-semibold text-[var(--vk-gold-soft)]">
          {t('journey.ready')}
        </div>
      ) : null}
    </div>
  );
}
