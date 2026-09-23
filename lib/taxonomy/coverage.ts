// Which parts of the Decision Worlds atlas the backend answers in depth.
//
// The app ships all 10 worlds, 198 categories and 5,742 specialized areas so a
// person can browse the whole map — that is a real feature. But a specialized
// flow (its question set, its scoring model, its hand-authored expert profile)
// exists for a handful of areas. Showing the atlas without saying which is
// which invites someone to invest a five-question flow in an area that will
// answer generically.
//
// The backend publishes the list on /client-config, derived from its live
// registry, so this never claims depth that is not there.
import { categoriesOf } from './atlas';
import { DECISION_WORLDS } from './worlds';

/** One node the backend answers with a full specialized flow. */
export interface CoveredCategory {
  /** The backend's own slug ("laptop"). */
  id: string;
  /** Its position in the shared atlas — "VK-02-01" is category VK-02, area 1. */
  taxonomy_id: string;
  name: string;
}

export interface Coverage {
  specialized: CoveredCategory[];
  /**
   * Everywhere else the decision pipeline answers without a questionnaire.
   * A real capability, not a failure state — which is why it is advertised
   * rather than inferred from the absence of a specialized entry.
   */
  general_fallback: boolean;
}

/** Nothing marked, general answers everywhere — the honest state before the
 *  config arrives, and the safe one if it never does. */
export const EMPTY_COVERAGE: Coverage = {
  specialized: [],
  general_fallback: true,
};

/**
 * Split a published id into the atlas coordinates it names.
 *
 * "VK-02-01" → category "VK-02", area index 0 (the id is 1-based).
 * Returns null for anything that is not that shape, so a malformed id marks
 * nothing rather than marking the wrong node — a confident lie about where
 * depth exists is worse than no marking at all.
 */
export function parseTaxonomyId(
  taxonomyId: string
): { categoryId: string; areaIndex: number } | null {
  const m = /^([A-Z]{2}-\d{2})-(\d{2})$/.exec(taxonomyId);
  if (!m) return null;
  const areaIndex = Number(m[2]) - 1;
  if (areaIndex < 0) return null;
  return { categoryId: m[1]!, areaIndex };
}

/** The atlas node a published id points at, or null when it resolves to nothing. */
export function resolveCovered(
  taxonomyId: string
): { worldId: string; categoryId: string; sub: string } | null {
  const parsed = parseTaxonomyId(taxonomyId);
  if (!parsed) return null;
  for (const world of DECISION_WORLDS) {
    for (const category of categoriesOf(world.id)) {
      if (category.id !== parsed.categoryId) continue;
      const sub = category.subs[parsed.areaIndex];
      return sub ? { worldId: world.id, categoryId: category.id, sub } : null;
    }
  }
  return null;
}

/**
 * The set of tree node ids that carry a specialized flow, keyed exactly as the
 * Decision Worlds tree keys its rows (`world|category|sub`).
 *
 * Ids that resolve to nothing are dropped silently here and surfaced by the
 * test that walks the real atlas — a stale id is a backend/atlas mismatch worth
 * failing a build over, not worth breaking a user's sidebar over.
 */
export function specializedNodeIds(coverage: Coverage): Set<string> {
  const ids = new Set<string>();
  for (const entry of coverage.specialized) {
    const node = resolveCovered(entry.taxonomy_id);
    if (node) ids.add(`${node.worldId}|${node.categoryId}|${node.sub}`);
  }
  return ids;
}

/** The category rows that CONTAIN a specialized area, so a collapsed category
 *  can hint at the depth inside it without the user expanding first. */
export function categoriesWithDepth(coverage: Coverage): Set<string> {
  const ids = new Set<string>();
  for (const entry of coverage.specialized) {
    const node = resolveCovered(entry.taxonomy_id);
    if (node) ids.add(`${node.worldId}|${node.categoryId}`);
  }
  return ids;
}
