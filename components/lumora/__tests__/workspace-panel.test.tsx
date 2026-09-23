import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import {
  InsightPanel,
  type PanelTab,
} from '@/components/lumora/chat/insight-panel';
import type { AcceptedLocale } from '@/lib/i18n';
import { LocaleProvider } from '@/lib/i18n/provider';

const ALL: Record<PanelTab, boolean> = {
  analysis: true,
  products: true,
  offers: true,
};

/** The panel is controlled; this is the state owner the app provides. */
function Harness({ start = 'analysis' as PanelTab }) {
  const [tab, setTab] = React.useState<PanelTab>(start);
  return (
    <InsightPanel
      tab={tab}
      availability={ALL}
      onSelectTab={setTab}
      onClose={() => {}}
      width="720px"
    >
      <p>panel body</p>
    </InsightPanel>
  );
}

function mount(start: PanelTab = 'analysis', locale: AcceptedLocale = 'en') {
  return render(
    <LocaleProvider initialLocale={locale}>
      <Harness start={start} />
    </LocaleProvider>
  );
}

/** The label of whichever tab is selected right now. */
function selectedTab(): string {
  return screen.getByRole('tab', { selected: true }).textContent ?? '';
}

async function pressOnTabs(key: string) {
  const user = userEvent.setup();
  screen.getByRole('tab', { selected: true }).focus();
  await user.keyboard(key);
}

describe('the workspace tab bar', () => {
  it('wires each tab to the panel it controls', () => {
    mount('analysis');
    const panel = screen.getByRole('tabpanel');
    const selected = screen.getByRole('tab', { selected: true });

    expect(panel.id).not.toBe('');
    expect(selected.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(selected.id);
  });

  it('keeps exactly one tab in the tab order', () => {
    mount('products');
    const reachable = screen
      .getAllByRole('tab')
      .filter((el) => el.tabIndex === 0);
    expect(reachable).toHaveLength(1);
    expect(reachable[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('moves forward with ArrowRight', async () => {
    mount('analysis');
    await pressOnTabs('{ArrowRight}');
    expect(selectedTab()).toContain('Why It Wins');
  });

  it('moves back with ArrowLeft, wrapping past the first tab', async () => {
    mount('analysis');
    await pressOnTabs('{ArrowLeft}');
    expect(selectedTab()).toContain('Best Place to Buy');
  });

  it('wraps forward past the last tab', async () => {
    mount('offers');
    await pressOnTabs('{ArrowRight}');
    expect(selectedTab()).toContain('My Best Choice');
  });

  it('jumps to the ends with Home and End', async () => {
    mount('products');
    await pressOnTabs('{End}');
    expect(selectedTab()).toContain('Best Place to Buy');
    await pressOnTabs('{Home}');
    expect(selectedTab()).toContain('My Best Choice');
  });

  it('keeps focus on the tab it just selected', async () => {
    mount('analysis');
    await pressOnTabs('{ArrowRight}');
    expect(screen.getByRole('tab', { selected: true })).toHaveFocus();
  });

  it('mirrors the arrows in Persian, where the first tab is on the right', async () => {
    // The key follows the VISUAL order. Without mirroring, ArrowRight on an RTL
    // layout walks the selection leftwards across the screen — the opposite way
    // to the key the person pressed.
    mount('analysis', 'fa');
    await pressOnTabs('{ArrowRight}');
    expect(selectedTab()).toContain('بهترین جای خرید'); // backwards, wrapped
    await pressOnTabs('{ArrowLeft}');
    expect(selectedTab()).toContain('بهترین انتخاب من'); // forwards, wrapped
  });

  it('leaves keys it does not own to the browser', async () => {
    mount('analysis');
    await pressOnTabs('{ArrowDown}');
    expect(selectedTab()).toContain('My Best Choice');
  });

  it('names the panel and its tablist for assistive technology', () => {
    mount('analysis');
    expect(
      screen.getByRole('complementary', { name: 'LUMORA Workspace' })
    ).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toHaveAccessibleName();
  });

  it('has no axe violations in either direction', async () => {
    for (const locale of ['en', 'fa'] as const) {
      const { container, unmount } = mount('analysis', locale);
      // Colour-contrast is off: jsdom computes no colours, so a "pass" here
      // would mean nothing. That rule belongs in a real-browser run.
      const results = await axe.run(container, {
        rules: { 'color-contrast': { enabled: false } },
      });
      expect(
        results.violations.map((v) => ({ id: v.id, help: v.help }))
      ).toEqual([]);
      unmount();
    }
  });
});
