'use client';

import * as React from 'react';

import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  type ShellState,
} from './shell-store';

/**
 * Read the App Frame's shell state.
 *
 * Backed by `useSyncExternalStore`, so the first client render reuses the
 * server snapshot and persisted values only land after hydration — the shell
 * can remember a collapsed sidebar without ever mismatching.
 *
 * Actions are plain functions on `@/lib/shell/shell-store`; import them
 * directly rather than pulling them through this hook.
 */
export function useShell(): ShellState {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
