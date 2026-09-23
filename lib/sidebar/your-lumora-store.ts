export type PinKind = 'world' | 'category' | 'subcategory';

export type PinnedItem = {
  kind: PinKind;
  worldId: string;
  catId?: string;
  sub?: string;
  /** Official label at pin time (world/category/sub name). */
  label: string;
  /** User rename (double-click). Falls back to `label` when unset. */
  alias?: string;
};

export type Collection = {
  name: string;
  /** Item payloads arrive with the workspace surfaces; the count shows now. */
  items: unknown[];
};

export type YourLumoraState = {
  pinned: PinnedItem[];
  collections: Collection[];
};

const STORAGE_KEY = 'lumora.your.v1';

const INITIAL: YourLumoraState = { pinned: [], collections: [] };

let state: YourLumoraState = INITIAL;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota: pins still work, they just forget.
  }
}

function readPersisted(): YourLumoraState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return INITIAL;
    const { pinned, collections } = parsed as Partial<YourLumoraState>;
    return {
      pinned: Array.isArray(pinned) ? pinned : [],
      collections: Array.isArray(collections) ? collections : [],
    };
  } catch {
    return INITIAL;
  }
}

function set(next: YourLumoraState) {
  state = next;
  persist();
  emit();
}

let hydrated = false;

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  const persisted = readPersisted();
  if (persisted.pinned.length || persisted.collections.length) {
    state = persisted;
    emit();
  }
}

export function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) hydrate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): YourLumoraState {
  return state;
}

export function getServerSnapshot(): YourLumoraState {
  return INITIAL;
}

/* ---------------------------------------------------------------------
   Actions
   ------------------------------------------------------------------- */

/** One key per taxonomy node, so a pin toggles rather than duplicates. */
export function pinKey(item: PinnedItem): string {
  return [item.kind, item.worldId, item.catId ?? '', item.sub ?? ''].join('|');
}

export function isPinned(item: PinnedItem): boolean {
  const key = pinKey(item);
  return state.pinned.some((p) => pinKey(p) === key);
}

export function togglePin(item: PinnedItem) {
  const key = pinKey(item);
  const index = state.pinned.findIndex((p) => pinKey(p) === key);
  const pinned =
    index >= 0
      ? state.pinned.filter((_, i) => i !== index)
      : [...state.pinned, item];
  set({ ...state, pinned });
}

/** Drag-reorder within the Pinned section. */
export function movePin(from: number, to: number) {
  if (from === to || !state.pinned[from] || !state.pinned[to]) return;
  const pinned = [...state.pinned];
  const [moved] = pinned.splice(from, 1);
  pinned.splice(to, 0, moved);
  set({ ...state, pinned });
}

/** Rename a pinned shortcut. An empty alias restores the official label. */
export function renamePin(index: number, alias: string) {
  const item = state.pinned[index];
  if (!item) return;
  const trimmed = alias.trim();
  const pinned = [...state.pinned];
  pinned[index] = { ...item, alias: trimmed || undefined };
  set({ ...state, pinned });
}

export function addCollection(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  set({
    ...state,
    collections: [...state.collections, { name: trimmed, items: [] }],
  });
}
