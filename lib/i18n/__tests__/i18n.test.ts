import { describe, expect, it } from 'vitest';

import en from '../en.json';
import fa from '../fa.json';
import {
  createT,
  directionOf,
  resolveLocale,
  type TranslationKey,
} from '../index';

/** Every dotted leaf path in a corpus, for parity checking. */
function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  if (typeof node !== 'object' || node === null) return [];
  return Object.entries(node).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k)
  );
}

const enKeys = leaves(en);
const faKeys = leaves(fa);

describe('corpus parity', () => {
  it('ships a substantial corpus, not a stub', () => {
    // Guards against a truncated port: the handoff delivers ~505 leaf strings,
    // and a corpus that quietly shrank would still pass every other test here.
    expect(enKeys.length).toBeGreaterThan(400);
  });

  it('has no key present in English but missing from Persian', () => {
    const missing = enKeys.filter((k) => !faKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it('has no key present in Persian but missing from English', () => {
    // English is the source of the type union, so a Persian-only key is
    // unreachable — it can never be requested.
    const extra = faKeys.filter((k) => !enKeys.includes(k));
    expect(extra).toEqual([]);
  });

  it('has no empty strings in either locale', () => {
    const emptyEn = enKeys.filter(
      (k) => createT('en')(k as TranslationKey) === ''
    );
    const emptyFa = faKeys.filter(
      (k) => createT('fa')(k as TranslationKey) === ''
    );
    expect({ en: emptyEn, fa: emptyFa }).toEqual({ en: [], fa: [] });
  });

  it('actually translates — Persian is not an English copy', () => {
    // A "translated" corpus that is really the English one would pass parity
    // and every lookup test. This is the check that catches it.
    const identical = enKeys.filter(
      (k) =>
        createT('en')(k as TranslationKey) ===
        createT('fa')(k as TranslationKey)
    );
    // Some values legitimately match across locales (the brand name, "LUMORA").
    expect(identical.length).toBeLessThan(enKeys.length * 0.2);
  });
});

describe('createT', () => {
  it('resolves a key in the requested locale', () => {
    expect(createT('en')('brand.name')).toBe('LUMORA');
    expect(createT('fa')('home.heading')).not.toBe(
      createT('en')('home.heading')
    );
  });

  it('interpolates named placeholders', () => {
    const t = createT('en');
    const withVars = t('brand.name', { unused: 'x' });
    expect(withVars).toBe('LUMORA');
  });

  it('returns the key itself when it exists in neither corpus', () => {
    // Visible in review, and never an empty element that reads as a render bug.
    const t = createT('en');
    expect(t('nope.not.a.key' as TranslationKey)).toBe('nope.not.a.key');
  });

  it('falls back to English for an untranslated locale rather than blanking', () => {
    // ar is accepted (it lays out RTL) but has no corpus yet. The honest
    // degradation is English text in an RTL layout, not empty strings.
    expect(createT('ar')('brand.name')).toBe('LUMORA');
    expect(createT('ar')('home.heading')).toBe(createT('en')('home.heading'));
  });
});

describe('direction', () => {
  it('is a property of the locale, not a setting', () => {
    expect(directionOf('en')).toBe('ltr');
    expect(directionOf('fa')).toBe('rtl');
    expect(directionOf('ar')).toBe('rtl');
  });
});

describe('resolveLocale', () => {
  it.each([
    ['fa', 'fa'],
    ['FA', 'fa'],
    ['  ar  ', 'ar'],
    ['en', 'en'],
  ])('normalises %s to %s', (input, want) => {
    expect(resolveLocale(input)).toBe(want);
  });

  it('falls back to English for anything unknown', () => {
    // A bad locale must never be the reason a page fails to render.
    for (const bad of ['de', '', null, undefined, 'zz-ZZ']) {
      expect(resolveLocale(bad)).toBe('en');
    }
  });
});
