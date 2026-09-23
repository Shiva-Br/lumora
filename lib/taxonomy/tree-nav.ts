// Keyboard navigation for the Decision Worlds tree (WAI-ARIA `tree` pattern).
//
// Pure and DOM-free so it can be reasoned about and tested directly: the
// component owns focus and expansion, this owns what a key MEANS. The rules are
// the ARIA Authoring Practices tree pattern, which is what a screen-reader user
// will already expect — inventing a different keyboard model here would be a
// worse experience than having none.
//
// Direction matters: in an RTL layout Right collapses and Left expands, because
// the arrows follow the reading direction rather than the screen.

/** One visible row, flattened in the order it appears on screen. */
export type TreeNode = {
  /** Stable id — the same key the expansion state is stored under. */
  id: string;
  /** 1-based depth, for aria-level. */
  level: number;
  /** Undefined for a leaf; a leaf has no expanded state to report. */
  expanded?: boolean;
  /** Id of this node's parent, for the collapse-to-parent move. */
  parentId?: string;
};

export type TreeAction =
  | { type: 'focus'; id: string }
  | { type: 'expand'; id: string }
  | { type: 'collapse'; id: string }
  | { type: 'activate'; id: string }
  | { type: 'none' };

const NONE: TreeAction = { type: 'none' };

function indexOf(nodes: TreeNode[], id: string): number {
  return nodes.findIndex((n) => n.id === id);
}

/**
 * Resolve a keypress against the visible rows.
 *
 * `nodes` must be the FLATTENED visible list — a collapsed subtree's children
 * are not in it, which is what makes Down move to the next visible row rather
 * than into hidden content.
 */
export function treeKeyAction(
  key: string,
  focusedId: string,
  nodes: TreeNode[],
  dir: 'ltr' | 'rtl' = 'ltr'
): TreeAction {
  const i = indexOf(nodes, focusedId);
  if (i < 0) return NONE;
  const node = nodes[i]!;

  // The arrows that expand and collapse follow the reading direction.
  const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const back = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';

  switch (key) {
    case 'ArrowDown':
      return i + 1 < nodes.length
        ? { type: 'focus', id: nodes[i + 1]!.id }
        : NONE;

    case 'ArrowUp':
      return i > 0 ? { type: 'focus', id: nodes[i - 1]!.id } : NONE;

    case forward:
      // Closed parent → open it. Open parent → step into its first child.
      // Leaf → nothing, deliberately: a leaf has nowhere forward to go.
      if (node.expanded === false) return { type: 'expand', id: node.id };
      if (node.expanded === true) {
        const child = nodes[i + 1];
        return child && child.level > node.level
          ? { type: 'focus', id: child.id }
          : NONE;
      }
      return NONE;

    case back:
      // Open parent → close it. Anything else → go to the parent row, which is
      // how a user climbs back out of a deep subtree without arrowing up
      // through every sibling.
      if (node.expanded === true) return { type: 'collapse', id: node.id };
      return node.parentId ? { type: 'focus', id: node.parentId } : NONE;

    case 'Home':
      return nodes.length ? { type: 'focus', id: nodes[0]!.id } : NONE;

    case 'End':
      return nodes.length
        ? { type: 'focus', id: nodes[nodes.length - 1]!.id }
        : NONE;

    case 'Enter':
    case ' ':
      return { type: 'activate', id: node.id };

    default:
      return NONE;
  }
}

/**
 * Type-ahead: jump to the next row whose label starts with `prefix`, wrapping
 * past the focused row so repeated presses cycle through matches.
 */
export function typeaheadTarget(
  prefix: string,
  focusedId: string,
  rows: { id: string; label: string }[]
): string | null {
  if (!prefix) return null;
  const needle = prefix.toLowerCase();
  const start = rows.findIndex((r) => r.id === focusedId);
  const ordered =
    start < 0 ? rows : [...rows.slice(start + 1), ...rows.slice(0, start + 1)];
  const hit = ordered.find((r) => r.label.toLowerCase().startsWith(needle));
  return hit ? hit.id : null;
}
