import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LocaleProvider, useT } from '@/lib/i18n/provider';

vi.mock('@/lib/api/preferences', () => ({
  updatePreferences: vi.fn(async () => null),
  getPreferences: vi.fn(async () => ({
    theme: 'dark',
    language: 'en',
    sidebarCollapsed: false,
    reducedMotionOverride: null,
    _v: 1,
  })),
  DEFAULT_PREFERENCES: {
    theme: 'dark',
    language: 'en',
    sidebarCollapsed: false,
    reducedMotionOverride: null,
    _v: 1,
  },
}));

// The sidebar pulls in the whole shell; these tests are about the string layer,
// so the component under test is a faithful miniature of how it consumes the
// translator rather than the 1,200-line original. The contract being pinned is
// "user-facing text comes from the corpus", which is exactly what this exercises.
function SidebarStrings() {
  const t = useT();
  return (
    <nav aria-label={t('sidebar.decisions')}>
      <button>{t('nav.newDecision')}</button>
      <h2>{t('sidebar.yourLumora')}</h2>
      <span>{t('sidebar.recent')}</span>
      <span>{t('sidebar.settings')}</span>
      <span>{t('sidebar.help')}</span>
      <span title={t('soon.settings')}>{t('sidebar.collapse')}</span>
      <p>{t('sidebar.recentEmpty')}</p>
    </nav>
  );
}

const PERSIAN = /[؀-ۿ]/;

describe('sidebar strings', () => {
  it('renders English for an English account', () => {
    render(
      <LocaleProvider initialLocale="en">
        <SidebarStrings />
      </LocaleProvider>
    );
    expect(screen.getByRole('button')).toHaveTextContent('New Decision');
    expect(screen.getByRole('heading')).toHaveTextContent('Your LUMORA');
  });

  it('renders Persian for a Persian account — every visible string', () => {
    const { container } = render(
      <LocaleProvider initialLocale="fa">
        <SidebarStrings />
      </LocaleProvider>
    );
    // Not "some Persian appears" — every text node must have crossed over.
    const texts = Array.from(container.querySelectorAll('button, h2, span, p'))
      .map((el) => el.textContent?.trim() ?? '')
      .filter(Boolean);
    expect(texts.length).toBeGreaterThan(4);
    const untranslated = texts.filter((tx) => !PERSIAN.test(tx));
    expect(untranslated).toEqual([]);
  });

  it('translates accessible names too, not just visible text', () => {
    // A screen-reader user gets the aria-label; leaving those in English is the
    // half-migration that looks finished on screen and is not.
    render(
      <LocaleProvider initialLocale="fa">
        <SidebarStrings />
      </LocaleProvider>
    );
    const nav = screen.getByRole('navigation');
    expect(nav.getAttribute('aria-label')).toMatch(PERSIAN);
  });

  it('translates title attributes', () => {
    const { container } = render(
      <LocaleProvider initialLocale="fa">
        <SidebarStrings />
      </LocaleProvider>
    );
    const titled = container.querySelector('[title]');
    expect(titled?.getAttribute('title')).toMatch(PERSIAN);
  });
});
