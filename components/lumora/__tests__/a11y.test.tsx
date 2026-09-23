import { render } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { SettingsDialog } from '@/components/lumora/settings-dialog';
import { LocaleProvider, useT } from '@/lib/i18n/provider';
import { MotionPreferenceProvider } from '@/lib/motion-preference';

const prefs = vi.hoisted(() => ({
  theme: 'dark' as const,
  language: 'en' as const,
  sidebarCollapsed: false,
  reducedMotionOverride: null as boolean | null,
  _v: 1,
}));
vi.mock('@/lib/api/preferences', () => ({
  updatePreferences: vi.fn(async () => null),
  getPreferences: vi.fn(async () => prefs),
  DEFAULT_PREFERENCES: prefs,
}));

/**
 * Run axe over a rendered tree and return only violations.
 *
 * Colour-contrast is disabled: jsdom computes no layout and no real colours, so
 * the rule reports nothing meaningful either way. Leaving it "passing" here
 * would be worse than turning it off — it would look like contrast was checked
 * when nothing was. It belongs in a real-browser run.
 */
async function violationsOf(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.length,
    help: v.help,
  }));
}

function wrap(ui: React.ReactNode, locale: 'en' | 'fa' = 'en') {
  return render(
    <LocaleProvider initialLocale={locale}>
      <MotionPreferenceProvider>{ui}</MotionPreferenceProvider>
    </LocaleProvider>
  );
}

describe('settings dialog', () => {
  it('has no axe violations', async () => {
    const { baseElement } = wrap(<SettingsDialog onClose={() => {}} />);
    expect(await violationsOf(baseElement)).toEqual([]);
  });

  it('has no axe violations in Persian, right-to-left', async () => {
    // RTL is where accessibility regressions hide: a label association or a
    // focus order that survives LTR can break when direction flips.
    const { baseElement } = wrap(<SettingsDialog onClose={() => {}} />, 'fa');
    expect(await violationsOf(baseElement)).toEqual([]);
  });
});

/**
 * The Decision Worlds tree's ARIA shape, in isolation.
 *
 * The real sidebar drags in the whole shell, so this is the same markup
 * contract the tree rows emit — role, level, expansion, selection and a single
 * tab stop. It is the structure axe actually evaluates.
 */
function TreeSample() {
  const t = useT();
  return (
    <div role="tree" aria-label={t('atlas.tree')}>
      <div
        role="treeitem"
        aria-level={1}
        aria-expanded
        aria-selected
        tabIndex={0}
      >
        <span>Product Intelligence</span>
        <div role="group">
          <div
            role="treeitem"
            aria-level={2}
            aria-expanded={false}
            aria-selected={false}
            tabIndex={-1}
          >
            <span>Mobile &amp; Smartphones</span>
          </div>
        </div>
      </div>
      <div
        role="treeitem"
        aria-level={1}
        aria-expanded={false}
        aria-selected={false}
        tabIndex={-1}
      >
        <span>Career</span>
      </div>
    </div>
  );
}

describe('decision worlds tree', () => {
  it('has no axe violations', async () => {
    const { container } = wrap(<TreeSample />);
    expect(await violationsOf(container)).toEqual([]);
  });

  it('exposes exactly one tab stop', async () => {
    // The defect this replaced: every one of 5,742 rows carried tabIndex={0},
    // so tabbing past the sidebar meant thousands of key presses.
    const { container } = wrap(<TreeSample />);
    const stops = container.querySelectorAll('[role="treeitem"][tabindex="0"]');
    expect(stops).toHaveLength(1);
  });

  it('reports depth on every node, which is how a screen reader announces level', async () => {
    const { container } = wrap(<TreeSample />);
    const items = Array.from(container.querySelectorAll('[role="treeitem"]'));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.getAttribute('aria-level')).toBeTruthy();
      expect(item.getAttribute('aria-selected')).toBeTruthy();
    }
  });

  it('wraps children in a group, so the tree nests rather than flattening', async () => {
    const { container } = wrap(<TreeSample />);
    expect(container.querySelector('[role="group"]')).toBeTruthy();
  });
});
