'use client';

import { useMemo } from 'react';

import { selectIsTyping } from '@kaira/chat-core';

import { useTypingState } from './useTypingState';

/**
 * Returns whether a conversation, or one participant in it, is actively typing.
 */
export function useIsTyping(conversationId: string, participantId?: string): boolean {
  const typingState = useTypingState(conversationId);

  return useMemo(() => selectIsTyping(typingState, participantId), [participantId, typingState]);
}
