'use client';

import type { ConversationTypingState } from '@kaira/chat-core';

import { useEffect, useState } from 'react';

import { useChatEngine } from './chat-context';

interface TypingStateSnapshot {
  readonly conversationId: string;
  readonly typingState: ConversationTypingState;
}

/**
 * Loads and subscribes to typing state for one conversation.
 */
export function useTypingState(conversationId: string): ConversationTypingState {
  const engine = useChatEngine();
  const [snapshot, setSnapshot] = useState<TypingStateSnapshot>(() => ({
    conversationId,
    typingState: engine.getTypingState(conversationId),
  }));

  useEffect(() => {
    const syncState = (): void => {
      setSnapshot({
        conversationId,
        typingState: engine.getTypingState(conversationId),
      });
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

  return snapshot.conversationId === conversationId
    ? snapshot.typingState
    : engine.getTypingState(conversationId);
}
