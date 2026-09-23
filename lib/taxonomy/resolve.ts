// Lumora — resolve a backend category name onto the Decision Worlds taxonomy.
//
// The conversation backend names its category ("Laptop", "Smartphone", …) but
// does not send world or breadcrumb data; the taxonomy is fixed and shipped
// with the app, so the world skin is resolved client-side: the category name
// is matched against the 5,742 specialized areas and 198 categories, most
// specific first. No match → no world skin, never a guess.

import atlasData from './atlas-data.json';
import { DECISION_WORLDS, type DecisionWorld } from './worlds';

import type { AtlasCategory } from './atlas';

export type WorldContext = {
  world: DecisionWorld;
  /** Stable taxonomy id, e.g. `VK-02`. */
  categoryId?: string;
  /** Taxonomy category name, e.g. "PC & Computing". */
  category?: string;
  /** Specialized area, e.g. "Laptops". */
  sub?: string;
  /** Named runtime expert from taxonomy metadata, when available. */
  expert?: string;
};

const ATLAS = atlasData as Record<string, AtlasCategory[]>;

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "laptop" matches "laptops" and vice versa. */
function nameMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b || `${a}s` === b || a === `${b}s`) return true;
  // Containment for compound area names ("earbuds" → "audio devices
  // (earbuds & headphones)") — both sides at least a word long.
  return a.length >= 4 && b.length >= 4 && (b.includes(a) || a.includes(b));
}

function tokens(value: string): string[] {
  return value.split(' ').filter((t) => t.length >= 3);
}

/** Singular/plural-insensitive token overlap count. */
function sharedTokens(a: string[], b: string[]): number {
  return a.filter((t) =>
    b.some((u) => t === u || `${t}s` === u || t === `${u}s`)
  ).length;
}

/**
 * Match a backend category name to the taxonomy. Three tiers, most exact
 * first; within a tier, specialized areas win over categories and taxonomy
 * order breaks ties:
 *   1. whole-name match (plural-insensitive, containment),
 *   2. token overlap — at least half the name's words appear in the target
 *      ("Wireless Earbuds" → "Audio Devices (Earbuds & Headphones)").
 */
export function resolveWorldContext(name: string): WorldContext | null {
  const needle = norm(name);
  if (!needle) return null;

  for (const world of DECISION_WORLDS) {
    for (const category of ATLAS[world.id] ?? []) {
      for (const sub of category.subs) {
        if (nameMatch(needle, norm(sub))) {
          return {
            world,
            categoryId: category.id,
            category: category.name,
            sub,
            expert: category.expert,
          };
        }
      }
    }
  }
  for (const world of DECISION_WORLDS) {
    for (const category of ATLAS[world.id] ?? []) {
      if (nameMatch(needle, norm(category.name))) {
        return {
          world,
          categoryId: category.id,
          category: category.name,
          expert: category.expert,
        };
      }
    }
  }

  const needleTokens = tokens(needle);
  if (needleTokens.length === 0) return null;
  const minShared = Math.ceil(needleTokens.length / 2);
  let best: { context: WorldContext; shared: number } | null = null;
  for (const world of DECISION_WORLDS) {
    for (const category of ATLAS[world.id] ?? []) {
      for (const sub of category.subs) {
        const shared = sharedTokens(needleTokens, tokens(norm(sub)));
        if (shared >= minShared && shared > (best?.shared ?? 0)) {
          best = {
            context: {
              world,
              categoryId: category.id,
              category: category.name,
              sub,
              expert: category.expert,
            },
            shared,
          };
        }
      }
      const shared = sharedTokens(needleTokens, tokens(norm(category.name)));
      if (shared >= minShared && shared > (best?.shared ?? 0)) {
        best = {
          context: {
            world,
            categoryId: category.id,
            category: category.name,
            expert: category.expert,
          },
          shared,
        };
      }
    }
  }
  return best?.context ?? null;
}
