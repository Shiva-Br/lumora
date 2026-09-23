// Supabase session refresh for the Next.js proxy (Next 16's renamed middleware).
//
// `getUser()` revalidates the access token and, when it is close to expiry,
// transparently refreshes it. The refreshed cookies must be copied onto the
// outgoing response or the browser would keep the stale pair.
//
// This deliberately does NOT gate any route: Lumora is usable as a guest and
// authentication is enforced at prompt submission, not by navigation.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}
