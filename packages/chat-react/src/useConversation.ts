'use client';

import type { Conversation } from '@kaira/chat-core';

import { useEffect, useState } from 'react';

import { useChatEngine } from './chat-context';

interface ConversationSnapshot {
  readonly conversationId: string;
  readonly conversation: Conversation | undefined;
}

/**
 * Loads and subscribes to one conversation.
 */
export function useConversation(conversationId: string): Conversation | undefined {
  const engine = useChatEngine();
  const [snapshot, setSnapshot] = useState<ConversationSnapshot | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    const loadConversation = async (): Promise<void> => {
      const nextConversation = await engine.getConversation(conversationId);
      if (!isMounted) return;
      setSnapshot((current) => {
        const currentConversation =
          current?.conversationId === conversationId ? current.conversation : undefined;

        if (!currentConversation || !nextConversation) {
          return {
            conversationId,
            conversation: nextConversation,
          };
        }

        return {
          conversationId,
          conversation:
            currentConversation.updatedAt > nextConversation.updatedAt
              ? currentConversation
              : nextConversation,
        };
      });
    };

    void loadConversation();

    const unsubscribe = engine.on('conversation:updated', (event) => {
      if (event.conversation.id !== conversationId) return;
      setSnapshot((current) => {
        if (
          current?.conversationId === conversationId &&
          current.conversation === event.conversation
        ) {
          return current;
        }

        return {
          conversationId,
          conversation: event.conversation,
        };
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [conversationId, engine]);

  return snapshot?.conversationId === conversationId ? snapshot.conversation : undefined;
}
