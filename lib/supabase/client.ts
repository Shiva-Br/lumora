// Supabase client for Client Components (browser).
//
// `createBrowserClient` from @supabase/ssr keeps the session in cookies rather
// than localStorage, so the same session is readable by Server Components,
// Route Handlers, and the proxy. Tokens are never touched by application code.
import { createBrowserClient } from '@supabase/ssr';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';

export function createSupabaseBrowserClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
