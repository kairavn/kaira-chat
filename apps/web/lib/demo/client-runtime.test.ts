import type { Message, Participant, TransportEvent } from '@kaira/chat-core';
import type { DemoClientRuntime } from './client-runtime';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearDemoClientRuntimeCache, getOrCreateDemoClientRuntime } from './client-runtime';

const originalFetch = globalThis.fetch;
const originalLocalStorage = Reflect.get(globalThis, 'localStorage');
const sender = {
  id: 'user-1',
  role: 'user',
  displayName: 'User One',
} satisfies Participant;

interface TestLocalStorage {
  clear(): void;
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

function createRuntime(storageName: string): DemoClientRuntime {
  return getOrCreateDemoClientRuntime({
    demoId: 'next-backend',
    apiBasePath: '/api/demos/next-backend',
    storageName,
    sender,
    pollIntervalMs: 60_000,
    enableStreamingBridge: true,
  });
}

function createAssistantMessage(): Message {
  return {
    id: 'assistant-1',
    conversationId: 'conversation-1',
    sender: {
      id: 'assistant-1',
      role: 'assistant',
      displayName: 'Local Assistant',
    },
    timestamp: 1_710_000_000_000,
    status: 'sent',
    type: 'ai',
    content: 'The local demo runtime replied immediately after the send.',
    streamState: 'complete',
  };
}

function getUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function getRequestUrl(input: RequestInfo | URL): URL {
  return new URL(getUrl(input), 'http://localhost');
}

function createTestLocalStorage(): TestLocalStorage {
  const values = new Map<string, string>();

  return {
    clear(): void {
      values.clear();
    },
    getItem(key: string): string | null {
      return values.get(key) ?? null;
    },
    removeItem(key: string): void {
      values.delete(key);
    },
    setItem(key: string, value: string): void {
      values.set(key, value);
    },
  };
}

describe('getOrCreateDemoClientRuntime', () => {
  const runtimes: DemoClientRuntime[] = [];

  afterEach(async () => {
    await Promise.all(
      runtimes.map(async (runtime) => {
        await runtime.engine.disconnect();
      }),
    );
    runtimes.length = 0;
    clearDemoClientRuntimeCache();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it('surfaces the not-ready transport error before the runtime connects', async () => {
    const runtime = createRuntime(`client-runtime-not-ready-${crypto.randomUUID()}`);
    runtimes.push(runtime);
    runtime.setActiveConversationId('conversation-1');

    await expect(
      runtime.engine.sendMessage('conversation-1', {
        type: 'text',
        content: 'hello',
      }),
    ).rejects.toMatchObject({
      kind: 'state',
      message: 'Cannot send while the polling transport is disconnected.',
    });
  });

  it('polls immediately after send so replies do not wait for the steady interval', async () => {
    const assistantMessage = createAssistantMessage();
    let queuedEvents: ReadonlyArray<TransportEvent<'message'>> = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = getRequestUrl(input);

        if (url.pathname === '/api/demos/next-backend/events') {
          const data = queuedEvents;
          queuedEvents = [];

          return new Response(
            JSON.stringify({
              success: true,
              data,
              nextCursor: 'cursor-1',
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          );
        }

        if (url.pathname === '/api/demos/next-backend/messages' && init?.method === 'POST') {
          queuedEvents = [
            {
              type: 'message',
              payload: assistantMessage,
              timestamp: assistantMessage.timestamp,
            },
          ];

          return new Response('', { status: 200 });
        }

        throw new Error(`Unhandled fetch request for ${url.toString()}`);
      },
    );
    globalThis.fetch = fetchMock;

    const runtime = createRuntime(`client-runtime-immediate-poll-${crypto.randomUUID()}`);
    runtimes.push(runtime);
    runtime.setActiveConversationId('conversation-1');

    const receivedMessages: Message[] = [];
    runtime.engine.on('message:received', (event) => {
      receivedMessages.push(event.message);
    });

    await runtime.engine.connect();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await runtime.engine.sendMessage('conversation-1', {
      type: 'text',
      content: 'trace the local demo path',
    });

    await vi.waitFor(() => {
      expect(receivedMessages).toContainEqual(assistantMessage);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('reuses one persisted session id across demo route requests', async () => {
    const localStorage = createTestLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorage,
    });

    const bootstrapConversation = {
      id: 'conversation-1',
      type: 'direct',
      participants: [
        sender,
        {
          id: 'assistant-1',
          role: 'assistant',
          displayName: 'Local Assistant',
        },
      ],
      createdAt: 1_710_000_000_000,
      updatedAt: 1_710_000_000_000,
    } as const;

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = getRequestUrl(input);

        if (url.pathname === '/api/demos/next-backend/conversation' && init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                demoId: 'next-backend',
                conversation: bootstrapConversation,
                conversationId: bootstrapConversation.id,
              },
            }),
            {
              headers: {
                'Content-Type': 'application/json',
              },
              status: 200,
            },
          );
        }

        if (url.pathname === '/api/demos/next-backend/conversations' && init?.method !== 'POST') {
          return new Response(
            JSON.stringify({
              success: true,
              data: [bootstrapConversation],
            }),
            {
              headers: {
                'Content-Type': 'application/json',
              },
              status: 200,
            },
          );
        }

        if (url.pathname === '/api/demos/next-backend/events') {
          return new Response(
            JSON.stringify({
              success: true,
              data: [],
              nextCursor: 'cursor-1',
            }),
            {
              headers: {
                'Content-Type': 'application/json',
              },
              status: 200,
            },
          );
        }

        if (url.pathname === '/api/demos/next-backend/messages' && init?.method === 'POST') {
          return new Response('', { status: 200 });
        }

        if (url.pathname === '/api/demos/next-backend/typing' && init?.method === 'POST') {
          return new Response(JSON.stringify({ success: true }), {
            headers: {
              'Content-Type': 'application/json',
            },
            status: 200,
          });
        }

        throw new Error(`Unhandled fetch request for ${url.toString()}`);
      },
    );
    globalThis.fetch = fetchMock;

    const storageName = `client-runtime-session-${crypto.randomUUID()}`;
    const runtime = createRuntime(storageName);
    runtimes.push(runtime);

    await runtime.bootstrapConversation();
    await runtime.listConversations();
    await runtime.engine.connect();
    runtime.engine.notifyTyping('conversation-1');
    runtime.engine.stopTyping('conversation-1');
    await runtime.engine.sendMessage('conversation-1', {
      type: 'text',
      content: 'trace the local demo path',
    });

    await vi.waitFor(() => {
      const requestedPaths = fetchMock.mock.calls.map(([input]) => getRequestUrl(input).pathname);
      expect(requestedPaths).toContain('/api/demos/next-backend/conversation');
      expect(requestedPaths).toContain('/api/demos/next-backend/conversations');
      expect(requestedPaths).toContain('/api/demos/next-backend/events');
      expect(requestedPaths).toContain('/api/demos/next-backend/typing');
      expect(requestedPaths).toContain('/api/demos/next-backend/messages');
    });

    const sessionIds = fetchMock.mock.calls
      .map(([input]) => getRequestUrl(input).searchParams.get('sessionId'))
      .filter((value): value is string => typeof value === 'string' && value.length > 0);

    expect(sessionIds.length).toBeGreaterThan(0);
    expect(new Set(sessionIds)).toEqual(new Set([runtime.sessionId]));
    expect(localStorage.getItem(`kaira-chat-demo:session-id:${storageName}`)).toBe(
      runtime.sessionId,
    );
  });

