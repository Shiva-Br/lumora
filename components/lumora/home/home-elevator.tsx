'use client';

import * as React from 'react';

export type HomeLevel = 1 | 2;
export type GoLevel = (level: HomeLevel) => void;

const RIDE_MS = 940;
const RIDE_MS_REDUCED = 60;

export function rideDuration(): number {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? RIDE_MS_REDUCED
    : RIDE_MS;
}

function typing(): boolean {
  const active = document.activeElement;
  return Boolean(
    active &&
    (/^(INPUT|TEXTAREA)$/.test(active.tagName) ||
      (active as HTMLElement).isContentEditable)
  );
}

/**
 * An open dialog (login, delete/rename) or menu owns the keyboard and the
 * scroll — the elevator must not move underneath it.
 */
export function overlayOpen(): boolean {
  return Boolean(
    document.querySelector('[data-slot="dialog-content"], [role="menu"]')
  );
}

export function useHomeElevator(): {
  level: HomeLevel;
  goLevel: GoLevel;
  /** The ride in progress — wheel/keys are ignored while true. */
  isLocked: () => boolean;
} {
  const [level, setLevel] = React.useState<HomeLevel>(1);
  const levelRef = React.useRef<HomeLevel>(1);
  const lockRef = React.useRef(false);

  const goLevel = React.useCallback<GoLevel>((next) => {
    if (lockRef.current || next === levelRef.current) return;
    lockRef.current = true;
    levelRef.current = next;
    setLevel(next);
    setTimeout(() => {
      lockRef.current = false;
    }, rideDuration());
  }, []);

  const isLocked = React.useCallback(() => lockRef.current, []);

  return { level, goLevel, isLocked };
}

export function HomeElevator({
  level,
  goLevel,
  isLocked,
  levelOne,
  levelTwo,
}: {
  level: HomeLevel;
  goLevel: GoLevel;
  isLocked: () => boolean;
  levelOne: React.ReactNode;
  levelTwo: React.ReactNode;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const levelOneRef = React.useRef<HTMLElement>(null);
  const levelTwoRef = React.useRef<HTMLElement>(null);
  const levelRef = React.useRef<HomeLevel>(level);
  // Compared, not a boolean "mounted" flag: a ref survives StrictMode's
  // mount→cleanup→mount cycle, and a flag would mistake the second pass for
  // an arrival and steal focus on page load.
  const prevLevelRef = React.useRef<HomeLevel>(level);

  // Arriving at a level: reset Level 2's scroll, and once the car stops,
  // hand focus to the opposite elevator control.
  React.useEffect(() => {
    levelRef.current = level;
    if (prevLevelRef.current === level) return;
    prevLevelRef.current = level;
    if (level === 2 && levelTwoRef.current) levelTwoRef.current.scrollTop = 0;
    const id = setTimeout(() => {
      const target = rootRef.current?.querySelector<HTMLElement>(
        level === 2 ? '[data-elev-focus="up"]' : '[data-elev-focus="down"]'
      );
      target?.focus({ preventScroll: true });
    }, rideDuration());
    return () => clearTimeout(id);
  }, [level]);

  // Wheel past the edge of the active level rides the elevator. A native
  // non-passive listener: React registers wheel passively, and crossing
  // levels must preventDefault the scroll that triggered it.
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onWheel = (event: WheelEvent) => {
      if (isLocked() || typing() || overlayOpen()) return;
      const current = levelRef.current;
      const active = current === 1 ? levelOneRef.current : levelTwoRef.current;
      if (!active) return;
      const atBottom =
        active.scrollTop + active.clientHeight >= active.scrollHeight - 4;
      const atTop = active.scrollTop <= 2;
      if (current === 1 && event.deltaY > 8 && atBottom) {
        event.preventDefault();
        goLevel(2);
      } else if (current === 2 && event.deltaY < -8 && atTop) {
        event.preventDefault();
        goLevel(1);
      }
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [goLevel, isLocked]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isLocked() || typing() || overlayOpen()) return;
      if (event.key === 'PageDown' && levelRef.current === 1) {
        event.preventDefault();
        goLevel(2);
      } else if (event.key === 'PageUp' && levelRef.current === 2) {
        event.preventDefault();
        goLevel(1);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [goLevel, isLocked]);

  return (
    <div ref={rootRef} className="vk-home-elevator" data-level={level}>
      <section
        ref={levelOneRef}
        className="vk-app-level vk-home-level"
        aria-hidden={level !== 1}
        inert={level !== 1}
      >
        {levelOne}
      </section>
      <section
        ref={levelTwoRef}
        className="vk-app-level vk-home-level vk-home-level-2"
        aria-hidden={level !== 2}
        inert={level !== 2}
      >
        {levelTwo}
      </section>
    </div>
  );
}
