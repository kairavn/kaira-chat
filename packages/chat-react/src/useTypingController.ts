'use client';

import { useCallback } from 'react';

import { useChatEngine } from './chat-context';

/**
 * API returned by `useTypingController`.
 */
export interface TypingController {
  readonly notifyTyping: () => void;
  readonly stopTyping: () => void;
  readonly isSupported: boolean;
}

/**
 * Returns conversation-scoped typing controls for a composer.
 */
export function useTypingController(conversationId: string): TypingController {
  const engine = useChatEngine();

  const notifyTyping = useCallback((): void => {
    engine.notifyTyping(conversationId);
  }, [conversationId, engine]);

  const stopTyping = useCallback((): void => {
    engine.stopTyping(conversationId);
  }, [conversationId, engine]);

  return {
    notifyTyping,
    stopTyping,
    isSupported: engine.supportsTyping(),
  };
}
