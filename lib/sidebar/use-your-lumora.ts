'use client';

import * as React from 'react';

import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  type YourLumoraState,
} from './your-lumora-store';

/**
 * Read the "Your LUMORA" sidebar state (pinned shortcuts, collections).
 *
 * Backed by `useSyncExternalStore`; persisted values only land after
 * hydration, so a stored pin list can never cause a mismatch. Actions are
 * plain functions on `@/lib/sidebar/your-lumora-store`.
 */
export function useYourLumora(): YourLumoraState {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
