'use client';

// Gates prompt submission on authentication, and resumes the prompt afterwards.
//
// The rules this encodes (in order of how easy they are to get wrong):
//
//   1. The prompt is NEVER cleared before the backend accepts it. Not when the
//      modal opens, not while the code is typed, not across the OAuth redirect.
//   2. It is submitted EXACTLY ONCE. Three things could double-submit it — React
//      Strict Mode running effects twice, an onAuthStateChange fire (a token
//      refresh raises one) while a resume is already running, and a plain
//      re-render — so a ref latch, not state, guards the resume.
//   3. Provisioning must succeed before the prompt goes out. If /api/me fails,
//      the Supabase session stays valid, the prompt stays put, and the user gets
//      a retry — we never sign them out.
//   4. Stale content is never sent. If the user edits the box after the flow
//      started, the preserved intent is dropped: what they see is what they get,
//      and only when they press send again.
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { sendMessage } from '@/lib/chat';

import { useAuth } from './auth-provider';
import { IS_LOCAL_AUTH, IS_DEMO_AUTH } from './mode';
import {
  armPendingPrompt,
  clearPendingPrompt,
  disarmPendingPrompt,
  getPendingPrompt,
  getPendingPromptServerSnapshot,
  subscribePendingPrompt,
} from './pending-prompt';

type ResumeState =
  | { phase: 'idle' }
  | { phase: 'working' }
  | { phase: 'error'; message: string };

export function usePromptGate() {
  const { status, provision } = useAuth();
  const router = useRouter();

  // The preserved prompt lives in sessionStorage, not in React state, so it
  // survives the OAuth redirect. Reading it as an external store means it is
  // simply *there* on the first client render — no mount effect, no copy.
  const pending = React.useSyncExternalStore(
    subscribePendingPrompt,
    getPendingPrompt,
    getPendingPromptServerSnapshot
  );

  // What the user has typed since. `null` means "no local edit — show whatever
  // the store preserved", which is what rehydrates the box after an OAuth trip.
  const [draft, setDraft] = React.useState<string | null>(null);
  const message = draft ?? pending?.prompt ?? '';

  const [loginOpen, setLoginOpen] = React.useState(false);
  const [resume, setResume] = React.useState<ResumeState>({ phase: 'idle' });

  // Latches the in-flight resume. A ref, because effects and auth events can
  // fire again before a state update has been committed.
  const resumingRef = React.useRef(false);

  /**
   * Hands the prompt to the chat screen and routes there. `sendMessage`
   * preserves the text in the first-message stash before this clears the
   * pending-prompt store, so the prompt is never dropped in between.
   */
  const dispatch = React.useCallback(
    async (prompt: string) => {
      const result = await sendMessage(prompt);
      if (result.ok) {
        clearPendingPrompt();
        setDraft('');
        router.push(`/chat/${result.conversationId}`);
      }
      if (!result.ok) setResume({ phase: 'error', message: result.error });
      return result;
    },
    [router]
  );

  const runResume = React.useCallback(
    async (prompt: string) => {
      setLoginOpen(false);
      setResume({ phase: 'working' });

      // Provision/sync first — the prompt must not reach the backend before the
      // user exists there. Apple only sends the name on the very first login,
      // so this is also what captures it.
      const provisioned = await provision();
      if (!provisioned.ok) {
        setResume({ phase: 'error', message: provisioned.error });
        resumingRef.current = false;
        return;
      }

      const sent = await dispatch(prompt);
      if (!sent.ok) {
        setResume({ phase: 'error', message: sent.error });
        resumingRef.current = false;
        return;
      }

      setResume({ phase: 'idle' });
      resumingRef.current = false;
    },
    [provision, dispatch]
  );

  // The single place a preserved prompt is auto-submitted. It covers both routes
  // back from authentication — the OTP verify (no reload) and the OAuth redirect
  // (fresh mount, prompt already in the store) — because both end in the same
  // state: authenticated, with an armed prompt.
  React.useEffect(() => {
    if (status !== 'authenticated') return;
    if (!pending?.armed) return;
    if (resumingRef.current) return;

    resumingRef.current = true;
    void runResume(pending.prompt);
  }, [status, pending, runResume]);

  /** Composer edits. Editing the text invalidates a preserved intent. */
  const setMessage = React.useCallback(
    (next: string) => {
      setDraft(next);
      setResume((current) =>
        current.phase === 'error' ? { phase: 'idle' } : current
      );

      // Never auto-submit content the user has since changed.
      if (pending?.armed && next.trim() !== pending.prompt) {
        disarmPendingPrompt();
      }
    },
    [pending]
  );

  /** The composer's submit button — this is the authentication gate. */
  const submit = React.useCallback(
    (prompt: string) => {
      // Session still unknown: do not misjudge a signed-in user as a guest.
      if (status === 'loading') return;

      if (status !== 'authenticated') {
        // Preserve and arm, then ask them to sign in. Nothing is sent and
        // nothing is cleared.
        armPendingPrompt(prompt);
        setDraft(prompt);
        setResume({ phase: 'idle' });
        // In local mode there is no modal to open: sign-in is a page, and
        // reaching here at all means the session expired mid-visit.
        if (IS_LOCAL_AUTH || IS_DEMO_AUTH) {
          router.push('/login');
        } else {
          setLoginOpen(true);
        }
        return;
      }

      void dispatch(prompt);
    },
    [status, dispatch, router]
  );

  /** Closing/cancelling the modal drops the intent but keeps the text on screen. */
  const setLoginModalOpen = React.useCallback(
    (open: boolean) => {
      setLoginOpen(open);
      if (!open && status !== 'authenticated') disarmPendingPrompt();
    },
    [status]
  );

  /**
   * The OTP step verified. We deliberately do NOT submit here: flipping the
   * session makes the resume effect fire, and that is the one and only submit
   * path. Submitting here too would send the prompt twice.
   */
  const handleAuthenticated = React.useCallback(() => {
    setLoginOpen(false);
  }, []);

  /** Retry a failed provision/submit without making the user retype anything. */
  const retry = React.useCallback(() => {
    if (resumingRef.current) return;

    const prompt = message.trim();
    if (!prompt) {
      setResume({ phase: 'idle' });
      return;
    }

    if (status !== 'authenticated') {
      armPendingPrompt(prompt);
      setResume({ phase: 'idle' });
      if (IS_LOCAL_AUTH || IS_DEMO_AUTH) {
        router.push('/login');
      } else {
        setLoginOpen(true);
      }
      return;
    }

    resumingRef.current = true;
    void runResume(prompt);
  }, [message, status, runResume, router]);

  return {
    message,
    setMessage,
    submit,
    /** Blocks the send button while the session is unknown or a resume is running. */
    busy: status === 'loading' || resume.phase === 'working',
    resuming: resume.phase === 'working',
    error: resume.phase === 'error' ? resume.message : null,
    retry,
    loginOpen,
    setLoginModalOpen,
    handleAuthenticated,
  };
}
