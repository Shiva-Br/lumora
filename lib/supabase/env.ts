// Frontend-safe Supabase configuration.
//
// Only NEXT_PUBLIC_* values live here — they are compiled into the browser
// bundle by design (the publishable key is public). The JWT secret and any
// service-role key are backend-only and must never appear in this file or in
// any NEXT_PUBLIC_* variable.
import { IS_LOCAL_AUTH, IS_DEMO_AUTH } from '@/lib/auth/mode';

function required(name: string, value: string | undefined): string {
  if (!value) {
    // In local-auth mode Supabase is genuinely not configured and never
    // contacted, so importing this module must not blow up the app. Any code
    // path that actually builds a client would then fail loudly at the call,
    // which is the correct place for that error to appear.
    if (IS_LOCAL_AUTH || IS_DEMO_AUTH) return '';
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in.`
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL
);

export const SUPABASE_PUBLISHABLE_KEY = required(
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);
