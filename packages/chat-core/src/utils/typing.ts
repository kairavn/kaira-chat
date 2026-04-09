import type {
  ConversationTypingState,
  TypingParticipantSelectorOptions,
  TypingParticipantState,
} from '../types/typing.js';

function sortTypingParticipants(
  left: TypingParticipantState,
  right: TypingParticipantState,
): number {
  if (left.startedAt !== right.startedAt) {
    return left.startedAt - right.startedAt;
  }

  return left.participant.id.localeCompare(right.participant.id);
}

/**
 * Returns active typing participants for a conversation, optionally excluding one participant.
 */
export function selectTypingParticipants(
  state: ConversationTypingState,
  options: TypingParticipantSelectorOptions = {},
): ReadonlyArray<TypingParticipantState> {
  const { excludeParticipantId } = options;
  return [...state.participants]
    .filter((participantState) => participantState.participant.id !== excludeParticipantId)
    .sort(sortTypingParticipants);
}

/**
 * Returns whether any participant, or one specific participant, is actively typing.
 */
export function selectIsTyping(state: ConversationTypingState, participantId?: string): boolean {
  if (participantId === undefined) {
    return state.participants.length > 0;
  }

  return state.participants.some(
    (participantState) => participantState.participant.id === participantId,
  );
}
