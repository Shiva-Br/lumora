// Which identity provider the app is running on.
//
// 'local'    — the closed pilot: ten fixed accounts sign in with a username and
//              a password at /login, and the backend issues the session token.
//              Supabase is not contacted at all, so its env vars are optional.
// 'supabase' — the original hosted flow (email OTP + OAuth), guest-browsable.
//
// One value, readable on both sides of the render boundary, so the server
// (proxy gate, token attach) and the client (provider, login UI) can never
// disagree about which flow is live. It is not a secret: NEXT_PUBLIC_ by design.
export type AuthMode = 'local' | 'supabase' | 'demo';

export const AUTH_MODE: AuthMode =
  process.env.NEXT_PUBLIC_AUTH_MODE === 'demo'
    ? 'demo'
    : process.env.NEXT_PUBLIC_AUTH_MODE === 'supabase'
      ? 'supabase'
      : 'local';

export const IS_LOCAL_AUTH = AUTH_MODE === 'local';

/** UI-only sandbox; never accepted as backend authentication. */
export const IS_DEMO_AUTH = AUTH_MODE === 'demo';
