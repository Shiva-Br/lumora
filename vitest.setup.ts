import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Testing Library does not unmount between tests on its own here (globals mode
// with no auto-cleanup), and a leaked tree makes the NEXT test's queries match
// the previous test's DOM — which fails in a way that points at the wrong test.
afterEach(cleanup);

// jsdom implements no media queries at all, so anything reading the OS motion
// preference throws on mount. The stub reports "no preference" (full motion),
// which is the honest default: a test environment has no OS setting to report,
// and defaulting to "reduce" would silently exercise the degraded path
// everywhere and hide motion bugs.
//
// Tests that care about the OS saying "reduce" override this per-case.
type MediaListener = (e: MediaQueryListEvent) => void;

function stubMatchMedia(matches = false) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string): MediaQueryList => {
      const listeners = new Set<MediaListener>();
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: (_: string, l: MediaListener) =>
          void listeners.add(l),
        removeEventListener: (_: string, l: MediaListener) =>
          void listeners.delete(l),
        addListener: (l: MediaListener) => void listeners.add(l),
        removeListener: (l: MediaListener) => void listeners.delete(l),
        dispatchEvent: () => true,
      } as unknown as MediaQueryList;
    })
  );
}

// jsdom ships no ResizeObserver, and anything that measures its own layout —
// the thread's stick-to-bottom scroller among them — constructs one on mount.
// Without this, rendering those components throws before a single assertion
// runs. The stub observes nothing, which is honest: jsdom performs no layout,
// so there is no resize to report.
// Assigned directly rather than through vi.stubGlobal: a test that stubs its
// own global and then calls vi.unstubAllGlobals() would otherwise take this one
// with it, and every later render in that file dies on a missing
// ResizeObserver — a failure whose stack points at React, not at the test that
// caused it.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
    ResizeObserverStub;
}

HTMLCanvasElement.prototype.getContext = (() =>
  null) as unknown as HTMLCanvasElement['getContext'];

beforeEach(() => stubMatchMedia(false));

/** Let a test say "the operating system asks for reduced motion". */
export function setOsReducedMotion(matches: boolean) {
  stubMatchMedia(matches);
}
