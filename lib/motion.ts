'use client';

import * as React from 'react';

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeToMotionPreference(onChange: () => void) {
  const mq = window.matchMedia(REDUCE_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/**
 * Tracks the OS "reduce motion" setting, and keeps tracking it if the user
 * flips it mid-session. Server-renders as `false` (full motion) and corrects
 * on hydration, so markup stays stable.
 */
export function useReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(REDUCE_QUERY).matches,
    () => false
  );
}

export function useCountUp(target: number, enabled: boolean, duration = 1000) {
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) return;

    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / duration);
      // setState inside rAF is async w.r.t. the effect body, so this stays
      // clear of the compiler's set-state-in-effect rule.
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [target, enabled, duration]);

  return value;
}
