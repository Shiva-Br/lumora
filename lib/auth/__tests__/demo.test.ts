import { beforeEach, describe, expect, it } from 'vitest';

import { demoSignedIn, signInDemo, signOutDemo } from '../demo';

beforeEach(() => sessionStorage.clear());

describe('client-only demo session', () => {
  it('rejects incorrect credentials without creating a session', () => {
    expect(signInDemo('demo', 'wrong')).toBe(false);
    expect(signInDemo('other', 'Lumora123!')).toBe(false);
    expect(demoSignedIn()).toBe(false);
  });

  it('keeps the preview session in this tab and clears it on sign-out', () => {
    const cookies = document.cookie;
    expect(signInDemo('demo', 'Lumora123!')).toBe(true);
    expect(demoSignedIn()).toBe(true);
    expect(sessionStorage.getItem('lumora.demo.session')).toBe('active');
    expect(document.cookie).toBe(cookies);
    signOutDemo();
    expect(demoSignedIn()).toBe(false);
  });
});
