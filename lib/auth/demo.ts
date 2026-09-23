import type { LumoraProfile } from './types';

// Public preview credentials, not a secret or a real account.
export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = 'Lumora123!';
const KEY = 'lumora.demo.session';

export function demoSignedIn(): boolean {
  return (
    typeof window !== 'undefined' && sessionStorage.getItem(KEY) === 'active'
  );
}

export function signInDemo(username: string, password: string): boolean {
  if (username.trim() !== DEMO_USERNAME || password !== DEMO_PASSWORD)
    return false;
  sessionStorage.setItem(KEY, 'active');
  return true;
}

export function signOutDemo(): void {
  sessionStorage.removeItem(KEY);
}

export const DEMO_PROFILE: LumoraProfile = {
  id: 'lumora-demo',
  supabase_id: '',
  first_name: 'Demo',
  last_name: 'User',
  avatar_url: null,
  email: 'demo@example.com',
  phone: null,
  email_verified: false,
  phone_verified: false,
  role: 'user',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
