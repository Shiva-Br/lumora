// Supabase client for Server Components, Route Handlers, and Server Functions.
//
// Reads the session from request cookies. Writing cookies is only allowed in a
// Route Handler / Server Function — from a Server Component the `setAll` call
// throws, which is safe to swallow because the proxy already refreshes the
// session cookie on every request.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — ignore. The proxy is
          // responsible for persisting refreshed session cookies.
        }
      },
    },
  });
}
