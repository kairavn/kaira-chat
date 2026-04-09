'use client';

import type { TypingParticipantState } from '@kaira/chat-core';

import { selectTypingParticipants } from '@kaira/chat-core';

import { useChatEngine } from './chat-context';
import { useTypingState } from './useTypingState';

/**
 * Options for filtering typing participants in React.
 */
export interface UseTypingParticipantsOptions {
  readonly excludeSelf?: boolean;
  readonly excludeParticipantId?: string;
}

/**
 * Returns active typing participants for one conversation.
 */
export function useTypingParticipants(
  conversationId: string,
  options: UseTypingParticipantsOptions = {},
): ReadonlyArray<TypingParticipantState> {
  const engine = useChatEngine();
  const typingState = useTypingState(conversationId);
  const { excludeSelf = true, excludeParticipantId } = options;
  const currentParticipantId = excludeSelf ? engine.getCurrentParticipant().id : undefined;

  return selectTypingParticipants(typingState).filter((participantState) => {
    return (
      participantState.participant.id !== excludeParticipantId &&
      participantState.participant.id !== currentParticipantId
    );
  });
}
