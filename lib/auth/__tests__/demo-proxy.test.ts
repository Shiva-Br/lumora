import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/mode', () => ({
  IS_DEMO_AUTH: true,
  IS_LOCAL_AUTH: false,
}));

import { proxy } from '@/proxy';

describe('demo backend isolation', () => {
  it.each([
    '/api/me',
    '/api/auth/login',
    '/api/conversations/start',
    '/api/me/preferences',
    '/auth/callback',
  ])('rejects %s even with a real-session cookie', async (path) => {
    const request = new NextRequest(`http://localhost${path}`, {
      headers: { cookie: 'lumora_session=previous-real-session' },
    });
    const response = await proxy(request);
    expect(response.status).toBe(403);
    expect((await response.json()).success).toBe(false);
  });

  it('allows the UI shell without creating authentication cookies', async () => {
    const response = await proxy(new NextRequest('http://localhost/'));
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
