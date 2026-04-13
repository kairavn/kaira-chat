// @vitest-environment jsdom

'use client';

import type { ChatEvent } from '@kaira/chat-core';

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatEngine } from '@kaira/chat-core';
import { ChatProvider } from '@kaira/chat-react';

import { StreamEventBridge } from './StreamEventBridge';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const hoistedRuntime = vi.hoisted(() => ({
  value: {
    supportsStreamingBridge: true,
    apiBasePath: '/api/demos/streaming',
    sessionId: 'session-1',
  },
}));

vi.mock('./DemoRuntimeProvider', () => ({
  useDemoRuntime: () => hoistedRuntime.value,
}));

type EventListenerEntry = EventListenerOrEventListenerObject;

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly listeners = new Map<string, Set<EventListenerEntry>>();
  closed = false;

  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerEntry): void {
    const current = this.listeners.get(type) ?? new Set<EventListenerEntry>();
    current.add(listener);
    this.listeners.set(type, current);
  }

  removeEventListener(type: string, listener: EventListenerEntry): void {
    const current = this.listeners.get(type);
    if (!current) {
      return;
    }

    current.delete(listener);
    if (current.size === 0) {
      this.listeners.delete(type);
    }
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, payload: unknown): void {
    const current = this.listeners.get(type);
    if (!current || this.closed) {
      return;
    }

    const event = new MessageEvent(type, {
      data: JSON.stringify(payload),
    });

    for (const listener of current) {
      if (typeof listener === 'function') {
        listener(event);
        continue;
      }

      listener.handleEvent(event);
    }
  }
}

function createStreamEngine(): ChatEngine {
  return new ChatEngine({
    sender: {
      id: 'self',
      role: 'user',
    },
  });
}

describe('StreamEventBridge', () => {
  const originalEventSource = globalThis.EventSource;

  afterEach(() => {
    MockEventSource.instances.length = 0;
    globalThis.IS_REACT_ACT_ENVIRONMENT = undefined;
    Object.defineProperty(globalThis, 'EventSource', {
      configurable: true,
      value: originalEventSource,
    });
    vi.restoreAllMocks();
  });

  it('forwards stream lifecycle events into the chat engine and cleans up listeners', async () => {
    Object.defineProperty(globalThis, 'EventSource', {
      configurable: true,
      value: MockEventSource,
    });
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;

    const engine = createStreamEngine();
    const startEvents: ChatEvent<'message:stream:start'>[] = [];
    const chunkEvents: ChatEvent<'message:stream:chunk'>[] = [];
    const errorEvents: ChatEvent<'message:stream:error'>[] = [];

    engine.on('message:stream:start', (event) => {
      startEvents.push(event);
    });
    engine.on('message:stream:chunk', (event) => {
      chunkEvents.push(event);
    });
    engine.on('message:stream:error', (event) => {
      errorEvents.push(event);
    });

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ChatProvider engine={engine}>
          <StreamEventBridge conversationId="conversation-1" />
        </ChatProvider>,
      );
    });

    const source = MockEventSource.instances[0];
    if (!source) {
      throw new Error('Expected StreamEventBridge to create an EventSource');
    }

    expect(source.url).toContain('/api/demos/streaming/events?');
    expect(source.url).toContain('conversationId=conversation-1');
    expect(source.url).toContain('sessionId=session-1');

    act(() => {
      source.emit('message:stream:start', {
        messageId: 'stream-1',
        conversationId: 'conversation-1',
      });
      source.emit('message:stream:chunk', {
        messageId: 'stream-1',
        chunk: 'Hello',
        accumulated: 'Hello',
      });
      source.emit('message:stream:error', {
        messageId: 'stream-1',
        conversationId: 'conversation-1',
        error: {
          kind: 'transport',
          message: 'stream failed',
        },
      });
    });

    expect(startEvents).toEqual([
      expect.objectContaining({
        messageId: 'stream-1',
        conversationId: 'conversation-1',
      }),
    ]);
    expect(chunkEvents).toEqual([
      expect.objectContaining({
        messageId: 'stream-1',
        chunk: 'Hello',
        accumulated: 'Hello',
      }),
    ]);
    expect(errorEvents).toEqual([
      expect.objectContaining({
        messageId: 'stream-1',
        conversationId: 'conversation-1',
        error: expect.objectContaining({
          message: 'stream failed',
        }),
      }),
    ]);

    await act(async () => {
      root.unmount();
    });

    expect(source.closed).toBe(true);
    expect(source.listeners.size).toBe(0);

    act(() => {
      source.emit('message:stream:error', {
        messageId: 'stream-2',
        conversationId: 'conversation-1',
        error: {
          kind: 'transport',
          message: 'late event',
        },
      });
    });

    expect(errorEvents).toHaveLength(1);
  });
});
