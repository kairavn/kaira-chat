import { describe, expect, it } from 'vitest';

import { getChatEventsAfterSequence, publishChatEvent, resetChatEventBroker } from './event-broker';

describe('event broker', () => {
  it('returns sequenced deltas in order after a cursor', () => {
    resetChatEventBroker();

    publishChatEvent({
      type: 'typing:start',
      timestamp: 1,
      conversationId: 'conversation-1',
      participant: { id: 'user-1', role: 'user' },
      typing: {
        conversationId: 'conversation-1',
        participant: { id: 'user-1', role: 'user' },
        startedAt: 1,
        lastUpdatedAt: 1,
        expiresAt: null,
        source: 'local',
      },
    });
    publishChatEvent({
      type: 'typing:stop',
      timestamp: 2,
      conversationId: 'conversation-1',
      participant: { id: 'user-1', role: 'user' },
      typing: {
        conversationId: 'conversation-1',
        participant: { id: 'user-1', role: 'user' },
        startedAt: 1,
        lastUpdatedAt: 2,
        expiresAt: null,
        source: 'local',
      },
      reason: 'explicit',
    });

    const deltas = getChatEventsAfterSequence(1, 'conversation-1');

    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.event.type).toBe('typing:stop');
    expect(deltas[0]?.sequence).toBe(2);
  });
});
