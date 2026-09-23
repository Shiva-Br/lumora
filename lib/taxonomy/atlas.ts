import atlasData from './atlas-data.json';
import { DECISION_WORLDS } from './worlds';

export type AtlasCategory = {
  /** Stable category id (`VK-01`, `VS-03`, …). */
  id: string;
  name: string;
  /** Specialized areas under this category. */
  subs: string[];
  /** Named Expert for this category, when the source defines one. */
  expert?: string;
};

const ATLAS = atlasData as Record<string, AtlasCategory[]>;

/** Categories under one world, in taxonomy order. */
export function categoriesOf(worldId: string): AtlasCategory[] {
  return ATLAS[worldId] ?? [];
}

/**
 * "Product Intelligence / Mobile & Smartphones / Smartphones" — the official
 * breadcrumb for a taxonomy node, used as the hover title on pinned rows
 * and subcategory leaves.
 */
export function officialCrumb(
  worldId: string,
  catId?: string,
  sub?: string
): string {
  const world = DECISION_WORLDS.find((w) => w.id === worldId);
  let crumb = world?.name ?? worldId;
  if (catId) {
    const cat = categoriesOf(worldId).find((c) => c.id === catId);
    if (cat) crumb += ' / ' + cat.name;
  }
  if (sub) crumb += ' / ' + sub;
  return crumb;
}
