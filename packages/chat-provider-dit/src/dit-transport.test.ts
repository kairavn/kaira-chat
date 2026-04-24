import type { DitFetchFn } from './dit-transport.js';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatEngine } from '@kaira/chat-core';

import {
  DitTransport,
  parseDitFetchMessagesResponse,
  parseDitSendMessageResponse,
} from './dit-transport.js';

function createDitMessage(
  id: string,
  createdAt: string,
  overrides: Partial<{
    readonly chatroom_id: string;
    readonly message: string;
    readonly speaker_type: 'user' | 'chatbot' | 'system';
    readonly speaker_id: string;
    readonly metadata: {
      readonly clientNonce?: string;
    };
  }> = {},
): Record<string, unknown> {
  return {
    id,
    chatroom_id: overrides.chatroom_id ?? 'room-1',
    message: overrides.message ?? id,
    created_at: createdAt,
    ...(overrides.speaker_type ? { speaker_type: overrides.speaker_type } : {}),
    ...(overrides.speaker_id ? { speaker_id: overrides.speaker_id } : {}),
    ...(overrides.metadata ? { metadata: overrides.metadata } : {}),
  };
}

function eventPayloadId(value: unknown): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    'payload' in value &&
    typeof value.payload === 'object' &&
    value.payload !== null &&
    'id' in value.payload &&
    typeof value.payload.id === 'string'
  ) {
    return value.payload.id;
  }

  throw new Error('Expected a transport event payload with a string id');
}

function createJsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function createFetchSequence(
  steps: ReadonlyArray<{
    readonly method: 'GET' | 'POST';
    readonly response: () => Response;
    readonly assert?: (url: string, init: RequestInit | undefined) => void;
  }>,
): DitFetchFn {
  let index = 0;

  return async (input, init) => {
    const step = steps[index];
    if (!step) {
      throw new Error(`Unexpected fetch call #${index + 1}`);
    }

    index += 1;
    expect(init?.method ?? 'GET').toBe(step.method);
    step.assert?.(requestUrl(input), init);
    return step.response();
  };
}

describe('DIT response parsers', () => {
  it('accepts valid fetch payloads', () => {
    expect(
      parseDitFetchMessagesResponse({
        success: true,
        data: [
          {
            id: 'm1',
            chatroom_id: 'room-1',
            message: 'hello',
            metadata: { clientNonce: 'nonce-1' },
          },
        ],
      }),
    ).toEqual({
      success: true,
      data: [
        {
          id: 'm1',
          chatroom_id: 'room-1',
          message: 'hello',
          metadata: { clientNonce: 'nonce-1' },
        },
      ],
    });
  });

  it('rejects malformed fetch payloads', () => {
    expect(() =>
      parseDitFetchMessagesResponse({
        success: true,
        data: [{ id: 1 }],
      }),
    ).toThrow(/data\[0\]\.id/);
  });

  it('rejects malformed optional fetch fields', () => {
    expect(() =>
      parseDitFetchMessagesResponse({
        success: true,
        data: [
          {
            id: 'm1',
            chatroom_id: 'room-1',
            message: 'hello',
            metadata: { clientNonce: 123 },
          },
        ],
      }),
    ).toThrow(/data\[0\]\.metadata\.clientNonce/);

    expect(() =>
      parseDitFetchMessagesResponse({
        success: true,
        data: [
          {
            id: 'm1',
            chatroom_id: 'room-1',
            message: 'hello',
            speaker_type: 'agent',
          },
        ],
      }),
    ).toThrow(/data\[0\]\.speaker_type/);
  });

  it('rejects malformed send payloads', () => {
    expect(() =>
      parseDitSendMessageResponse({
        success: 'yes',
      }),
    ).toThrow(/success/);
  });
});

