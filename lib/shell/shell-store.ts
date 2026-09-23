/** Which regions are in flow vs. drawers. Mirrors the frame's breakpoints. */
export type ShellLayout =
  /** > 1320px — sidebar and activity panel both in flow. */
  | 'desktop'
  /** 1081–1320px — activity panel is a drawer. */
  | 'laptop'
  /** ≤ 1080px — both are drawers. */
  | 'mobile';

/** The sidebar's collapsible sections, keyed by id. */
export type SidebarSections = Record<string, boolean>;

export type ShellState = {
  /** Sidebar reduced to its icon rail. Persisted. */
  sidebarCollapsed: boolean;
  /** Which sidebar accordions are expanded. Persisted. */
  sidebarSections: SidebarSections;

  atlasOpen: Record<string, boolean>;
  /** Activity panel closed to its rail. Persisted. */
  activityCollapsed: boolean;
  /** Sidebar drawer open. Only reachable on `mobile`. */
  sideDrawerOpen: boolean;
  /** Activity drawer open. Only reachable on `mobile` and `laptop`. */
  activityDrawerOpen: boolean;

  mood: string | null;
  layout: ShellLayout;
};

const STORAGE_KEY = 'lumora.shell.v1';

const MOBILE_MAX = 1080;
const LAPTOP_MAX = 1320;

const DEFAULT_SECTIONS: SidebarSections = {
  atlas: false,
  pinned: false,
  mydecisions: false,
  collections: false,
  recent: false,
};

const INITIAL: ShellState = {
  sidebarCollapsed: false,
  sidebarSections: DEFAULT_SECTIONS,
  atlasOpen: {},
  activityCollapsed: false,
  sideDrawerOpen: false,
  activityDrawerOpen: false,
  mood: null,

  layout: 'desktop',
};

let state: ShellState = INITIAL;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Persisted subset. Drawer and mood state is per-visit, not remembered. */
type PersistedShellState = Pick<
  ShellState,
  'sidebarCollapsed' | 'sidebarSections' | 'atlasOpen' | 'activityCollapsed'
>;

function persist() {
  try {
    const saved: PersistedShellState = {
      sidebarCollapsed: state.sidebarCollapsed,
      sidebarSections: state.sidebarSections,
      atlasOpen: state.atlasOpen,
      activityCollapsed: state.activityCollapsed,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Private mode or a full quota: the shell still works, it just forgets.
  }
}

function readPersisted(): Partial<ShellState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const { sidebarCollapsed, activityCollapsed, sidebarSections, atlasOpen } =
      parsed as Partial<PersistedShellState>;
    return {
      ...(typeof sidebarCollapsed === 'boolean' ? { sidebarCollapsed } : {}),
      ...(typeof activityCollapsed === 'boolean' ? { activityCollapsed } : {}),
      // Merged over the defaults, so a section added in a later release
      // still opens as designed for someone with an older stored value.
      ...(sidebarSections && typeof sidebarSections === 'object'
        ? { sidebarSections: { ...DEFAULT_SECTIONS, ...sidebarSections } }
        : {}),
      ...(atlasOpen && typeof atlasOpen === 'object' ? { atlasOpen } : {}),
    };
  } catch {
    return {};
  }
}

function measureLayout(): ShellLayout {
  const w = window.innerWidth;
  if (w <= MOBILE_MAX) return 'mobile';
  if (w <= LAPTOP_MAX) return 'laptop';
  return 'desktop';
}

/**
 * Apply a patch. Bails when nothing actually changed so `getSnapshot` keeps
 * returning a referentially stable object — the contract
 * `useSyncExternalStore` needs to avoid re-rendering forever.
 */
function set(patch: Partial<ShellState>, options?: { persist?: boolean }) {
  let changed = false;
  for (const key of Object.keys(patch) as (keyof ShellState)[]) {
    if (patch[key] !== undefined && patch[key] !== state[key]) {
      changed = true;
      break;
    }
  }
  if (!changed) return;

  state = { ...state, ...patch };
  if (options?.persist) persist();
  emit();
}

/**
 * A layout change can strand a drawer: shrinking to mobile and back would
 * otherwise leave `sideDrawerOpen` set behind an in-flow sidebar, where
 * nothing can close it. Reconcile on every transition.
 */
function applyLayout(layout: ShellLayout) {
  set({
    layout,
    ...(layout !== 'mobile' ? { sideDrawerOpen: false } : {}),
    ...(layout === 'desktop' ? { activityDrawerOpen: false } : {}),
  });
}

let hydrated = false;

/** Runs once, on the first subscriber — i.e. after hydration. */
function hydrate() {
  if (hydrated) return;
  hydrated = true;
  set({ ...readPersisted(), layout: measureLayout() });
}

let resizeTimer: ReturnType<typeof setTimeout> | undefined;

function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => applyLayout(measureLayout()), 150);
}

export function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    hydrate();
    window.addEventListener('resize', onResize);
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
    }
  };
}

export function getSnapshot(): ShellState {
  return state;
}

export function getServerSnapshot(): ShellState {
  return INITIAL;
}

/* ---------------------------------------------------------------------
   Actions
   ------------------------------------------------------------------- */

export function toggleSidebarCollapsed() {
  set({ sidebarCollapsed: !state.sidebarCollapsed }, { persist: true });
}

export function setSidebarCollapsed(collapsed: boolean) {
  set({ sidebarCollapsed: collapsed }, { persist: true });
}

/** Expand or fold one of the sidebar's sections. */
export function toggleSidebarSection(id: string) {
  set(
    {
      sidebarSections: {
        ...state.sidebarSections,
        [id]: !state.sidebarSections[id],
      },
    },
    { persist: true }
  );
}

/** Expand or fold a Decision Worlds tree node (world or category). */
export function toggleAtlasNode(key: string) {
  set(
    { atlasOpen: { ...state.atlasOpen, [key]: !state.atlasOpen[key] } },
    { persist: true }
  );
}

/**
 * Close the activity panel. Below 1320px the panel is a drawer, so the same
 * gesture closes the drawer instead of persisting a collapsed column.
 */
export function collapseActivity() {
  if (state.layout !== 'desktop' && state.activityDrawerOpen) {
    set({ activityDrawerOpen: false });
    return;
  }
  set({ activityCollapsed: true }, { persist: true });
}

/** Reopen the activity panel — from the rail, or when work starts. */
export function openActivity() {
  if (state.layout === 'desktop') {
    set({ activityCollapsed: false }, { persist: true });
    return;
  }
  // As a drawer it must also stop being "collapsed", or closing the drawer
  // would drop it back to a rail-only state on the next desktop render.
  set(
    { activityCollapsed: false, activityDrawerOpen: true },
    { persist: true }
  );
}

export function openSideDrawer() {
  set({ sideDrawerOpen: true });
}

export function closeSideDrawer() {
  set({ sideDrawerOpen: false });
}

export function toggleSideDrawer() {
  set({ sideDrawerOpen: !state.sideDrawerOpen });
}

export function closeDrawers() {
  set({ sideDrawerOpen: false, activityDrawerOpen: false });
}

/** Bend the app toward a world's tone, or pass `null` to return to gold. */
export function setMood(mood: string | null) {
  set({ mood });
}
