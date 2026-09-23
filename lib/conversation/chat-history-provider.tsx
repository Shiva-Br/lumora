'use client';

import * as React from 'react';

import {
  listConversations,
  type ConversationSummary,
} from '@/lib/api/conversations';
import { useAuth } from '@/lib/auth/auth-provider';

type ChatHistoryValue = {
  /** The account's conversations; null until the first load has settled. */
  conversations: ConversationSummary[] | null;
  /** Refetch the list — after a turn completes or a conversation is created. */
  refresh: () => void;
};

const ChatHistoryContext = React.createContext<ChatHistoryValue | null>(null);

export function ChatHistoryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, identity } = useAuth();
  const accountId = status === 'authenticated' ? (identity?.id ?? null) : null;

  // The cache records which account it belongs to, and only that account's
  // renders can see it — so however sign-out/sign-in and in-flight responses
  // interleave, one account's titles can never appear under another (or under
  // a guest). This is a value-based guarantee, not a timing-based one.
  const [cache, setCache] = React.useState<{
    owner: string;
    list: ConversationSummary[];
  } | null>(null);

  // Monotonic request sequence: only the newest refresh may write, so an
  // older response can never overwrite a newer list (e.g. the mount-time
  // fetch resolving after the post-turn one and dropping the new thread).
  const seqRef = React.useRef(0);

  const refresh = React.useCallback(() => {
    if (!accountId) return;
    const seq = ++seqRef.current;
    void listConversations().then((result) => {
      if (seq !== seqRef.current) return; // superseded by a newer refresh
      if (result.ok) {
        setCache({ owner: accountId, list: result.data });
      } else {
        // First fetch failed: settle on an empty list rather than skeletons
        // forever. A failed refetch keeps whatever is already cached.
        setCache((current) =>
          current?.owner === accountId
            ? current
            : { owner: accountId, list: [] }
        );
      }
    });
  }, [accountId]);

  React.useEffect(() => {
    if (accountId) refresh();
  }, [accountId, refresh]);

  const conversations = cache && cache.owner === accountId ? cache.list : null;

  const value = React.useMemo<ChatHistoryValue>(
    () => ({ conversations, refresh }),
    [conversations, refresh]
  );
  return (
    <ChatHistoryContext.Provider value={value}>
      {children}
    </ChatHistoryContext.Provider>
  );
}

export function useChatHistory(): ChatHistoryValue {
  const value = React.useContext(ChatHistoryContext);
  if (!value) {
    throw new Error(
      'useChatHistory must be used under ChatHistoryProvider (app/layout.tsx)'
    );
  }
  return value;
}
