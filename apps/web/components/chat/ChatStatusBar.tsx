'use client';

import type { ConnectionState } from '@kaira/chat-core';

interface ChatStatusBarProps {
  readonly connectionState: ConnectionState;
  readonly isSending: boolean;
  readonly hasConversation: boolean;
  readonly isThinking: boolean;
}

/**
 * Demo status row for connection and message activity.
 */
export function ChatStatusBar({
  connectionState,
  isSending,
  hasConversation,
  isThinking,
}: ChatStatusBarProps): React.JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 8, color: '#94a3b8', fontSize: 12 }}>
      <span>{connectionState}</span>
      <span>•</span>
      <span>{isSending ? 'Sending...' : 'Ready'}</span>
      <span>•</span>
      <span>{hasConversation ? 'Conversation loaded' : 'Conversation pending'}</span>
      <span>•</span>
      <span>{isThinking ? 'AI thinking' : 'AI idle'}</span>
    </div>
  );
}
