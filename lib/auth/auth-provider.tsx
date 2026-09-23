'use client';

// Session state for the whole app.
//
// It serves both identity providers behind one shape (see lib/auth/mode.ts):
//
//   local    — there is no client-side session library at all. The token lives
//              in an httpOnly cookie the browser cannot read, so "am I signed
//              in?" is answered by asking the server: /api/me either returns a
//              profile or 401s.
//   supabase — the original flow: supabase-js owns the cookie-backed session
//              and fires onAuthStateChange on sign-in, sign-out and refresh.
//
// Either way nothing here reads or stores a token.
import * as React from 'react';

import { DEMO_PROFILE, demoSignedIn, signOutDemo } from './demo';
import { AUTH_MODE, IS_LOCAL_AUTH, IS_DEMO_AUTH } from './mode';

import type {
  AuthIdentity,
  AuthStatus,
  ProvisionResult,
  LumoraProfile,
} from './types';

type AuthContextValue = {
  status: AuthStatus;
  /** Who the caller is, normalized across providers. Null when signed out. */
  identity: AuthIdentity | null;
  profile: LumoraProfile | null;
  /** Calls the server-side `/api/me` handler, which provisions/syncs the user. */
  provision: () => Promise<ProvisionResult>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

/** The identity a provisioned backend profile describes. */
function identityFromProfile(profile: LumoraProfile): AuthIdentity {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.first_name,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthStatus>('loading');
  const [identity, setIdentity] = React.useState<AuthIdentity | null>(null);
  const [profile, setProfile] = React.useState<LumoraProfile | null>(null);

  const provision = React.useCallback(async (): Promise<ProvisionResult> => {
    if (IS_DEMO_AUTH) {
      if (!demoSignedIn())
        return { ok: false, error: 'Sign in to the demo first.' };
      setProfile(DEMO_PROFILE);
      setIdentity(identityFromProfile(DEMO_PROFILE));
      return { ok: true, profile: DEMO_PROFILE };
    }
    try {
      const response = await fetch('/api/me', { cache: 'no-store' });

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const error =
          typeof body === 'object' &&
          body !== null &&
          typeof (body as { error?: unknown }).error === 'string'
            ? (body as { error: string }).error
            : 'We could not finish setting up your account.';
        return { ok: false, error };
      }

      const body = (await response.json()) as { profile: LumoraProfile };
      setProfile(body.profile);
      setIdentity((current) => current ?? identityFromProfile(body.profile));
      return { ok: true, profile: body.profile };
    } catch {
      return {
        ok: false,
        error: 'We could not reach Lumora. Check your connection and retry.',
      };
    }
  }, []);

  // Local mode: one round trip decides everything. A 401 means signed out,
  // which under the proxy gate only happens on the login page itself.
  React.useEffect(() => {
    if (!IS_LOCAL_AUTH && !IS_DEMO_AUTH) return;
    let active = true;

    void (async () => {
      const result = await provision();
      if (!active) return;
      if (result.ok) {
        setIdentity(identityFromProfile(result.profile));
        setStatus('authenticated');
      } else {
        setIdentity(null);
        setProfile(null);
        setStatus('guest');
        if (IS_DEMO_AUTH && window.location.pathname !== '/login') {
          window.location.replace('/login');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [provision]);

  // Supabase mode: mirror the library's session into our normalized shape.
  React.useEffect(() => {
    if (IS_LOCAL_AUTH || IS_DEMO_AUTH) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const { createSupabaseBrowserClient } =
        await import('@/lib/supabase/client');
      const supabase = createSupabaseBrowserClient();
      if (!active) return;

      const apply = (user: { id: string; email?: string } | null) => {
        setIdentity(
          user
            ? { id: user.id, email: user.email ?? null, displayName: null }
            : null
        );
        setStatus(user ? 'authenticated' : 'guest');
        if (!user) setProfile(null);
      };

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      apply(session?.user ?? null);

      // Fires on sign-in, sign-out, and every token refresh.
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        apply(next?.user ?? null);
      });
      unsubscribe = () => subscription.unsubscribe();
    })();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const signOut = React.useCallback(async () => {
    if (IS_DEMO_AUTH) {
      signOutDemo();
      window.location.href = '/login';
      return;
    }
    if (IS_LOCAL_AUTH) {
      await fetch('/api/auth/logout', { method: 'POST' });
      // A hard navigation, not a router push: it drops every cached client
      // store (conversation list, composer drafts) along with the session,
      // which is exactly what signing out should mean.
      window.location.href = '/login';
      return;
    }
    const { createSupabaseBrowserClient } =
      await import('@/lib/supabase/client');
    await createSupabaseBrowserClient().auth.signOut();
    // onAuthStateChange clears identity/profile; the app stays usable as a guest.
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, identity, profile, provision, signOut }),
    [status, identity, profile, provision, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}

export { AUTH_MODE };
