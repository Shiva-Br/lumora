import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LocaleProvider, useT } from '@/lib/i18n/provider';
import { specializedNodeIds, type Coverage } from '@/lib/taxonomy/coverage';

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

const COVERAGE: Coverage = {
  general_fallback: true,
  specialized: [{ id: 'laptop', taxonomy_id: 'VK-02-01', name: 'Laptop' }],
};

/**
 * The tree's leaf contract: a row that carries a specialized flow says so, and
 * one that does not stays quiet. This is the same markup the sidebar's
 * StaticRow emits, without dragging in the whole shell.
 */
function Leaf({ id, label }: { id: string; label: string }) {
  const t = useT();
  const deep = specializedNodeIds(COVERAGE).has(id);
  return (
    <div
      role="treeitem"
      aria-level={3}
      aria-selected={false}
      tabIndex={-1}
      title={deep ? t('atlas.deepSearchTitle') : label}
    >
      <span>{label}</span>
      {deep && <span data-testid={`badge-${id}`}>{t('atlas.deepSearch')}</span>}
    </div>
  );
}

function Tree({ locale = 'en' as 'en' | 'fa' }) {
  return (
    <LocaleProvider initialLocale={locale}>
      <div role="tree" aria-label="atlas">
        <Leaf id="phase1|VK-02|Laptops" label="Laptops" />
        <Leaf id="phase1|VK-02|Tablets" label="Tablets" />
        <Leaf id="phase1|VK-02|Monitors" label="Monitors" />
      </div>
    </LocaleProvider>
  );
}

describe('the atlas states its depth', () => {
  it('marks the area that has a specialized flow', () => {
    render(<Tree />);
    expect(screen.getByTestId('badge-phase1|VK-02|Laptops')).toHaveTextContent(
      'Deep search'
    );
  });

  it('leaves the rest unmarked rather than implying depth', () => {
    // The whole point: browsing 5,742 areas is fine, claiming to be an expert
    // in all of them is not.
    render(<Tree />);
    expect(screen.queryByTestId('badge-phase1|VK-02|Tablets')).toBeNull();
    expect(screen.queryByTestId('badge-phase1|VK-02|Monitors')).toBeNull();
  });

  it('explains what the marker means on hover, not just that it exists', () => {
    render(<Tree />);
    const marked = screen.getAllByRole('treeitem')[0]!;
    expect(marked.getAttribute('title')).toMatch(/full specialized flow/i);
  });

  it('marks exactly one row, not a whole branch', () => {
    render(<Tree />);
    const tree = screen.getByRole('tree');
    expect(within(tree).getAllByText('Deep search')).toHaveLength(1);
  });

  it('speaks Persian too — the marker is copy, not decoration', () => {
    render(<Tree locale="fa" />);
    const badge = screen.getByTestId('badge-phase1|VK-02|Laptops');
    expect(badge.textContent).toMatch(/[؀-ۿ]/);
  });
});

describe('before the backend answers', () => {
  it('marks nothing, so the tree never overstates what the product knows', () => {
    // The pre-config state and the unreachable-config state are the same, and
    // both understate rather than overstate. That is the safe direction for a
    // claim about expertise.
    expect(
      specializedNodeIds({ specialized: [], general_fallback: true }).size
    ).toBe(0);
  });
});
