'use client';

// Resolves the account's language, then renders the locale provider around the
// app.
//
// The account is the source of truth (P1 moved preferences off the device), so
// the language is not known until /api/me/preferences answers. Children render
// immediately in the meantime rather than behind a spinner: blocking the whole
// app on a preference fetch would trade a brief flash of English for a blank
// screen, which is the worse failure. The corrected language and direction land
// on <html> as soon as the answer arrives.
import { useEffect, useState } from 'react';

import { getPreferences } from '@/lib/api/preferences';
import { MotionPreferenceProvider } from '@/lib/motion-preference';

import { LocaleProvider } from './provider';

import { resolveLocale, type AcceptedLocale } from './index';

export function LocaleGate({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<AcceptedLocale>('en');

  useEffect(() => {
    let cancelled = false;
    void getPreferences().then((prefs) => {
      if (!cancelled) setLocale(resolveLocale(prefs.language));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Both account-scoped preference layers mount here, because both are
  // resolved from the same /me/preferences answer and both write to <html>.
  return (
    <LocaleProvider initialLocale={locale}>
      <MotionPreferenceProvider>{children}</MotionPreferenceProvider>
    </LocaleProvider>
  );
}
