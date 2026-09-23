'use client';

import * as React from 'react';

import { useT } from '@/lib/i18n/provider';
import {
  closeDrawers,
  collapseActivity,
  openActivity,
  toggleSideDrawer,
} from '@/lib/shell/shell-store';
import { useShell } from '@/lib/shell/use-shell';

const SIDEBAR_ID = 'vk-app-sidebar';
const ACTIVITY_ID = 'vk-app-activity';

type AppFrameProps = {
  sidebar: React.ReactNode;

  activity: React.ReactNode;
  /** Center column. */
  children: React.ReactNode;

  activityBusy?: boolean;
  /** 0–1, or null when there is nothing running. */
  activityProgress?: number | null;
  /** The pipeline finished — the rail shows a check instead of a percentage. */
  activityComplete?: boolean;
};

export function AppFrame({
  sidebar,
  activity,
  children,
  activityBusy = false,
  activityProgress = null,
  activityComplete = false,
}: AppFrameProps) {
  const t = useT();
  const {
    sidebarCollapsed,
    activityCollapsed,
    sideDrawerOpen,
    activityDrawerOpen,
    mood,
    layout,
  } = useShell();

  const sideRef = React.useRef<HTMLElement>(null);
  const activityRef = React.useRef<HTMLElement>(null);
  const sideToggleRef = React.useRef<HTMLButtonElement>(null);
  const railRef = React.useRef<HTMLButtonElement>(null);

  const anyDrawerOpen = sideDrawerOpen || activityDrawerOpen;

  // A drawer sits above everything, so Escape closes it before the key
  // reaches whatever is underneath.
  React.useEffect(() => {
    if (!anyDrawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      closeDrawers();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [anyDrawerOpen]);

  // Move focus into a drawer as it opens, and hand it back to the control
  // that opened it on the way out — otherwise focus is left behind the scrim.
  //
  // Both effects compare against a ref rather than acting on every run, so
  // they fire only on a real open/close transition. Without that they also
  // fire on mount, and every screen that renders the frame would steal focus
  // from the document on load.
  const sideDrawerSeen = React.useRef(sideDrawerOpen);
  React.useEffect(() => {
    if (sideDrawerSeen.current === sideDrawerOpen) return;
    sideDrawerSeen.current = sideDrawerOpen;
    if (sideDrawerOpen) sideRef.current?.focus();
    else sideToggleRef.current?.focus({ preventScroll: true });
  }, [sideDrawerOpen]);

  const activityDrawerSeen = React.useRef(activityDrawerOpen);
  React.useEffect(() => {
    if (activityDrawerSeen.current === activityDrawerOpen) return;
    activityDrawerSeen.current = activityDrawerOpen;
    if (activityDrawerOpen) activityRef.current?.focus();
    else railRef.current?.focus({ preventScroll: true });
  }, [activityDrawerOpen]);

  // Off-screen drawers stay in the DOM, so take them out of the tab order and
  // the accessibility tree until they are actually open. Same for a collapsed
  // activity column, which is only faded out.
  const sideInert = layout === 'mobile' && !sideDrawerOpen;
  const activityInert =
    layout === 'desktop' ? activityCollapsed : !activityDrawerOpen;

  const railPercent = activityComplete
    ? '✓'
    : activityProgress === null
      ? ''
      : `${Math.round(activityProgress * 100)}%`;

  return (
    <>
      {/* Background planes: backdrop → starfield → mood wash → vignette.
          All fixed and decorative; they mount and unmount with the frame. */}
      <div className="vk-app-backdrop" aria-hidden="true" />
      <div
        className="vk-moodwash"
        data-on={mood ? '' : undefined}
        style={
          mood ? ({ '--vk-mood': mood } as React.CSSProperties) : undefined
        }
        aria-hidden="true"
      />
      <div className="vk-vignette" aria-hidden="true" />

      <div
        className="vk-app"
        data-side-collapsed={sidebarCollapsed ? '' : undefined}
        data-asst-collapsed={activityCollapsed ? '' : undefined}
        data-side-open={sideDrawerOpen ? '' : undefined}
        data-asst-open={activityDrawerOpen ? '' : undefined}
      >
        <aside
          id={SIDEBAR_ID}
          ref={sideRef}
          className="vk-app-side"
          tabIndex={-1}
          inert={sideInert}
        >
          {sidebar}
        </aside>

        <main className="vk-app-center">{children}</main>

        <aside
          id={ACTIVITY_ID}
          ref={activityRef}
          className="vk-app-activity"
          aria-label={t('activity.live')}
          tabIndex={-1}
          inert={activityInert}
        >
          {activity}
        </aside>

        {/* Fixed chrome. Out of flow, so none of it becomes a grid item. */}
        <div
          className="vk-app-scrim"
          onClick={() => closeDrawers()}
          aria-hidden="true"
        />

        <button
          ref={sideToggleRef}
          type="button"
          className="vk-side-toggle"
          onClick={() => toggleSideDrawer()}
          aria-controls={SIDEBAR_ID}
          aria-expanded={sideDrawerOpen}
          aria-label={sideDrawerOpen ? t('menu.close') : t('menu.open')}
          title={sideDrawerOpen ? t('menu.close') : t('menu.open')}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>

        {/* The rail keeps a closed activity panel recoverable, and keeps
            reporting live state while it is closed. */}
        <button
          ref={railRef}
          type="button"
          className="vk-act-rail"
          data-busy={activityBusy ? '' : undefined}
          onClick={() => openActivity()}
          aria-controls={ACTIVITY_ID}
          aria-expanded={false}
          aria-label={t('activity.openPanel')}
          title={t('activity.open')}
        >
          <svg
            className="vk-rail-ic"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path
              d="M4 13h4l2 5 4-12 2 7h4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="vk-rail-dot" aria-hidden="true" />
          <span className="vk-rail-pct">{railPercent}</span>
          <svg
            className="vk-rail-open"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              d="M15 6l-6 6 6 6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </>
  );
}

/**
 * The activity panel's own collapse control, rendered by whatever fills the
 * region. It lives here because closing the panel is frame behaviour, not
 * panel behaviour: below 1320px the same gesture closes a drawer instead.
 */
export function ActivityCollapseButton() {
  const t = useT();
  return (
    <button
      type="button"
      className="vk-shell-collapse"
      onClick={() => collapseActivity()}
      aria-controls={ACTIVITY_ID}
      aria-label={t('activity.collapsePanel')}
      title={t('activity.collapse')}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
