// @vitest-environment jsdom

import type {
  Conversation,
  ConversationQuery,
  CursorPage,
  IStorage,
  Message,
  MessageQuery,
  Participant,
} from '@kaira/chat-core';

import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as demoClientRuntimeModule from '@/lib/demo/client-runtime';

import { DemoRuntimeProvider, useDemoRuntimeReadiness } from './DemoRuntimeProvider';
import { SingleConversationDemo } from './SingleConversationDemo';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const { TestStorage } = vi.hoisted(() => {
  class HoistedTestStorage implements IStorage {
    private readonly conversations = new Map<string, Conversation>();
    private readonly messages = new Map<string, Message>();

    async clear(): Promise<void> {
      this.conversations.clear();
      this.messages.clear();
    }

    async deleteConversation(id: string): Promise<void> {
      this.conversations.delete(id);
    }

    async deleteMessage(id: string): Promise<void> {
      this.messages.delete(id);
    }

    async getConversation(id: string): Promise<Conversation | undefined> {
      return this.conversations.get(id);
    }

    async getConversations(query?: ConversationQuery): Promise<CursorPage<Conversation>> {
      void query;
      return {
        hasMore: false,
        items: [...this.conversations.values()],
      };
    }

    async getMessage(id: string): Promise<Message | undefined> {
      return this.messages.get(id);
    }

    async getMessages(query: MessageQuery): Promise<CursorPage<Message>> {
      return {
        hasMore: false,
        items: [...this.messages.values()].filter(
          (message) => message.conversationId === query.conversationId,
        ),
      };
    }

    async saveConversation(conversation: Conversation): Promise<void> {
      this.conversations.set(conversation.id, conversation);
    }

    async saveMessage(message: Message): Promise<void> {
      this.messages.set(message.id, message);
    }

    async updateConversation(id: string, update: Partial<Conversation>): Promise<void> {
      void id;
      void update;
      return;
    }

    async updateMessage(id: string, update: Partial<Message>): Promise<void> {
      void id;
      void update;
      return;
    }
  }

  return {
    TestStorage: HoistedTestStorage,
  };
});

vi.mock('@kaira/chat-storage-indexeddb', () => {
  return {
    IndexedDBStorage: TestStorage,
    MemoryStorage: TestStorage,
  };
});

const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;

