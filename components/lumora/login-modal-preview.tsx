'use client';

// Standalone preview of the Supabase login modal — the previous /login page,
// lifted into its own client component so the page itself can choose between
// this and the local sign-in form without pulling Supabase into local mode.
//
// Not part of the product flow in Supabase mode either: the home screen never
// redirects here. It exists so the modal can be opened and reviewed in
// isolation.
import * as React from 'react';

import { LoginModal } from '@/components/lumora/login-modal';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-provider';
import { useT } from '@/lib/i18n/provider';

export function LoginModalPreview() {
  const t = useT();
  const [open, setOpen] = React.useState(true);
  const { status, identity, signOut } = useAuth();

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {status === 'authenticated' ? (
        <p className="text-sm text-[var(--vk-text-subtle)]">
          Signed in as{' '}
          <span className="font-medium text-[var(--vk-text)]">
            {identity?.email ?? identity?.displayName ?? 'your account'}
          </span>
        </p>
      ) : (
        <p className="text-sm text-[var(--vk-text-muted)]">
          You&rsquo;re signed out.
        </p>
      )}

      {status === 'authenticated' ? (
        <Button onClick={() => void signOut()}>{t('auth.signOut')}</Button>
      ) : (
        <Button onClick={() => setOpen(true)}>{t('auth.openLogin')}</Button>
      )}

      <LoginModal
        open={open}
        onOpenChange={setOpen}
        onAuthenticated={() => setOpen(false)}
      />
    </div>
  );
}
