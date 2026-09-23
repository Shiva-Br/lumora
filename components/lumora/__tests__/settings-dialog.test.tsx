import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsDialog } from '@/components/lumora/settings-dialog';
import { LocaleProvider } from '@/lib/i18n/provider';
import { MotionPreferenceProvider } from '@/lib/motion-preference';

const updateSpy = vi.hoisted(() =>
  vi.fn(async (patch: Record<string, unknown>) => {
    void patch;
    return null;
  })
);
const prefs = vi.hoisted(() => ({
  theme: 'dark' as const,
  language: 'en' as const,
  sidebarCollapsed: false,
  reducedMotionOverride: null as boolean | null,
  _v: 1,
}));

vi.mock('@/lib/api/preferences', () => ({
  updatePreferences: updateSpy,
  getPreferences: vi.fn(async () => prefs),
  DEFAULT_PREFERENCES: prefs,
}));

function open(locale: 'en' | 'fa' | 'ar' = 'en', onClose = () => {}) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <MotionPreferenceProvider>
        <SettingsDialog onClose={onClose} />
      </MotionPreferenceProvider>
    </LocaleProvider>
  );
}

beforeEach(() => {
  updateSpy.mockClear();
  document.documentElement.removeAttribute('data-motion');
});

describe('settings dialog', () => {
  it('is a real modal with an accessible name', () => {
    open();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Settings');
  });

  it('offers the three languages the product actually supports', () => {
    open();
    const group = screen.getByRole('radiogroup', { name: 'Language' });
    const options = within(group).getAllByRole('radio');
    expect(options.map((o) => o.textContent)).toEqual([
      'English',
      'فارسی',
      'العربية',
    ]);
  });

  it('changes the language and saves it to the account', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('radio', { name: 'فارسی' }));

    // Saved as an account setting...
    expect(updateSpy).toHaveBeenCalledWith({ language: 'fa' });
    // ...and applied immediately, without waiting on the network.
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('dir', 'rtl')
    );
  });

  it('says plainly that Arabic has no translation yet', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('radio', { name: 'العربية' }));
    // The honest note rather than silently showing English and hoping nobody
    // notices which language they are reading.
    expect(
      screen.getByText(
        /Right-to-left layout; the interface text is still English/
      )
    ).toBeInTheDocument();
  });

  it('renders itself in Persian for a Persian account', () => {
    open('fa');
    expect(screen.getByRole('dialog')).toHaveAccessibleName('تنظیمات');
  });
});

describe('reduced motion', () => {
  it('defaults to following the system', () => {
    open();
    const group = screen.getByRole('radiogroup', { name: 'Reduce motion' });
    const chosen = within(group)
      .getAllByRole('radio')
      .find((r) => r.getAttribute('aria-checked') === 'true');
    expect(chosen).toHaveTextContent('Follow my system');
    expect(document.documentElement).not.toHaveAttribute('data-motion');
  });

  it('forcing reduction marks the document so CSS can act on it', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('radio', { name: 'Always reduce' }));
    expect(updateSpy).toHaveBeenCalledWith({ reducedMotionOverride: true });
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-motion', 'reduced')
    );
  });

  it('forcing full motion is distinct from following the system', async () => {
    // This is the case that is easy to get wrong: the OS may say "reduce", and
    // a person who explicitly asked for animations must still get them. The
    // attribute is what the guarded media queries key off.
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('radio', { name: 'Never reduce' }));
    expect(updateSpy).toHaveBeenCalledWith({ reducedMotionOverride: false });
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute('data-motion', 'full')
    );
  });

  it('sends only the key it changed', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('radio', { name: 'Always reduce' }));
    const [firstCall] = updateSpy.mock.calls;
    expect(Object.keys(firstCall![0])).toEqual(['reducedMotionOverride']);
  });
});

describe('closing', () => {
  it('closes on Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    open('en', onClose);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on the close button, which has an accessible name', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    open('en', onClose);
    await user.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(onClose).toHaveBeenCalled();
  });
});
