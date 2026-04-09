'use client';

import type { Conversation, Message, TypingParticipantState } from '@kaira/chat-core';
import type { RendererRegistry } from '@kaira/chat-ui';

import { memo, useMemo } from 'react';

import { MessageRenderer, ThinkingIndicator, TypingIndicator } from '@kaira/chat-ui';

interface MessageListProps {
  readonly messages: ReadonlyArray<Message>;
  readonly conversation?: Conversation;
  readonly streamingPreview?: Message;
  readonly showThinkingIndicator?: boolean;
  readonly typingParticipants?: ReadonlyArray<TypingParticipantState>;
  readonly registry: RendererRegistry;
}

export const MessageList = memo(function MessageList({
  messages,
  conversation,
  streamingPreview,
  showThinkingIndicator = false,
  typingParticipants = [],
  registry,
}: MessageListProps) {
  const viewMessages = useMemo(
    () => (streamingPreview ? [...messages, streamingPreview] : messages),
    [messages, streamingPreview],
  );

  if (viewMessages.length === 0 && !showThinkingIndicator && typingParticipants.length === 0) {
    return (
      <div
        style={{
          border: '1px dashed #374151',
          borderRadius: 12,
          padding: 16,
          color: '#94a3b8',
          textAlign: 'center',
        }}
      >
        No messages yet. Send the first one.
      </div>
    );
  }

  return (
    <ul
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 0,
        margin: 0,
      }}
    >
      {viewMessages.map((message) => (
        <li
          key={message.id}
          style={{
            listStyle: 'none',
            borderRadius: 12,
            padding: '10px 12px',
            background: '#1f2937',
            color: '#f8fafc',
            maxWidth: '85%',
            alignSelf: message.sender.role === 'user' ? 'flex-end' : 'flex-start',
            opacity: message.status === 'pending' ? 0.6 : 1,
          }}
        >
          {message.status === 'pending' ? (
            <small style={{ color: '#cbd5e1' }}>Sending...</small>
          ) : null}
          <MessageRenderer
            message={message}
            conversation={conversation}
            registry={registry}
          />
        </li>
      ))}
      {showThinkingIndicator ? (
        <li
          style={{
            listStyle: 'none',
            borderRadius: 12,
            padding: '10px 12px',
            background: '#111827',
            color: '#cbd5e1',
            maxWidth: '85%',
            alignSelf: 'flex-start',
            border: '1px solid #374151',
          }}
        >
          <ThinkingIndicator />
        </li>
      ) : null}
      {typingParticipants.length > 0 ? (
        <li
          style={{
            listStyle: 'none',
            borderRadius: 12,
            padding: '10px 12px',
            background: '#111827',
            color: '#cbd5e1',
            maxWidth: '85%',
            alignSelf: 'flex-start',
            border: '1px solid #374151',
          }}
        >
          <TypingIndicator participants={typingParticipants} />
        </li>
      ) : null}
    </ul>
  );
});
