import { describe, expect, it } from 'vitest';

import {
  categoriesWithDepth,
  parseTaxonomyId,
  resolveCovered,
  specializedNodeIds,
  type Coverage,
} from '../coverage';

/**
 * The ids the backend publishes today, copied from its registry
 * (Category.TaxonomyID in internal/modules/chatbot/categories/*.go).
 *
 * Duplicated deliberately. This is a CONTRACT between two repositories, and the
 * point of the test is to fail here when one side moves — a shared constant
 * could not detect the drift it exists to catch.
 */
const LIVE: Coverage = {
  general_fallback: true,
  specialized: [
    { id: 'smartphone', taxonomy_id: 'VK-01-01', name: 'Smartphone' },
    { id: 'smartwatch', taxonomy_id: 'VK-01-02', name: 'Smartwatch' },
    {
      id: 'mobile_accessories',
      taxonomy_id: 'VK-01-05',
      name: 'Mobile Accessories',
    },
    { id: 'laptop', taxonomy_id: 'VK-02-01', name: 'Laptop' },
    { id: 'desktop_pc', taxonomy_id: 'VK-02-02', name: 'Desktop PC' },
  ],
};

describe('the published ids point at real atlas nodes', () => {
  it.each(LIVE.specialized)('$taxonomy_id resolves', (entry) => {
    // A published id that resolves to nothing would mark no node — the failure
    // is silent in the UI, which is exactly why it is loud here.
    expect(resolveCovered(entry.taxonomy_id)).not.toBeNull();
  });

  it('lands on the area the backend means', () => {
    // Not just "resolves" — resolves to the RIGHT row. An off-by-one in the
    // 1-based index would still resolve, to the wrong specialized area, and
    // mark depth where none exists.
    expect(resolveCovered('VK-01-01')?.sub).toBe('Smartphones');
    expect(resolveCovered('VK-01-02')?.sub).toBe('Smartwatches');
    expect(resolveCovered('VK-02-01')?.sub).toBe('Laptops');
    expect(resolveCovered('VK-02-02')?.sub).toBe('Desktop PCs');
    expect(resolveCovered('VK-01-05')?.sub).toMatch(/^Mobile Accessories/);
  });

  it('marks exactly as many nodes as the backend claims', () => {
    expect(specializedNodeIds(LIVE).size).toBe(LIVE.specialized.length);
  });

  it('keys nodes the way the tree keys its rows', () => {
    // The set is joined against the tree's own row ids; a different shape marks
    // nothing while looking correct in isolation.
    expect(specializedNodeIds(LIVE)).toContain('phase1|VK-02|Laptops');
  });

  it('rolls depth up to the containing category', () => {
    const cats = categoriesWithDepth(LIVE);
    expect(cats).toContain('phase1|VK-01');
    expect(cats).toContain('phase1|VK-02');
    expect(cats.size).toBe(2);
  });
});

describe('malformed ids mark nothing rather than the wrong thing', () => {
  it.each([
    ['', 'empty'],
    ['VK-02', 'category only'],
    ['VK-02-1', 'unpadded index'],
    ['vk-02-01', 'lowercase'],
    ['VK-02-00', 'zero index'],
    ['XX-99-01', 'unknown category'],
    ['VK-02-99', 'area beyond the end'],
  ])('%s (%s) resolves to null', (id) => {
    expect(resolveCovered(id)).toBeNull();
  });

  it('drops unresolvable ids from the marked set instead of throwing', () => {
    const stale: Coverage = {
      general_fallback: true,
      specialized: [
        { id: 'laptop', taxonomy_id: 'VK-02-01', name: 'Laptop' },
        { id: 'ghost', taxonomy_id: 'VK-99-01', name: 'Ghost' },
      ],
    };
    // A stale id is a repo mismatch worth failing a build over — never worth
    // breaking a user's sidebar over.
    expect(specializedNodeIds(stale).size).toBe(1);
  });
});

describe('parseTaxonomyId', () => {
  it('converts the 1-based published index to a 0-based array index', () => {
    expect(parseTaxonomyId('VK-02-01')).toEqual({
      categoryId: 'VK-02',
      areaIndex: 0,
    });
    expect(parseTaxonomyId('VK-01-05')).toEqual({
      categoryId: 'VK-01',
      areaIndex: 4,
    });
  });
});

describe('the honest default', () => {
  it('marks nothing when coverage is empty, and still allows general answers', () => {
    const empty: Coverage = { specialized: [], general_fallback: true };
    expect(specializedNodeIds(empty).size).toBe(0);
    // Understating coverage is the safe direction for a claim about how much
    // the product knows; overstating it is not.
    expect(empty.general_fallback).toBe(true);
  });
});
