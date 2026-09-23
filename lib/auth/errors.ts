import { AuthError } from '@supabase/supabase-js';

export type AuthFailureKind =
  | 'invalid_otp'
  | 'expired_otp'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'offline'
  | 'network'
  | 'unknown';

export type AuthFailure = {
  kind: AuthFailureKind;
  /** Seconds the caller should wait before retrying, when the API told us. */
  retryAfterSeconds?: number;
};

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function authFailure(kind: AuthFailureKind): AuthFailure {
  return { kind };
}

/**
 * Where the error came from. The same GoTrue code means different things per
 * flow: `validation_failed` on a code submission is a bad code, but on a
 * provider button it is a provider the project has not enabled — telling that
 * user to check their digits would be nonsense.
 */
export type AuthContext = 'otp' | 'provider';

export function toAuthFailure(
  error: unknown,
  context: AuthContext = 'otp'
): AuthFailure {
  if (isOffline()) return authFailure('offline');

  if (error instanceof AuthError) {
    if (context === 'provider') {
      const message = error.message.toLowerCase();
      if (
        error.code === 'provider_disabled' ||
        error.code === 'validation_failed' ||
        message.includes('provider is not enabled') ||
        message.includes('unsupported provider')
      ) {
        return authFailure('provider_unavailable');
      }
    }

    switch (error.code) {
      case 'otp_expired':
        return authFailure('expired_otp');
      case 'over_email_send_rate_limit':
      case 'over_request_rate_limit':
      case 'over_sms_send_rate_limit':
        return authFailure('rate_limited');
      case 'validation_failed':
      case 'otp_disabled':
        return authFailure('invalid_otp');
    }

    if (error.status === 429) return authFailure('rate_limited');
    // GoTrue answers a wrong code with 401/403.
    if (error.status === 401 || error.status === 403) {
      return authFailure('invalid_otp');
    }
    // supabase-js surfaces fetch failures as AuthRetryableFetchError (status 0).
    if (!error.status) return authFailure('network');
    return authFailure('unknown');
  }

  if (error instanceof TypeError) return authFailure('network');

  return authFailure('unknown');
}
