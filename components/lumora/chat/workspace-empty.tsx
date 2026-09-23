'use client';

// What a workspace tab shows when it has no payload yet.
//
// "No analysis yet" on its own is a dead end: it names the absence and offers
// nothing, so a person who has been waiting cannot tell whether Lumora is
// working, finished and failed, or waiting on them. Every one of those is a
// different next move, and the panel is the only place they could learn it.
//
// So this surface answers WHY it is empty, in the order that matters:
//   running  → the live progress, because something IS happening
//   failed   → what broke, and a retry when the backend says it is retriable
//   runnable → the action that fills the page
//   neither  → the honest "this step has not run yet"
import * as React from 'react';

import type { AnalysisJobState } from '@/lib/conversation/use-analysis-job';
import { useT } from '@/lib/i18n/provider';
import { cn } from '@/lib/utils';

function Shell({ children }: { children: React.ReactNode }) {
  // Anchored to the TOP of the column. Centring the only words on the page
  // inside a full-height panel puts them hundreds of pixels below the tab bar,
  // which reads as an empty panel rather than an empty tab.
  return (
    <div className="rounded-2xl border border-dashed border-[rgba(150,178,205,0.2)] px-6 py-9 text-center sm:px-8">
      {children}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="m-0 text-[15px] font-semibold text-[var(--vk-text-strong)]">
      {children}
    </h3>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-auto mt-1.5 mb-0 max-w-[420px] text-[13px] leading-[1.55] text-[var(--vk-text-muted)]">
      {children}
    </p>
  );
}

export function WorkspaceEmpty({
  title,
  body,
  job,
  onRun,
  canRun = false,
}: {
  /** Why this particular tab is empty. */
  title: string;
  body: string;
  job: AnalysisJobState;
  onRun: () => void;
  /** The decision has progressed far enough that the pipeline can run. */
  canRun?: boolean;
}) {
  const t = useT();

  if (job.phase === 'running') {
    const pct = Math.max(0, Math.min(100, job.progress?.pct ?? 0));
    return (
      <Shell>
        <Title>{t('ws.workingTitle')}</Title>
        <Body>{t('ws.workingBody')}</Body>
        <div className="mx-auto mt-4 max-w-[420px]">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={job.progress?.label ?? t('ws.workingTitle')}
            className="h-[6px] w-full overflow-hidden rounded-[3px] bg-[rgba(150,178,205,0.14)]"
          >
            <span
              className="block h-full rounded-[inherit] bg-linear-[90deg,#348568,#28765c] transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 text-[12px]">
            <span className="font-semibold text-[var(--vk-gold-soft)] tabular-nums">
              {pct}%
            </span>
            {job.progress?.label && (
              <span className="text-[var(--vk-text-subtle)]">
                {job.progress.label}
              </span>
            )}
            {job.progress?.detail && (
              <span className="text-[var(--vk-note-quiet)]">
                · {job.progress.detail}
              </span>
            )}
          </div>
          <p className="mt-2 mb-0 text-[11.5px] text-[var(--vk-note-quiet)]">
            {t('ws.startedAt')}
          </p>
        </div>
      </Shell>
    );
  }

  if (job.phase === 'failed') {
    return (
      <Shell>
        <Title>{t('prod.analysisFailed')}</Title>
        {/* The backend's own words: it knows what broke, and it writes them
            for a person rather than for a log. */}
        <Body>{job.error ?? body}</Body>
        {job.retriable && (
          <RunButton onClick={onRun} label={t('prod.tryAgain')} />
        )}
      </Shell>
    );
  }

  return (
    <Shell>
      <Title>{title}</Title>
      <Body>{body}</Body>
      {canRun && <RunButton onClick={onRun} label={t('ws.runIt')} />}
    </Shell>
  );
}

function RunButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mt-4 inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-[11px] border border-[rgba(232,137,46,0.48)] px-4 text-[13px] font-semibold outline-none',
        'bg-linear-[150deg,#348568,#28765c] text-[var(--vk-on-accent)]',
        'shadow-[0_10px_26px_-8px_rgba(232,137,46,0.5)] transition hover:brightness-[1.04]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)]'
      )}
    >
      <span aria-hidden="true" className="text-[12px] opacity-90">
        ◆
      </span>
      {label}
    </button>
  );
}
