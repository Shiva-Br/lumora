export type DecisionWorld = {
  id: string;
  /** Official name, used in breadcrumbs and workspace titles. */
  name: string;
  /** Short label, used wherever space is tight — cards, sidebar rows. */
  display: string;
  description: string;
  /** The world's tone. Drives its card, and the app-wide mood wash on hover. */
  tone: string;
  /** Categories directly under this world. */
  categoryCount: number;
};

export const DECISION_WORLDS: readonly DecisionWorld[] = [
  {
    id: 'phase1',
    name: 'Product Intelligence',
    display: 'Products',
    description:
      'Compare products, understand trade-offs, and choose what truly fits your needs.',
    tone: '#7C9BB4',
    categoryCount: 12,
  },
  {
    id: 'phase2',
    name: 'Physical World & Service Intelligence',
    display: 'Services',
    description:
      'Find and compare trusted services, professionals and local providers.',
    tone: '#7E9AB0',
    categoryCount: 16,
  },
  {
    id: 'phase3',
    name: 'Career Intelligence',
    display: 'Career',
    description:
      'Choose the right career direction, role or professional path for your future.',
    tone: '#E2A64A',
    categoryCount: 28,
  },
  {
    id: 'phase4',
    name: 'Learning Intelligence',
    display: 'Learning',
    description:
      'Choose what to learn, where to learn it, and the right path to reach your goal.',
    tone: '#8E88B4',
    categoryCount: 23,
  },
  {
    id: 'phase5',
    name: 'Travel Intelligence',
    display: 'Travel',
    description:
      'Plan the right destination, experience, route and travel strategy for your needs.',
    tone: '#5F9E93',
    categoryCount: 20,
  },
  {
    id: 'phase6',
    name: 'Beauty & Fashion Intelligence',
    display: 'Beauty & Style',
    description:
      'Make smarter choices for your appearance, personal style, grooming and wardrobe.',
    tone: '#C79BA0',
    categoryCount: 16,
  },
  {
    id: 'phase7',
    name: 'Health, Fitness & Nutrition Intelligence',
    display: 'Health & Fitness',
    description:
      'Build better fitness, nutrition and wellness decisions around your real health context.',
    tone: '#8DA05F',
    categoryCount: 23,
  },
  {
    id: 'phase8',
    name: 'Automotive Intelligence',
    display: 'Automotive',
    description:
      'Choose, own and manage vehicles with clearer cost, safety and value decisions.',
    tone: '#D06E45',
    categoryCount: 21,
  },
  {
    id: 'phase9',
    name: 'Real Estate Intelligence',
    display: 'Real Estate',
    description:
      'Make smarter property, rental, investment and home-related decisions.',
    tone: '#B27EA0',
    categoryCount: 22,
  },
  {
    id: 'phase10',
    name: 'Business Decision Intelligence',
    display: 'Business',
    description:
      'Make stronger decisions for strategy, growth, operations and business performance.',
    tone: '#C8922E',
    categoryCount: 17,
  },
] as const;

export const TOTAL_WORLDS = DECISION_WORLDS.length;

export const TOTAL_CATEGORIES = DECISION_WORLDS.reduce(
  (total, world) => total + world.categoryCount,
  0
);

/**
 * Subcategories across the whole taxonomy. A transcribed total, not derived —
 * the subcategory lists themselves are not in this file.
 */
export const TOTAL_AREAS = 5742;
