'use client';

import type { ConnectionState } from '@kaira/chat-core';

interface ChatStatusBarProps {
  readonly connectionState: ConnectionState;
  readonly isSending: boolean;
  readonly isThinking: boolean;
  readonly isRuntimeReady: boolean;
  readonly isTypingSupported: boolean;
}

/**
 * Demo status row for connection and message activity.
 */
export function ChatStatusBar({
  connectionState,
  isSending,
  isThinking,
  isRuntimeReady,
  isTypingSupported,
}: ChatStatusBarProps): React.JSX.Element {
  const activityLabel = isSending
    ? 'Sending...'
    : isRuntimeReady
      ? 'Ready'
      : 'Waiting for connection';

  return (
    <div style={{ display: 'flex', gap: 8, color: '#94a3b8', fontSize: 12 }}>
      <span>{connectionState}</span>
      <span>•</span>
      <span>{activityLabel}</span>
      <span>•</span>
      <span>{isTypingSupported ? 'Typing enabled' : 'Typing unavailable'}</span>
      <span>•</span>
      <span>{isThinking ? 'AI thinking' : 'AI idle'}</span>
    </div>
  );
}
