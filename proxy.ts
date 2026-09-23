// Next.js 16 proxy (the renamed `middleware` convention).
//
// What it does depends on which identity provider is live:
//
//   local    — the closed pilot has no guest mode, because there is no way to
//              sign up: the ten accounts are the whole audience. So this gates
//              the app, redirecting anyone without a session cookie to /login
//              and bouncing anyone with one away from /login.
//   supabase — the original behaviour: refresh the session cookie and never
//              redirect, because Lumora is browsable as a guest and gates on
//              prompt submission instead.
import { NextResponse } from 'next/server';

import { IS_LOCAL_AUTH, IS_DEMO_AUTH } from '@/lib/auth/mode';
import { SESSION_COOKIE } from '@/lib/auth/session-cookie';

import type { NextRequest } from 'next/server';

/** Reachable without a session: the login page and the routes that create one. */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Demo sessions exist only in the browser. Never forward demo API traffic,
  // even if this browser still has a cookie from a real backend session.
  if (IS_DEMO_AUTH) {
    if (pathname.startsWith('/api/') || pathname === '/auth/callback') {
      return NextResponse.json(
        {
          success: false,
          error: 'Backend access is disabled in UI demo mode.',
        },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  if (IS_LOCAL_AUTH) {
    const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

    if (!signedIn && !isPublicPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      // Preserve where they were headed so signing in lands them there, not
      // on a generic home screen.
      url.search =
        pathname === '/'
          ? ''
          : `?next=${encodeURIComponent(pathname + search)}`;
      // API calls get a 401 instead of an HTML redirect: a fetch() following a
      // redirect to a login PAGE would surface as an unparseable response.
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Not authenticated.' },
          { status: 401 }
        );
      }
      return NextResponse.redirect(url);
    }

    if (signedIn && pathname === '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  const { updateSession } = await import('@/lib/supabase/proxy');
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
