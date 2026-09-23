import { describe, expect, it } from 'vitest';

import { treeKeyAction, typeaheadTarget, type TreeNode } from '../tree-nav';

// A small slice shaped like the real thing: two worlds, one expanded, with a
// category expanded under it.
const NODES: TreeNode[] = [
  { id: 'w1', level: 1, expanded: true },
  { id: 'w1|c1', level: 2, expanded: true, parentId: 'w1' },
  { id: 'w1|c1|s1', level: 3, parentId: 'w1|c1' },
  { id: 'w1|c1|s2', level: 3, parentId: 'w1|c1' },
  { id: 'w1|c2', level: 2, expanded: false, parentId: 'w1' },
  { id: 'w2', level: 1, expanded: false },
];

describe('vertical movement', () => {
  it('Down goes to the next VISIBLE row', () => {
    expect(treeKeyAction('ArrowDown', 'w1', NODES)).toEqual({
      type: 'focus',
      id: 'w1|c1',
    });
  });

  it('Down from the last row does nothing rather than wrapping', () => {
    expect(treeKeyAction('ArrowDown', 'w2', NODES)).toEqual({ type: 'none' });
  });

  it('Up goes to the previous visible row', () => {
    expect(treeKeyAction('ArrowUp', 'w1|c2', NODES)).toEqual({
      type: 'focus',
      id: 'w1|c1|s2',
    });
  });

  it('Home and End reach the ends', () => {
    expect(treeKeyAction('Home', 'w1|c2', NODES)).toEqual({
      type: 'focus',
      id: 'w1',
    });
    expect(treeKeyAction('End', 'w1', NODES)).toEqual({
      type: 'focus',
      id: 'w2',
    });
  });
});

describe('expand and collapse', () => {
  it('Right opens a closed parent', () => {
    expect(treeKeyAction('ArrowRight', 'w2', NODES)).toEqual({
      type: 'expand',
      id: 'w2',
    });
  });

  it('Right on an OPEN parent steps into its first child', () => {
    expect(treeKeyAction('ArrowRight', 'w1', NODES)).toEqual({
      type: 'focus',
      id: 'w1|c1',
    });
  });

  it('Right on a leaf does nothing — there is nowhere forward to go', () => {
    expect(treeKeyAction('ArrowRight', 'w1|c1|s1', NODES)).toEqual({
      type: 'none',
    });
  });

  it('Left closes an open parent', () => {
    expect(treeKeyAction('ArrowLeft', 'w1|c1', NODES)).toEqual({
      type: 'collapse',
      id: 'w1|c1',
    });
  });

  it('Left on a leaf climbs to its parent', () => {
    // The move that makes a 5,742-row tree navigable: escaping a deep subtree
    // without arrowing up through every sibling.
    expect(treeKeyAction('ArrowLeft', 'w1|c1|s2', NODES)).toEqual({
      type: 'focus',
      id: 'w1|c1',
    });
  });

  it('Left at the root does nothing', () => {
    expect(treeKeyAction('ArrowLeft', 'w2', NODES)).toEqual({ type: 'none' });
  });
});

describe('right-to-left', () => {
  it('swaps the expand and collapse arrows', () => {
    // The arrows follow the READING direction. In Persian, Left opens and Right
    // closes — the opposite mapping would send a Persian user outward when they
    // pressed the key that visually points into the subtree.
    expect(treeKeyAction('ArrowLeft', 'w2', NODES, 'rtl')).toEqual({
      type: 'expand',
      id: 'w2',
    });
    expect(treeKeyAction('ArrowRight', 'w1|c1', NODES, 'rtl')).toEqual({
      type: 'collapse',
      id: 'w1|c1',
    });
  });

  it('leaves vertical movement alone', () => {
    // Up and down are not direction-dependent, and flipping them would be a
    // bug that only Persian users ever hit.
    expect(treeKeyAction('ArrowDown', 'w1', NODES, 'rtl')).toEqual({
      type: 'focus',
      id: 'w1|c1',
    });
    expect(treeKeyAction('ArrowUp', 'w1|c2', NODES, 'rtl')).toEqual({
      type: 'focus',
      id: 'w1|c1|s2',
    });
  });
});

describe('activation', () => {
  it.each(['Enter', ' '])('%s activates the focused row', (key) => {
    expect(treeKeyAction(key, 'w1|c2', NODES)).toEqual({
      type: 'activate',
      id: 'w1|c2',
    });
  });

  it('ignores keys it does not own, so typing still reaches the page', () => {
    for (const key of ['a', 'Tab', 'Escape', 'PageDown']) {
      expect(treeKeyAction(key, 'w1', NODES)).toEqual({ type: 'none' });
    }
  });

  it('does nothing when the focused id is not in the visible set', () => {
    // Happens the moment a subtree collapses under the focused row; it must
    // degrade quietly rather than throw.
    expect(treeKeyAction('ArrowDown', 'gone', NODES)).toEqual({ type: 'none' });
  });
});

describe('typeahead', () => {
  const ROWS = [
    { id: 'a', label: 'Automotive' },
    { id: 'b', label: 'Beauty' },
    { id: 'c', label: 'Career' },
    { id: 'd', label: 'Consumer' },
  ];

  it('jumps to the next match after the focused row', () => {
    expect(typeaheadTarget('c', 'c', ROWS)).toBe('d');
  });

  it('wraps past the end', () => {
    expect(typeaheadTarget('a', 'd', ROWS)).toBe('a');
  });

  it('is case-insensitive', () => {
    expect(typeaheadTarget('BE', 'a', ROWS)).toBe('b');
  });

  it('returns null when nothing matches', () => {
    expect(typeaheadTarget('zz', 'a', ROWS)).toBeNull();
  });
});
