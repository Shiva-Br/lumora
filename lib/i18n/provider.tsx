'use client';

// The locale seam for client components.
//
// Language is an ACCOUNT preference, not a device one, so it arrives from
// /api/me/preferences rather than localStorage. The provider takes an initial
// value (so the first paint is already correct and there is no flash of English
// for a Persian user) and exposes a setter that persists through the same
// adapter.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { updatePreferences } from '@/lib/api/preferences';

import {
  createT,
  directionOf,
  resolveLocale,
  type AcceptedLocale,
  type Direction,
  type Translate,
} from './index';

type LocaleContextValue = {
  locale: AcceptedLocale;
  dir: Direction;
  t: Translate;
  /** Persists to the account. Optimistic: the UI switches immediately. */
  setLocale: (next: AcceptedLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale = 'en',
  children,
}: {
  initialLocale?: AcceptedLocale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<AcceptedLocale>(() =>
    resolveLocale(initialLocale)
  );

  const dir = directionOf(locale);

  // The document element carries lang/dir, not a wrapper div: assistive
  // technology and the browser's own text handling read them from <html>, and
  // scoping direction to a subtree leaves scrollbars and native controls on the
  // wrong side.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', locale);
    root.setAttribute('dir', dir);
  }, [locale, dir]);

  const setLocale = useCallback((next: AcceptedLocale) => {
    // Optimistic: switching language must feel instant. A failed save leaves
    // the session in the chosen language and the account unchanged, which the
    // settings surface reports — it never silently snaps back mid-sentence.
    setLocaleState(next);
    void updatePreferences({ language: next });
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, dir, t: createT(locale), setLocale }),
    [locale, dir, setLocale]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

/**
 * Read the active locale and translator.
 *
 * Throws outside a provider rather than falling back to English: a silent
 * fallback would make a mis-wired subtree look correct in English and only fail
 * for Persian users, which is the hardest kind of bug to see.
 */
export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used inside <LocaleProvider>');
  }
  return ctx;
}

/** Convenience for the common case. */
export function useT(): Translate {
  return useLocale().t;
}
