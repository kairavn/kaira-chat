import type { DitFetchFn } from './dit-transport.js';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatEngine } from '@kaira/chat-core';

import {
  DitTransport,
  parseDitFetchMessagesResponse,
  parseDitSendMessageResponse,
} from './dit-transport.js';

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
});
