'use client';

import type { ConversationTypingState } from '@kaira/chat-core';

import { useEffect, useState } from 'react';

import { useChatEngine } from './chat-context';

/**
 * Loads and subscribes to typing state for one conversation.
 */
export function useTypingState(conversationId: string): ConversationTypingState {
  const engine = useChatEngine();
  const [typingState, setTypingState] = useState<ConversationTypingState>(() =>
    engine.getTypingState(conversationId),
  );

  useEffect(() => {
    setTypingState(engine.getTypingState(conversationId));

    const syncState = (): void => {
      setTypingState(engine.getTypingState(conversationId));
    };

    const unsubscribeStart = engine.on('typing:start', (event) => {
      if (event.conversationId !== conversationId) {
        return;
      }

      syncState();
    });

    const unsubscribeStop = engine.on('typing:stop', (event) => {
      if (event.conversationId !== conversationId) {
        return;
      }

      syncState();
    });

    return () => {
      unsubscribeStart();
      unsubscribeStop();
    };
  }, [conversationId, engine]);

  return typingState;
}
