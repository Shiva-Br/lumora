// Shared auth/identity types.

export type LumoraProfile = {
  id: string;
  supabase_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  role: string;
  created_at: string;
  updated_at: string;
};

/** Result of provisioning/syncing the user with the Lumora backend. */
export type ProvisionResult =
  { ok: true; profile: LumoraProfile } | { ok: false; error: string };

export type AuthStatus = 'loading' | 'authenticated' | 'guest';

/**
 * Who the caller is, normalized across identity providers: the Supabase user
 * and the local pilot account both reduce to this. `id` is the stable account
 * key the UI may use as a cache owner; it is never sent to the backend, which
 * derives identity from the bearer token alone.
 */
export type AuthIdentity = {
  id: string;
  email: string | null;
  displayName: string | null;
};
