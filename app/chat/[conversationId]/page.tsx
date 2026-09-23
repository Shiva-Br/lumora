import { ChatScreen } from '@/components/lumora/chat/chat-screen';

// The conversation / Follow-up screen. `new` is the only non-UUID segment:
// it renders an empty thread whose first send creates the conversation via
// POST /conversations/start (the screen then adopts the real id into the
// URL with history.replaceState, so refreshes land back here by id).
//
// Mounting model: pages get a fresh instance per URL segment, so navigating
// between conversation ids remounts ChatScreen with clean per-thread state
// (no `key` needed). What must survive those remounts — the sidebar's
// conversation list — lives above this boundary, in the root layout's
// ChatHistoryProvider. ChatScreen still tracks the pathname itself for the
// transitions that do NOT remount it: the replaceState id adoption, and an
// adopted /chat/new navigating to /chat/new again (same segment). The prop
// only seeds the very first render.
export default async function ChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return (
    <ChatScreen
      conversationId={conversationId === 'new' ? null : conversationId}
    />
  );
}
