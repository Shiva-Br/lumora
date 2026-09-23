'use client';

// The effective motion preference: the account's override, or the OS.
//
// Three states, and the difference is the whole point (backend v0.22.0):
//
//   null   no preference expressed — follow the operating system
//   true   reduced motion regardless of what the OS says
//   false  full motion regardless of what the OS says
//
// The `false` case is the one that is easy to get wrong. A person whose OS
// reports "reduce motion" but who explicitly asks for animations must get them;
// ignoring that would be a setting that lies about what it does. That is why the
// CSS media blocks are guarded by :root:not([data-motion='full']) rather than
// left to win unconditionally.
import * as React from 'react';

import { getPreferences, updatePreferences } from '@/lib/api/preferences';
import { useReducedMotion } from '@/lib/motion';

type MotionAttr = 'reduced' | 'full' | null;

type MotionContextValue = {
  /** The account's override: null means "follow the OS". */
  override: boolean | null;
  /** What is actually in effect right now, override and OS combined. */
  reduced: boolean;
  /** Persists to the account. Optimistic, like language. */
  setOverride: (next: boolean | null) => void;
};

const MotionContext = React.createContext<MotionContextValue | null>(null);

function attrFor(override: boolean | null): MotionAttr {
  if (override === true) return 'reduced';
  if (override === false) return 'full';
  return null;
}

export function MotionPreferenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const osReduced = useReducedMotion();
  const [override, setOverrideState] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void getPreferences().then((prefs) => {
      if (!cancelled) setOverrideState(prefs.reducedMotionOverride);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The attribute drives CSS; the boolean drives JS and canvas work. Both must
  // agree, so they are derived from the same place.
  React.useEffect(() => {
    const root = document.documentElement;
    const attr = attrFor(override);
    if (attr) root.setAttribute('data-motion', attr);
    else root.removeAttribute('data-motion');
  }, [override]);

  const setOverride = React.useCallback((next: boolean | null) => {
    setOverrideState(next);
    void updatePreferences({ reducedMotionOverride: next });
  }, []);

  const value = React.useMemo<MotionContextValue>(
    () => ({
      override,
      reduced: override ?? osReduced,
      setOverride,
    }),
    [override, osReduced, setOverride]
  );

  return (
    <MotionContext.Provider value={value}>{children}</MotionContext.Provider>
  );
}

/**
 * The effective preference, for JS and canvas animation.
 *
 * Falls back to the OS reading outside a provider rather than throwing: motion
 * is decoration, and a subtree rendered without the provider should still
 * respect the operating system rather than crash. That is the opposite call
 * from useLocale, and deliberately so — a missing translation is a visible
 * defect, a missing motion override is not.
 */
export function useMotionPreference(): MotionContextValue {
  const ctx = React.useContext(MotionContext);
  const osReduced = useReducedMotion();
  return (
    ctx ?? {
      override: null,
      reduced: osReduced,
      setOverride: () => {},
    }
  );
}
