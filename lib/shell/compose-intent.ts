// A one-shot "land ready to type" intent for the Home composer.
//
// "+ New Decision" on other screens routes to `/`, but App Router pages
// remount per URL segment, so no component state can carry the intent
// across that navigation. The sender arms this flag right before routing;
// Home consumes it once on mount and hands focus to the composer.
// sessionStorage (not localStorage): the intent must not outlive the tab.

const KEY = 'lumora.compose.intent';

export function armComposeFocus(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Storage can be unavailable (private mode); the click still navigates.
  }
}

/** True exactly once per armed intent. */
export function takeComposeFocus(): boolean {
  try {
    if (sessionStorage.getItem(KEY) !== '1') return false;
    sessionStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
