// Browser-side auth actions. The login modal calls these; it never touches the
// Supabase client directly.
//
// One consistent Email OTP flow serves both registration and login
// (`shouldCreateUser: true`), so the UI never has to know — and never reveals —
// whether an address already has an account.
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { toAuthFailure, type AuthFailure } from './errors';

export type AuthActionResult =
  { ok: true } | { ok: false; failure: AuthFailure };

export type OAuthProvider = 'google' | 'apple';

/** Where the provider (and the OTP email link) sends the browser back to. */
function callbackUrl(next: string): string {
  const url = new URL('/auth/callback', window.location.origin);
  url.searchParams.set('next', next);
  return url.toString();
}

/** Step 1 — email the user a 6-digit code. Creates the account if it's new. */
export async function sendEmailOtp(
  email: string,
  next = '/'
): Promise<AuthActionResult> {
  const supabase = createSupabaseBrowserClient();
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: callbackUrl(next),
      },
    });
    if (error) return { ok: false, failure: toAuthFailure(error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, failure: toAuthFailure(error) };
  }
}

/** Step 2 — verify the 6-digit code. `type: 'email'` is the passwordless OTP type. */
export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<AuthActionResult> {
  const supabase = createSupabaseBrowserClient();
  try {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) return { ok: false, failure: toAuthFailure(error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, failure: toAuthFailure(error) };
  }
}

/**
 * Start a Google/Apple redirect. On success the browser navigates away, so this
 * only returns when the redirect could not be started.
 */
export async function signInWithProvider(
  provider: OAuthProvider,
  next = '/'
): Promise<AuthActionResult> {
  const supabase = createSupabaseBrowserClient();
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl(next),
      },
    });
    if (error) return { ok: false, failure: toAuthFailure(error, 'provider') };
    return { ok: true };
  } catch (error) {
    return { ok: false, failure: toAuthFailure(error, 'provider') };
  }
}
