import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LocaleProvider, useLocale, useT } from '../provider';

// Typed with its argument so the call tuple is inspectable — an untyped
// vi.fn() records calls as [], which silently makes assertions about the
// patch body impossible to write.
const updateSpy = vi.hoisted(() =>
  vi.fn(async (patch: Record<string, unknown>) => {
    void patch;
    return null;
  })
);
vi.mock('@/lib/api/preferences', () => ({
  updatePreferences: updateSpy,
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

function Probe() {
  const { locale, dir, setLocale } = useLocale();
  const t = useT();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <span data-testid="heading">{t('home.heading')}</span>
      <button onClick={() => setLocale('fa')}>switch</button>
    </div>
  );
}

beforeEach(() => {
  updateSpy.mockClear();
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
});

describe('LocaleProvider', () => {
  it('puts lang and dir on the document element, not a wrapper', async () => {
    // Assistive technology and the browser's own text handling read these from
    // <html>; scoping direction to a subtree leaves native controls and
    // scrollbars on the wrong side.
    render(
      <LocaleProvider initialLocale="fa">
        <Probe />
      </LocaleProvider>
    );
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('lang', 'fa');
      expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    });
  });

  it('renders Persian copy for a Persian account', () => {
    render(
      <LocaleProvider initialLocale="fa">
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByTestId('locale')).toHaveTextContent('fa');
    expect(screen.getByTestId('dir')).toHaveTextContent('rtl');
    // The heading must actually be Persian, not English in an RTL box.
    expect(screen.getByTestId('heading').textContent).toMatch(/[؀-ۿ]/);
  });

  it('lays Arabic out RTL even though it has no translation yet', async () => {
    // The honest degradation: the user asked for Arabic, we do not have the
    // strings, so they get English text in an Arabic-correct layout rather than
    // being silently switched to English LTR.
    render(
      <LocaleProvider initialLocale="ar">
        <Probe />
      </LocaleProvider>
    );
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('dir', 'rtl');
      expect(document.documentElement).toHaveAttribute('lang', 'ar');
    });
    expect(screen.getByTestId('heading').textContent).not.toMatch(/[؀-ۿ]/);
  });

  it('switches language immediately and persists to the account', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider initialLocale="en">
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByTestId('dir')).toHaveTextContent('ltr');

    await user.click(screen.getByRole('button', { name: 'switch' }));

    // Optimistic: the UI must not wait on the network to change language.
    expect(screen.getByTestId('locale')).toHaveTextContent('fa');
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('dir', 'rtl')
    );
    // ...and it is an account setting, so it is saved, not left device-local.
    expect(updateSpy).toHaveBeenCalledWith({ language: 'fa' });
  });

  it('sends only the language key, so a save cannot clobber other settings', async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider initialLocale="en">
        <Probe />
      </LocaleProvider>
    );
    await user.click(screen.getByRole('button', { name: 'switch' }));
    const [firstCall] = updateSpy.mock.calls;
    expect(firstCall).toBeDefined();
    expect(Object.keys(firstCall![0])).toEqual(['language']);
  });
});

describe('useLocale outside a provider', () => {
  it('throws rather than silently falling back to English', () => {
    // A silent fallback makes a mis-wired subtree look correct in English and
    // fail only for Persian users — the hardest kind of bug to see.
    const Bare = () => <span>{useLocale().locale}</span>;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(/useLocale must be used inside/);
    spy.mockRestore();
  });
});
