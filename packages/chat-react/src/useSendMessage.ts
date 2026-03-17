'use client';

import type { Message, MessageContent } from '@kaira/chat-core';

import { useCallback } from 'react';

import { useChatEngine } from './chat-context';

/**
 * Returns a stable callback for sending a message.
 */
export function useSendMessage(): (
  conversationId: string,
  content: MessageContent,
) => Promise<Message> {
  const engine = useChatEngine();

  return useCallback(
    async (conversationId: string, content: MessageContent): Promise<Message> => {
      return engine.sendMessage(conversationId, content);
    },
    [engine],
  );
}
