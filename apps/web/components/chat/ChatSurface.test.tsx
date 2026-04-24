// @vitest-environment jsdom

import type { Message } from '@kaira/chat-core';
import type { ReactNode } from 'react';

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatSurface } from './ChatSurface';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const {
  loadMessagesPage,
  messages,
  notifyTyping,
  removeOptimisticMessage,
  sendMessage,
  stopTyping,
} = vi.hoisted(() => ({
  loadMessagesPage: vi.fn(),
  messages: [] as Message[],
  notifyTyping: vi.fn(),
  removeOptimisticMessage: vi.fn(),
  sendMessage: vi.fn(),
  stopTyping: vi.fn(),
}));

vi.mock('@kaira/chat-react', async () => {
  const actual = await vi.importActual<typeof import('@kaira/chat-react')>('@kaira/chat-react');

  return {
    ...actual,
    useChatEngine: () => ({
      getCurrentParticipant: () => ({
        id: 'user-1',
        role: 'user',
      }),
    }),
    useConnectionState: () => 'connected',
    useMessages: () => messages,
    useOptimisticMessages: (baseMessages: ReadonlyArray<Message>) => ({
      mergedMessages: baseMessages,
      addOptimisticMessage: vi.fn(),
      removeOptimisticMessage,
      reconcileMessage: vi.fn(),
    }),
    useSendMessage: () => sendMessage,
    useStreamingMessage: () => ({
      message: null,
      isStreaming: false,
    }),
    useTypingController: () => ({
      notifyTyping,
      stopTyping,
      isSupported: true,
    }),
    useTypingParticipants: () => [],
  };
});

vi.mock('@kaira/chat-ui', () => ({
  createDefaultRendererRegistry: () => ({}),
  MessageInput: () => null,
  MessageRenderer: ({ message }: { readonly message: Message }) => (
    <span>{message.type === 'text' || message.type === 'ai' ? message.content : message.id}</span>
  ),
  ThinkingIndicator: () => <span>Thinking</span>,
  TypingIndicator: () => <span>Typing</span>,
}));

vi.mock('@/components/demo/DemoRuntimeProvider', () => ({
  useDemoRuntime: () => ({
    loadMessagesPage,
  }),
  useDemoRuntimeReadiness: () => ({
    status: 'ready',
  }),
}));

vi.mock('./ScrollContainer', () => ({
  ScrollContainer: ({
    children,
    onScroll,
    scrollRef,
  }: {
    readonly children: ReactNode;
    readonly onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
    readonly scrollRef: React.RefObject<HTMLDivElement | null>;
  }) => (
    <div
      data-testid="scroll-container"
      ref={scrollRef}
      onScroll={onScroll}
    >
      {children}
    </div>
  ),
}));

function createMessage(id: string, timestamp: number): Message {
  return {
    id,
    conversationId: 'conversation-1',
    sender: {
      id: 'assistant-1',
      role: 'assistant',
    },
    timestamp,
    status: 'sent',
    type: 'text',
    content: id,
  };
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve(value: T): void {
      resolvePromise?.(value);
    },
  };
}

function setScrollMetrics(
  element: HTMLElement,
  metrics: {
    readonly scrollTop: number;
    readonly scrollHeight: number;
    readonly clientHeight: number;
  },
): void {
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    writable: true,
    value: metrics.scrollTop,
  });
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: metrics.scrollHeight,
  });
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: metrics.clientHeight,
  });
}

describe('ChatSurface', () => {
  afterEach(() => {
    messages.length = 0;
    loadMessagesPage.mockReset();
    notifyTyping.mockReset();
    removeOptimisticMessage.mockReset();
    sendMessage.mockReset();
    stopTyping.mockReset();
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
  });

  it('loads one older remote page on top scroll and ignores duplicate scrolls while pending', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
    messages.push(
      createMessage('message-1', 1),
      createMessage('message-2', 2),
      createMessage('message-3', 3),
      createMessage('message-4', 4),
      createMessage('message-5', 5),
      createMessage('message-6', 6),
      createMessage('message-7', 7),
      createMessage('message-8', 8),
    );
    const deferred = createDeferred<{
      readonly items: ReadonlyArray<Message>;
      readonly hasMore: boolean;
    }>();
    loadMessagesPage.mockReturnValueOnce(deferred.promise);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ChatSurface
          title="DIT Provider Demo"
          description="Demo"
          conversationId="conversation-1"
          historyWindow={{
            initialVisibleCount: 8,
            incrementCount: 8,
          }}
        />,
      );
    });

    const scrollContainer = container.querySelector<HTMLElement>(
      '[data-testid="scroll-container"]',
    );
    expect(scrollContainer).not.toBeNull();
    if (!scrollContainer) {
      return;
    }

    await act(async () => {
      setScrollMetrics(scrollContainer, {
        scrollTop: 100,
        scrollHeight: 1000,
        clientHeight: 400,
      });
      scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    await act(async () => {
      scrollContainer.scrollTop = 0;
      scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
      scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    expect(loadMessagesPage).toHaveBeenCalledTimes(1);
    expect(loadMessagesPage).toHaveBeenCalledWith('conversation-1', {
      direction: 'before',
      cursor: 'message-1',
      limit: 8,
    });
    expect(container.textContent).toContain('Loading older messages...');

    await act(async () => {
      deferred.resolve({
        items: [createMessage('older-1', 0)],
        hasMore: false,
      });
      await deferred.promise;
    });

    expect(container.textContent).toContain('older-1');
    expect(container.textContent).not.toContain('Loading older messages...');
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
