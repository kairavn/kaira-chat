import { describe, expect, it } from 'vitest';

import { getChatEventsAfterSequence, publishChatEvent, resetChatEventBroker } from './event-broker';

describe('event broker', () => {
  it('returns sequenced deltas in order after a cursor', () => {
    resetChatEventBroker('demo-a');
    resetChatEventBroker('demo-b');

    publishChatEvent('demo-a', {
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
    publishChatEvent('demo-a', {
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

    publishChatEvent('demo-b', {
      type: 'typing:start',
      timestamp: 3,
      conversationId: 'conversation-1',
      participant: { id: 'user-2', role: 'user' },
      typing: {
        conversationId: 'conversation-1',
        participant: { id: 'user-2', role: 'user' },
        startedAt: 3,
        lastUpdatedAt: 3,
        expiresAt: null,
        source: 'local',
      },
    });

    const deltas = getChatEventsAfterSequence('demo-a', 1, 'conversation-1');

    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.event.type).toBe('typing:stop');
    expect(deltas[0]?.sequence).toBe(2);
  });

  it('retains history independently for each namespace', () => {
    resetChatEventBroker('quiet-demo');
    resetChatEventBroker('busy-demo');

    publishChatEvent('quiet-demo', {
      type: 'typing:start',
      timestamp: 1,
      conversationId: 'conversation-1',
      participant: { id: 'user-quiet', role: 'user' },
      typing: {
        conversationId: 'conversation-1',
        participant: { id: 'user-quiet', role: 'user' },
        startedAt: 1,
        lastUpdatedAt: 1,
        expiresAt: null,
        source: 'local',
      },
    });

    for (let index = 0; index < 501; index += 1) {
      publishChatEvent('busy-demo', {
        type: 'typing:start',
        timestamp: index + 2,
        conversationId: 'conversation-1',
        participant: { id: `user-${index}`, role: 'user' },
        typing: {
          conversationId: 'conversation-1',
          participant: { id: `user-${index}`, role: 'user' },
          startedAt: index + 2,
          lastUpdatedAt: index + 2,
          expiresAt: null,
          source: 'local',
        },
      });
    }

    const quietDeltas = getChatEventsAfterSequence('quiet-demo', 0, 'conversation-1');

    expect(quietDeltas).toHaveLength(1);
    expect(quietDeltas[0]?.sequence).toBe(1);
  });
});
