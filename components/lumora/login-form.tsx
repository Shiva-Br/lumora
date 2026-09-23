'use client';

// The local sign-in form: a username box, a password box, and nothing else.
//
// The password never leaves this component except in the one POST to
// /api/auth/login, which exchanges it for an httpOnly cookie server-side. On
// success the page does a HARD navigation rather than a router push, so the
// whole app re-renders with the new session instead of hydrating around a
// stale "signed out" tree.
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInDemo } from '@/lib/auth/demo';
import { IS_DEMO_AUTH } from '@/lib/auth/mode';
import { useT } from '@/lib/i18n/provider';

/** Only same-origin paths may be redirected to after sign-in. */
function safeNext(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return '/';
  }
  return raw;
}

/**
 * Where to land after signing in. Read from `window.location` at submit time
 * rather than through useSearchParams: that hook would opt this subtree out of
 * server rendering, and the sign-in form appearing only after hydration is a
 * blank screen at the app's front door.
 */
function destination(): string {
  if (typeof window === 'undefined') return '/';
  return safeNext(new URLSearchParams(window.location.search).get('next'));
}

export function LoginForm() {
  const t = useT();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !busy;

  const onSubmit = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!canSubmit) return;

      setBusy(true);
      setError(null);
      try {
        if (IS_DEMO_AUTH) {
          if (!signInDemo(username, password)) {
            setError('Incorrect demo username or password.');
            setPassword('');
            setBusy(false);
            return;
          }
          window.location.href = destination();
          return;
        }
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password }),
        });

        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          const message =
            typeof body === 'object' &&
            body !== null &&
            typeof (body as { error?: unknown }).error === 'string'
              ? (body as { error: string }).error
              : 'Incorrect username or password.';
          setError(message);
          setPassword('');
          setBusy(false);
          return;
        }

        window.location.href = destination();
      } catch {
        setError(
          'Could not reach Lumora. Check your connection and try again.'
        );
        setBusy(false);
      }
    },
    [canSubmit, password, username]
  );

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm rounded-2xl border border-[var(--vk-border)] bg-[var(--vk-surface)] p-8 shadow-lg"
    >
      <h1 className="text-xl font-semibold text-[var(--vk-text)]">
        {t('auth.signIn')}
      </h1>
      <p className="mt-1 text-sm text-[var(--vk-text-muted)]">
        {IS_DEMO_AUTH
          ? 'UI demo only — chat and research require a connected backend.'
          : 'Enter the username and password you were given.'}
      </p>

      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">{t('auth.username')}</Label>
          <Input
            id="username"
            name="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            required
            disabled={busy}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.password')}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            disabled={busy}
          />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-[var(--vk-danger-soft,rgba(220,38,38,0.12))] px-3 py-2 text-sm text-[var(--vk-danger,#f87171)]"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" className="mt-6 w-full" disabled={!canSubmit}>
        {busy ? t('auth.signingIn') : t('auth.signIn')}
      </Button>
    </form>
  );
}