describe('DitTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('maps fetched DIT messages into typed message transport events', async () => {
    const transport = new DitTransport({
      apiUrl: 'https://example.test',
      apiKey: 'secret',
      chatroomId: 'room-1',
      senderId: 'user-1',
      chatbotNickname: 'bot-1',
      fetch: createFetchSequence([
        {
          method: 'GET',
          response: () =>
            createJsonResponse({
              success: true,
              data: [
                {
                  id: 'm1',
                  chatroom_id: 'room-1',
                  message: 'Welcome',
                  speaker_type: 'chatbot',
                  speaker_id: 'bot-1',
                  created_at: '2024-01-01T00:00:00.000Z',
                },
              ],
            }),
        },
      ]),
    });

    const messageHandler = vi.fn();
    transport.onMessage(messageHandler);

    await transport.connect();

    expect(messageHandler).toHaveBeenCalledOnce();
    expect(messageHandler).toHaveBeenCalledWith({
      type: 'message',
      payload: {
        id: 'm1',
        conversationId: 'room-1',
        sender: {
          id: 'bot-1',
          role: 'assistant',
        },
        timestamp: Date.parse('2024-01-01T00:00:00.000Z'),
        status: 'sent',
        type: 'ai',
        content: 'Welcome',
        streamState: 'complete',
      },
      timestamp: Date.parse('2024-01-01T00:00:00.000Z'),
    });
  });

  it('relies on core clientNonce reconciliation to suppress own echoed messages', async () => {
    const requestBodies: string[] = [];
    const transport = new DitTransport({
      apiUrl: 'https://example.test',
      apiKey: 'secret',
      chatroomId: 'room-1',
      senderId: 'user-1',
      chatbotNickname: 'bot-1',
      pollIntervalMs: 100,
      send: {
        apiId: 'api-user-1',
        sessionId: 'session-1',
        appContext: {
          username: 'Alice',
          gender: 'female',
          dob: '1995-01-01',
        },
      },
      fetch: createFetchSequence([
        {
          method: 'GET',
          response: () =>
            createJsonResponse({
              success: true,
              data: [],
            }),
        },
        {
          method: 'POST',
          assert: (_url, init) => {
            requestBodies.push(String(init?.body ?? ''));
          },
          response: () =>
            createJsonResponse({
              success: true,
            }),
        },
        {
          method: 'GET',
          response: () =>
            createJsonResponse({
              success: true,
              data: [
                {
                  id: 'server-echo-1',
                  chatroom_id: 'room-1',
                  message: 'hello',
                  speaker_type: 'user',
                  speaker_id: 'user-1',
                  metadata: {
                    clientNonce: 'nonce-1',
                  },
                  created_at: '2024-01-01T00:00:01.000Z',
                },
              ],
            }),
        },
      ]),
    });

    const engine = new ChatEngine({
      transport,
      sender: {
        id: 'user-1',
        role: 'user',
      },
    });
    const receivedHandler = vi.fn();

    engine.on('message:received', receivedHandler);

    await engine.connect();
    await engine.sendMessage('room-1', {
      type: 'text',
      content: 'hello',
      metadata: {
        clientNonce: 'nonce-1',
      },
    });

    await vi.advanceTimersByTimeAsync(100);

    expect(receivedHandler).not.toHaveBeenCalled();
    expect(requestBodies[0]).toContain('"clientNonce":"nonce-1"');
  });

  it('bootstraps multi-page history in timestamp order without duplicate emits', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      createDitMessage(
        `page-one-${index + 1}`,
        new Date(Date.UTC(2024, 0, 1, 0, index)).toISOString(),
        {
          message: `page-one-${index + 1}`,
          speaker_type: 'chatbot',
          speaker_id: 'bot-1',
        },
      ),
    );
    const secondPage = [
      createDitMessage('page-zero-2', '2023-12-31T23:58:00.000Z', {
        message: 'older second',
        speaker_type: 'chatbot',
        speaker_id: 'bot-1',
      }),
      createDitMessage('page-one-1', '2024-01-01T00:00:00.000Z', {
        message: 'duplicate first page',
        speaker_type: 'chatbot',
        speaker_id: 'bot-1',
      }),
      createDitMessage('page-zero-1', '2023-12-31T23:57:00.000Z', {
        message: 'older first',
        speaker_type: 'chatbot',
        speaker_id: 'bot-1',
      }),
    ];

    const transport = new DitTransport({
      apiUrl: 'https://example.test',
      apiKey: 'secret',
      chatroomId: 'room-1',
      senderId: 'user-1',
      chatbotNickname: 'bot-1',
      fetch: createFetchSequence([
        {
          method: 'GET',
          assert: (url) => {
            expect(url).toContain('direction=before');
            expect(url).toContain('limit=100');
          },
          response: () =>
            createJsonResponse({
              success: true,
              data: firstPage,
            }),
        },
        {
          method: 'GET',
          assert: (url) => {
            expect(url).toContain('direction=before');
            expect(url).toContain('cursor=page-one-1');
          },
          response: () =>
            createJsonResponse({
              success: true,
              data: secondPage,
            }),
        },
      ]),
    });

    const messageHandler = vi.fn();
    transport.onMessage(messageHandler);

    await transport.connect();

    const payloadIds = messageHandler.mock.calls.map(([event]) => eventPayloadId(event));

    expect(payloadIds).toHaveLength(102);
    expect(payloadIds.slice(0, 3)).toEqual(['page-zero-1', 'page-zero-2', 'page-one-1']);
    expect(payloadIds.at(-1)).toBe('page-one-100');
    expect(payloadIds.filter((id) => id === 'page-one-1')).toHaveLength(1);
  });

  it('honors configured initial history limit without extra backfill pages', async () => {
    const transport = new DitTransport({
      apiUrl: 'https://example.test',
      apiKey: 'secret',
      chatroomId: 'room-1',
      senderId: 'user-1',
      chatbotNickname: 'bot-1',
      initialHistoryLimit: 8,
      initialBackfillPageCount: 1,
      fetch: createFetchSequence([
        {
          method: 'GET',
          assert: (url) => {
            expect(url).toContain('direction=before');
            expect(url).toContain('limit=8');
            expect(url).not.toContain('cursor=');
          },
          response: () =>
            createJsonResponse({
              success: true,
              data: Array.from({ length: 8 }, (_, index) =>
                createDitMessage(
                  `initial-${index + 1}`,
                  new Date(Date.UTC(2024, 0, 1, 0, index)).toISOString(),
                  {
                    message: `initial-${index + 1}`,
                    speaker_type: 'chatbot',
                    speaker_id: 'bot-1',
                  },
                ),
              ),
            }),
        },
      ]),
    });

    const messageHandler = vi.fn();
    transport.onMessage(messageHandler);

    await transport.connect();

    const payloadIds = messageHandler.mock.calls.map(([event]) => eventPayloadId(event));

    expect(payloadIds).toEqual([
      'initial-1',
      'initial-2',
      'initial-3',
      'initial-4',
      'initial-5',
      'initial-6',
      'initial-7',
      'initial-8',
    ]);
  });
});
