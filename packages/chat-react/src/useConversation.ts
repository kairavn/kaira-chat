'use client';

import type { Conversation } from '@kaira/chat-core';

import { useEffect, useState } from 'react';

import { useChatEngine } from './chat-context';

/**
 * Loads and subscribes to one conversation.
 */
export function useConversation(conversationId: string): Conversation | undefined {
  const engine = useChatEngine();
  const [conversation, setConversation] = useState<Conversation | undefined>(undefined);

  useEffect(() => {
    setConversation(undefined);
    let isMounted = true;

    const loadConversation = async (): Promise<void> => {
      const nextConversation = await engine.getConversation(conversationId);
      if (!isMounted) return;
      setConversation((current) => {
        if (!current || !nextConversation) return nextConversation;
        return current.updatedAt > nextConversation.updatedAt ? current : nextConversation;
      });
    };

    void loadConversation();

    const unsubscribe = engine.on('conversation:updated', (event) => {
      if (event.conversation.id !== conversationId) return;
      setConversation((current) => (current === event.conversation ? current : event.conversation));
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [conversationId, engine]);

  return conversation;
}
