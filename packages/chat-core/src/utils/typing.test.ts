import type { ConversationTypingState } from '../types/typing.js';

import { describe, expect, it } from 'vitest';

import { selectIsTyping, selectTypingParticipants } from './typing.js';

function createTypingState(): ConversationTypingState {
  return {
    conversationId: 'conversation-1',
    participants: [
      {
        conversationId: 'conversation-1',
        participant: { id: 'self', role: 'user' },
        startedAt: 2,
        lastUpdatedAt: 2,
        expiresAt: null,
        source: 'local',
      },
      {
        conversationId: 'conversation-1',
        participant: { id: 'remote', role: 'assistant', displayName: 'Helper' },
        startedAt: 1,
        lastUpdatedAt: 1,
        expiresAt: 10,
        source: 'remote',
      },
    ],
  };
}

describe('typing selectors', () => {
  it('returns sorted typing participants and supports excluding one participant', () => {
    const result = selectTypingParticipants(createTypingState(), {
      excludeParticipantId: 'self',
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.participant.id).toBe('remote');
  });

  it('checks typing state for any participant or one specific participant', () => {
    const state = createTypingState();

    expect(selectIsTyping(state)).toBe(true);
    expect(selectIsTyping(state, 'remote')).toBe(true);
    expect(selectIsTyping(state, 'missing')).toBe(false);
  });
});
