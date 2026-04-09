import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatEngine } from '@kaira/chat-core';

import { publishChatEvent, resetChatEventBroker } from '@/lib/chat/event-broker';

let currentEngine = new ChatEngine({
  sender: { id: 'self', role: 'user' },
});

vi.mock('@/lib/chat/server-chat-engine', () => ({
  getServerChatEngineContext: async () => ({
    engine: currentEngine,
    conversationId: 'conversation-1',
  }),
}));

function isBootstrapResponse(value: unknown): value is {
  readonly success: boolean;
  readonly data: ReadonlyArray<{ readonly type: string }>;
  readonly nextCursor?: string;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof value.success === 'boolean' &&
    'data' in value &&
    Array.isArray(value.data)
  );
}

function isIncrementalResponse(value: unknown): value is {
  readonly success: boolean;
  readonly data: ReadonlyArray<{
    readonly type: string;
    readonly payload: { readonly action?: string };
  }>;
  readonly nextCursor?: string;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof value.success === 'boolean' &&
    'data' in value &&
    Array.isArray(value.data)
  );
}

describe('chat events route', () => {
  beforeEach(() => {
    resetChatEventBroker();
    currentEngine = new ChatEngine({
      sender: { id: 'self', role: 'user' },
    });
  });

  it('returns bootstrap message history plus active typing snapshots', async () => {
    await currentEngine.sendMessage('conversation-1', {
      type: 'text',
      content: 'hello',
    });
    currentEngine.notifyTyping('conversation-1');

    const request = new NextRequest(
      'http://localhost:3000/api/chat/events?conversationId=conversation-1',
    );
    const { GET } = await import('./route');
    const response = await GET(request);
    const json: unknown = await response.json();
    if (!isBootstrapResponse(json)) {
      throw new Error('Expected bootstrap response');
    }

    expect(json.success).toBe(true);
    expect(json.data.map((event) => event.type)).toEqual(['message', 'typing']);
    expect(json.nextCursor).toBe('0');
  });

  it('returns incremental typing deltas after a sequence cursor', async () => {
    publishChatEvent({
      type: 'typing:start',
      timestamp: 1,
      conversationId: 'conversation-1',
      participant: { id: 'assistant-1', role: 'assistant' },
      typing: {
        conversationId: 'conversation-1',
        participant: { id: 'assistant-1', role: 'assistant' },
        startedAt: 1,
        lastUpdatedAt: 1,
        expiresAt: 10,
        source: 'remote',
      },
    });

    const request = new NextRequest(
      'http://localhost:3000/api/chat/events?conversationId=conversation-1&cursor=0',
    );
    const { GET } = await import('./route');
    const response = await GET(request);
    const json: unknown = await response.json();
    if (!isIncrementalResponse(json)) {
      throw new Error('Expected incremental response');
    }

    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toMatchObject({
      type: 'typing',
      payload: {
        action: 'start',
      },
    });
    expect(json.nextCursor).toBe('1');
  });
});
