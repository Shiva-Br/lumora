import en from './en.json';
import fa from './fa.json';

/** The locales the design ships translations for. */
export const LOCALES = ['en', 'fa'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Locales the product ACCEPTS from account preferences. `ar` is accepted by the
 * backend and renders right-to-left, but has no translation yet — it resolves to
 * English text in an RTL layout rather than being refused, which is the honest
 * degradation: the user asked for Arabic, we do not have it, and pretending
 * otherwise by silently switching them to English LTR would hide that.
 */
export type AcceptedLocale = Locale | 'ar';

/** Right-to-left scripts. Direction is a property of the locale, not a setting. */
const RTL: ReadonlySet<string> = new Set(['fa', 'ar']);

export type Direction = 'ltr' | 'rtl';

export function directionOf(locale: AcceptedLocale): Direction {
  return RTL.has(locale) ? 'rtl' : 'ltr';
}

/** The corpus shape, inferred from English so the key union stays in step. */
type Corpus = typeof en;

/**
 * Every dotted leaf path in the corpus, as a union. `t('home.heading')` is
 * checked at compile time; `t('home.headnig')` does not build. This is what
 * makes a missing key a build failure rather than a blank space in production.
 */
export type TranslationKey = LeafPaths<Corpus>;

type LeafPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : LeafPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

const CORPUS: Record<Locale, Corpus> = { en, fa };

function lookup(corpus: unknown, path: string): string | undefined {
  let node: unknown = corpus;
  for (const segment of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Resolve a locale string from anywhere (a preference, a header) onto one this
 * layer can serve. Unknown input falls back to English rather than throwing:
 * a bad locale should never be the reason a page fails to render.
 */
export function resolveLocale(
  value: string | null | undefined
): AcceptedLocale {
  const v = (value ?? '').toLowerCase().trim();
  if (v === 'fa' || v === 'ar' || v === 'en') return v;
  return 'en';
}

/** Interpolation values for `{placeholders}` in a string. */
export type Vars = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(PLACEHOLDER, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole
  );
}

export type Translate = (key: TranslationKey, vars?: Vars) => string;

/**
 * Build a translator for a locale.
 *
 * A key missing from the requested locale falls back to English rather than
 * rendering blank or printing the key at the user — a partially translated UI
 * is usable, an empty one is not. `ar` has no corpus yet and resolves wholly to
 * English text while still laying out RTL.
 *
 * A key missing from BOTH is a bug the type union should have caught, so it
 * returns the key itself: visible in review, and never an empty element that
 * looks like a rendering fault.
 */
export function createT(locale: AcceptedLocale): Translate {
  const primary = locale === 'ar' ? CORPUS.en : CORPUS[locale];
  return (key, vars) => {
    const hit = lookup(primary, key) ?? lookup(CORPUS.en, key) ?? key;
    return interpolate(hit, vars);
  };
}
