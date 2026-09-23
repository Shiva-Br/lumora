'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { AppSidebar } from '@/components/lumora/app-sidebar';
import { GeneralConversation } from '@/components/lumora/home/general-conversation';
import {
  HomeElevator,
  rideDuration,
  useHomeElevator,
} from '@/components/lumora/home/home-elevator';
import { PortalHero } from '@/components/lumora/home/portal-hero';
import { WorldsLevel } from '@/components/lumora/home/worlds-level';
import { LoginModal } from '@/components/lumora/login-modal';
import { ActivityIdle } from '@/components/lumora/shell/activity-idle';
import { ActivityRegion } from '@/components/lumora/shell/activity-region';
import { AppFrame } from '@/components/lumora/shell/app-frame';
import {
  deleteConversation,
  formatRelativeTime,
  renameConversation,
} from '@/lib/api/conversations';
import { useAuth } from '@/lib/auth/auth-provider';
import { accountFrom, GUEST_ACCOUNT } from '@/lib/auth/identity';
import { disarmPendingPrompt } from '@/lib/auth/pending-prompt';
import { usePromptGate } from '@/lib/auth/use-prompt-gate';
import { useChatHistory } from '@/lib/conversation/chat-history-provider';
import { useT } from '@/lib/i18n/provider';
import { takeComposeFocus } from '@/lib/shell/compose-intent';
import { closeDrawers } from '@/lib/shell/shell-store';

const AUTH_ERROR_COPY: Record<string, string> = {
  cancelled:
    'Sign-in was cancelled. Your prompt is still here — send it when you are ready.',
  failed:
    'We could not complete sign-in. Your prompt is still here — try again.',
};

const noticeAction =
  'cursor-pointer rounded-[6px] px-2 py-0.5 font-medium text-[var(--vk-text-subtle)] underline decoration-[rgba(150,178,205,0.35)] underline-offset-2 transition-colors hover:text-[var(--vk-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vk-accent-ring)]';

export function Home() {
  const t = useT();
  const { status, identity, profile, signOut } = useAuth();

  // The sidebar's conversations come from the root layout's shared cache
  // (also used by the chat screens), so crossing Home ↔ /chat/* never drops
  // the list. Guests see none — this screen stays fully browsable signed out.
  const { conversations, refresh: refreshConversations } = useChatHistory();
  const {
    message,
    setMessage,
    submit,
    busy,
    resuming,
    error,
    retry,
    loginOpen,
    setLoginModalOpen,
    handleAuthenticated,
  } = usePromptGate();

  // The OAuth callback reports provider cancellation/failure as a coarse,
  // non-sensitive query flag. Read it straight from the URL rather than copying
  // it into state, and let the user dismiss it by cleaning the URL.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const authError = searchParams.get('auth_error');
  const authErrorMessage = authError
    ? (AUTH_ERROR_COPY[authError] ?? AUTH_ERROR_COPY.failed)
    : null;

  // They backed out of the provider, so cancel the automatic submission. The
  // prompt text itself is kept — only the intent is dropped.
  React.useEffect(() => {
    if (authError) disarmPendingPrompt();
  }, [authError]);

  const authenticated = status === 'authenticated';
  const account = accountFrom(identity, profile) ?? GUEST_ACCOUNT;

  // "Start a Decision" on Level 2 rides up and hands focus to this field.
  const composerRef = React.useRef<HTMLTextAreaElement>(null);

  const { level, goLevel, isLocked } = useHomeElevator();

  // Land on Level 1 with the composer live — "+ New Decision", the idle
  // panel's "Start with any decision", and Level 2's "Start a Decision"
  // all funnel through here.
  const startTyping = () => {
    closeDrawers();
    const delay = level === 1 ? 0 : rideDuration() + 20;
    goLevel(1);
    setTimeout(
      () => composerRef.current?.focus({ preventScroll: true }),
      delay
    );
  };

  // "+ New Decision" clicked on another screen: the sender armed this
  // one-shot before routing here (state cannot cross the remount).
  React.useEffect(() => {
    if (takeComposeFocus()) composerRef.current?.focus({ preventScroll: true });
  }, []);

  // Resume status: sending the preserved prompt, or a recoverable failure.
  // The prompt stays in the composer either way.
  const notices = (
    <>
      {resuming && (
        <span className="text-[var(--vk-text-muted)]">
          Signing you in and sending your prompt…
        </span>
      )}

      {!resuming && error && (
        <>
          <span role="alert" className="text-[var(--vk-danger)]">
            {error}
          </span>
          <button type="button" onClick={retry} className={noticeAction}>
            Retry
          </button>
        </>
      )}

      {!resuming && !error && authErrorMessage && (
        <>
          <span role="alert" className="text-[var(--vk-text-muted)]">
            {authErrorMessage}
          </span>
          <button
            type="button"
            onClick={() => router.replace(pathname)}
            className={noticeAction}
          >
            Dismiss
          </button>
        </>
      )}
    </>
  );

  return (
    <>
      <AppFrame
        sidebar={
          // `fill`: the frame's left track is the width authority. The
          // sidebar reads its own collapse state from the shell store, so
          // the track and the rail can never disagree.
          <AppSidebar
            fill
            history={
              authenticated
                ? (conversations ?? []).map((c) => ({
                    id: c.id,
                    title: c.title || t('chat.newConversation'),
                    time: formatRelativeTime(c.updatedAt),
                  }))
                : []
            }
            historyLoading={authenticated && conversations === null}
            account={account}
            authenticated={authenticated}
            activeId={null}
            onSelectConversation={(id) => router.push(`/chat/${id}`)}
            onDeleteConversation={(id) =>
              void deleteConversation(id).then((result) => {
                if (result.ok) refreshConversations();
              })
            }
            onRenameConversation={(id, title) =>
              void renameConversation(id, title).then((result) => {
                if (result.ok) refreshConversations();
              })
            }
            // Already home: "+" means "ready to type" — ride to Level 1 if
            // needed and put the caret in the composer.
            onNewChat={startTyping}
            onSignIn={() => setLoginModalOpen(true)}
            onSignOut={() => void signOut()}
          />
        }
        activity={
          <ActivityRegion status="Discover what makes LUMORA different.">
            {/* The design's idle CTAs: start focuses the composer (riding up
                first if the Worlds floor is showing); worlds rides down. On
                drawer layouts both begin by putting the drawer away. */}
            <ActivityIdle
              onStart={startTyping}
              onExploreWorlds={() => {
                closeDrawers();
                goLevel(2);
              }}
            />
          </ActivityRegion>
        }
      >
        <HomeElevator
          level={level}
          goLevel={goLevel}
          isLocked={isLocked}
          levelOne={
            <>
              <div className="vk-hero-spacer" aria-hidden="true" />
              <PortalHero />
              <GeneralConversation
                value={message}
                onValueChange={setMessage}
                onSubmit={() => submit(message)}
                busy={busy}
                inputRef={composerRef}
                onExploreWorlds={() => goLevel(2)}
                notices={notices}
              />
            </>
          }
          levelTwo={
            <WorldsLevel
              goLevel={goLevel}
              level={level}
              onStartDecision={startTyping}
            />
          }
        />
      </AppFrame>

      <LoginModal
        open={loginOpen}
        onOpenChange={setLoginModalOpen}
        onAuthenticated={handleAuthenticated}
      />
    </>
  );
}