function createConversation(): Conversation {
  return {
    id: 'conversation-1',
    type: 'direct',
    participants: [
      {
        id: 'demo:user',
        role: 'user',
        displayName: 'Demo User',
      },
      {
        id: 'demo:assistant',
        role: 'assistant',
        displayName: 'Demo Assistant',
      },
    ],
    createdAt: 1_710_000_000_000,
    updatedAt: 1_710_000_000_000,
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

function createDeferred(): {
  readonly promise: Promise<void>;
  resolve(): void;
} {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve(): void {
      resolvePromise?.();
    },
  };
}

function DemoRuntimeReadinessProbe(): React.JSX.Element {
  const readiness = useDemoRuntimeReadiness();
  return <output data-testid="demo-runtime-readiness">{readiness.status}</output>;
}

describe('DemoRuntimeProvider', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'EventSource', {
      configurable: true,
      value: originalEventSource,
    });
    demoClientRuntimeModule.clearDemoClientRuntimeCache();
    vi.restoreAllMocks();
  });

  it('reuses the demo runtime until the derived runtime key changes', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;

    const sender = {
      id: 'media:user',
      role: 'user',
      displayName: 'SDK Explorer',
    } satisfies Participant;
    const initialStorageName = `demo-runtime-key:${crypto.randomUUID()}`;
    const nextStorageName = `${initialStorageName}:next`;
    const nextConnectDeferred = createDeferred();
    const originalGetOrCreate = demoClientRuntimeModule.getOrCreateDemoClientRuntime;
    let nextRuntimeConnectPatched = false;
    const getOrCreateSpy = vi
      .spyOn(demoClientRuntimeModule, 'getOrCreateDemoClientRuntime')
      .mockImplementation((config) => {
        const runtime = originalGetOrCreate(config);
        if (config.storageName !== nextStorageName || nextRuntimeConnectPatched) {
          return runtime;
        }

        const originalConnect = runtime.engine.connect.bind(runtime.engine);
        Reflect.set(
          runtime.engine,
          'connect',
          vi.fn(async () => {
            await nextConnectDeferred.promise;
            return originalConnect();
          }),
        );
        nextRuntimeConnectPatched = true;
        return runtime;
      });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DemoRuntimeProvider
          demoId="media"
          apiBasePath="/api/demos/media"
          storageName={initialStorageName}
          sender={sender}
        >
          <DemoRuntimeReadinessProbe />
        </DemoRuntimeProvider>,
      );
    });

    expect(getOrCreateSpy).toHaveBeenCalledTimes(1);

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="demo-runtime-readiness"]')?.textContent).toBe(
        'ready',
      );
    });

    await act(async () => {
      root.render(
        <DemoRuntimeProvider
          demoId="media"
          apiBasePath="/api/demos/media"
          storageName={initialStorageName}
          sender={sender}
        >
          <DemoRuntimeReadinessProbe />
        </DemoRuntimeProvider>,
      );
    });

    expect(getOrCreateSpy).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="demo-runtime-readiness"]')?.textContent).toBe(
      'ready',
    );

    await act(async () => {
      root.render(
        <DemoRuntimeProvider
          demoId="media"
          apiBasePath="/api/demos/media"
          storageName={nextStorageName}
          sender={sender}
        >
          <DemoRuntimeReadinessProbe />
        </DemoRuntimeProvider>,
      );
    });

    expect(getOrCreateSpy).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="demo-runtime-readiness"]')?.textContent).toBe(
      'connecting',
    );

    await act(async () => {
      nextConnectDeferred.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="demo-runtime-readiness"]')?.textContent).toBe(
        'ready',
      );
    });

    await act(async () => {
      root.unmount();
    });
  });

  it('mounts a demo child without leaving the composer stuck in connecting state', async () => {
    const bootstrapConversation = createConversation();
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = getRequestUrl(input);

      if (url.pathname === '/api/demos/media/conversation') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              demoId: 'media',
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

      if (url.pathname === '/api/demos/media/events') {
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

      throw new Error(`Unhandled fetch request for ${url.toString()}`);
    });
    globalThis.fetch = fetchMock;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    HTMLElement.prototype.scrollTo = vi.fn();

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <StrictMode>
          <DemoRuntimeProvider
            demoId="media"
            apiBasePath="/api/demos/media"
            storageName={`demo-runtime-test:${crypto.randomUUID()}`}
            sender={{
              id: 'media:user',
              role: 'user',
              displayName: 'SDK Explorer',
            }}
          >
            <SingleConversationDemo
              title="Renderer Demo"
              description="Verify the demo runtime becomes ready."
              quickActions={[
                {
                  id: 'media:image',
                  label: 'Image',
                  description: 'Exercise quick action availability.',
                  prompt: 'Show me an image',
                },
              ]}
            />
          </DemoRuntimeProvider>
        </StrictMode>,
      );
    });

    await vi.waitFor(() => {
      const composer = container.querySelector('textarea');
      const quickAction = container.querySelector('button[type="button"]');

      expect(composer).not.toBeNull();
      expect(composer?.getAttribute('placeholder')).toBe('Type your message...');
      expect(composer?.hasAttribute('disabled')).toBe(false);
      expect(quickAction?.hasAttribute('disabled')).toBe(false);
    });

    await act(async () => {
      root.unmount();
    });
  });

  it('renders the initial demo history loading status before bootstrap completes', async () => {
    const bootstrapConversation = createConversation();
    let resolveConversation: ((response: Response) => void) | undefined;
    const conversationPromise = new Promise<Response>((resolve) => {
      resolveConversation = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = getRequestUrl(input);

      if (url.pathname === '/api/demos/media/conversation') {
        return conversationPromise;
      }

      if (url.pathname === '/api/demos/media/events') {
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

      throw new Error(`Unhandled fetch request for ${url.toString()}`);
    });
    globalThis.fetch = fetchMock;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    HTMLElement.prototype.scrollTo = vi.fn();

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DemoRuntimeProvider
          demoId="media"
          apiBasePath="/api/demos/media"
          storageName={`demo-runtime-loading:${crypto.randomUUID()}`}
          sender={{
            id: 'media:user',
            role: 'user',
            displayName: 'SDK Explorer',
          }}
        >
          <SingleConversationDemo
            title="Renderer Demo"
            description="Verify the demo runtime loading state."
          />
        </DemoRuntimeProvider>,
      );
    });

    const loadingStatus = container.querySelector('[role="status"]');
    expect(loadingStatus?.textContent).toBe('Loading demo history...');

    await act(async () => {
      resolveConversation?.(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              demoId: 'media',
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
        ),
      );
      await conversationPromise;
    });

    await vi.waitFor(() => {
      expect(container.querySelector('textarea')).not.toBeNull();
    });

    await act(async () => {
      root.unmount();
    });
  });

  it('sends only one streaming quick action request while a send is already in flight', async () => {
    const bootstrapConversation = createConversation();
    const sendDeferred = createDeferred();
    let messageRequestCount = 0;
    class TestEventSource {
      constructor(url: string) {
        void url;
      }

      addEventListener(): void {
        return;
      }

      removeEventListener(): void {
        return;
      }

      close(): void {
        return;
      }
    }

    Object.defineProperty(globalThis, 'EventSource', {
      configurable: true,
      value: TestEventSource,
    });
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = getRequestUrl(input);

        if (url.pathname === '/api/demos/streaming/conversation') {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                demoId: 'streaming',
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

        if (url.pathname === '/api/demos/streaming/events') {
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

        if (url.pathname === '/api/demos/streaming/messages' && init?.method === 'POST') {
          messageRequestCount += 1;
          await sendDeferred.promise;
          return new Response('', { status: 200 });
        }

        throw new Error(`Unhandled fetch request for ${url.toString()}`);
      },
    );
    globalThis.fetch = fetchMock;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    HTMLElement.prototype.scrollTo = vi.fn();

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <StrictMode>
          <DemoRuntimeProvider
            demoId="streaming"
            apiBasePath="/api/demos/streaming"
            storageName={`streaming-send-guard:${crypto.randomUUID()}`}
            sender={{
              id: 'streaming:user',
              role: 'user',
              displayName: 'SDK Explorer',
            }}
            enableStreamingBridge
          >
            <SingleConversationDemo
              title="Streaming Demo"
              description="Verify duplicate sends are suppressed."
              quickActions={[
                {
                  id: 'streaming-normal',
                  label: 'Normal Stream',
                  description: 'Run the standard streaming path.',
                  prompt: 'Run the normal stream scenario.',
                  metadata: {
                    demoAction: 'streaming:normal',
                  },
                },
              ]}
            />
          </DemoRuntimeProvider>
        </StrictMode>,
      );
    });

    await vi.waitFor(() => {
      const quickAction = [...container.querySelectorAll('button')].find(
        (element): element is HTMLButtonElement =>
          element.textContent?.includes('Normal Stream') === true,
      );

      expect(quickAction).not.toBeNull();
      expect(quickAction?.hasAttribute('disabled')).toBe(false);
    });

    const quickAction = [...container.querySelectorAll('button')].find(
      (element): element is HTMLButtonElement =>
        element.textContent?.includes('Normal Stream') === true,
    );
    if (!quickAction) {
      throw new Error('Expected the streaming quick action to be rendered.');
    }

    await act(async () => {
      quickAction.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      quickAction.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(messageRequestCount).toBe(1);

    await act(async () => {
      sendDeferred.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      root.unmount();
    });
  });
});