  it('loads paged message history with the session id and persists it to storage', async () => {
    const olderMessage = {
      id: 'older-1',
      conversationId: 'conversation-1',
      sender: {
        id: 'assistant-1',
        role: 'assistant',
        displayName: 'Local Assistant',
      },
      timestamp: 1_710_000_000_000,
      status: 'sent',
      type: 'ai',
      content: 'Older persisted reply.',
      streamState: 'complete',
    } satisfies Message;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = getRequestUrl(input);

        if (url.pathname === '/api/demos/next-backend/messages' && init?.method !== 'POST') {
          expect(url.searchParams.get('conversationId')).toBe('conversation-1');
          expect(url.searchParams.get('direction')).toBe('before');
          expect(url.searchParams.get('cursor')).toBe('message-9');
          expect(url.searchParams.get('limit')).toBe('8');
          expect(url.searchParams.get('sessionId')).toBeTruthy();

          return new Response(
            JSON.stringify({
              success: true,
              data: {
                items: [olderMessage],
                hasMore: true,
                nextCursor: olderMessage.id,
              },
            }),
            {
              headers: {
                'Content-Type': 'application/json',
              },
              status: 200,
            },
          );
        }

        throw new Error(`Unhandled fetch request for ${url.toString()}`);
      },
    );
    globalThis.fetch = fetchMock;

    const runtime = createRuntime(`client-runtime-message-page-${crypto.randomUUID()}`);
    runtimes.push(runtime);

    const page = await runtime.loadMessagesPage('conversation-1', {
      direction: 'before',
      cursor: 'message-9',
      limit: 8,
    });
    const storedMessages = await runtime.storage.getMessages({
      conversationId: 'conversation-1',
      direction: 'asc',
    });

    expect(page).toEqual({
      items: [olderMessage],
      hasMore: true,
      nextCursor: olderMessage.id,
    });
    expect(storedMessages.items).toEqual([olderMessage]);
  });
});
