'use client';

import type {
  ChatEvent,
  ConnectionState,
  Conversation,
  ITransport,
  Message,
  TransportEvent,
  Unsubscribe,
} from '@kaira/chat-core';
import type { ReactNode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatEngine, getMessageClientNonce } from '@kaira/chat-core';

import { ChatProvider } from './chat-context';
import { useConnectionState } from './useConnectionState';
import { useConversation } from './useConversation';
import { useMessages } from './useMessages';
import { useOptimisticMessages } from './useOptimisticMessages';
import { useSendMessage } from './useSendMessage';
import { useStreamingMessage } from './useStreamingMessage';

class StatefulTransport implements ITransport<
  TransportEvent<'message'>,
  TransportEvent<'message'>
> {
  private readonly messageHandlers = new Set<(event: TransportEvent<'message'>) => void>();
  private readonly stateHandlers = new Set<(state: ConnectionState) => void>();
  private state: ConnectionState = 'disconnected';

  async connect(): Promise<void> {
    this.setState('connecting');
    this.setState('connected');
  }

  async disconnect(): Promise<void> {
    this.setState('disconnecting');
    this.setState('disconnected');
  }

  async send(_event: TransportEvent<'message'>): Promise<void> {
    return;
  }

  onMessage(handler: (event: TransportEvent<'message'>) => void): Unsubscribe {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onStateChange(handler: (state: ConnectionState) => void): Unsubscribe {
    this.stateHandlers.add(handler);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  getState(): ConnectionState {
    return this.state;
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    for (const handler of this.stateHandlers) {
      handler(state);
    }
  }
}

function createWrapper(engine: ChatEngine) {
  return function Wrapper(props: { readonly children: ReactNode }): ReactNode {
    return <ChatProvider engine={engine}>{props.children}</ChatProvider>;
  };
}

async function createConversation(engine: ChatEngine): Promise<Conversation> {
  return engine.createConversation({
    type: 'direct',
    participants: [
      {
        id: 'self',
        role: 'user',
        displayName: 'Self',
      },
      {
        id: 'assistant',
        role: 'assistant',
        displayName: 'Assistant',
      },
    ],
  });
}

function hasEventBus(value: unknown): value is {
  emit: (event: 'conversation:updated', payload: ChatEvent<'conversation:updated'>) => void;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'emit' in value &&
    typeof value.emit === 'function'
  );
}

function emitConversationUpdated(
  engine: ChatEngine,
  conversation: Conversation,
  previous: Conversation,
): void {
  const eventBusCandidate = Reflect.get(engine, 'eventBus');
  if (!hasEventBus(eventBusCandidate)) {
    throw new Error('ChatEngine event bus is unavailable');
  }

  eventBusCandidate.emit('conversation:updated', {
    type: 'conversation:updated',
    timestamp: Date.now(),
    conversation,
    previous,
  });
}

describe('chat hooks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('useConnectionState reflects connect and disconnect transitions', async () => {
    const transport = new StatefulTransport();
    const engine = new ChatEngine({
      transport,
      sender: { id: 'self', role: 'user' },
    });

    const { result } = renderHook(() => useConnectionState(), {
      wrapper: createWrapper(engine),
    });

    expect(result.current).toBe('disconnected');

    await act(async () => {
      await engine.connect();
    });

    await waitFor(() => {
      expect(result.current).toBe('connected');
    });

    await act(async () => {
      await engine.disconnect();
    });

    await waitFor(() => {
      expect(result.current).toBe('disconnected');
    });
  });

  it('useMessages loads history and reacts to message lifecycle events', async () => {
    const engine = new ChatEngine({
      sender: { id: 'self', role: 'user' },
    });
    const conversation = await createConversation(engine);
    const initialMessage = await engine.sendMessage(conversation.id, {
      type: 'text',
      content: 'first',
    });

    const { result } = renderHook(() => useMessages(conversation.id), {
      wrapper: createWrapper(engine),
    });

    await waitFor(() => {
      expect(result.current.map((message) => message.id)).toEqual([initialMessage.id]);
    });

    let updatedMessage: Message | undefined;
    await act(async () => {
      const secondMessage = await engine.sendMessage(conversation.id, {
        type: 'text',
        content: 'second',
      });
      updatedMessage = await engine.updateMessage(secondMessage.id, {
        content: 'second updated',
      });
      await engine.deleteMessage(initialMessage.id);
      await engine.emitStreamEnd({
        id: 'stream-final',
        conversationId: conversation.id,
        sender: { id: 'assistant', role: 'assistant' },
        timestamp: Date.now(),
        status: 'sent',
        type: 'ai',
        content: 'streamed',
        streamState: 'complete',
      });
    });

    await waitFor(() => {
      expect(result.current.map((message) => message.id)).toEqual([
        updatedMessage?.id,
        'stream-final',
      ]);
      expect(result.current[0]?.type).toBe('text');
      expect(result.current[0]).toEqual(
        expect.objectContaining({
          content: 'second updated',
        }),
      );
    });
  });

  it('useConversation loads the current conversation and reacts to update events', async () => {
    const engine = new ChatEngine({
      sender: { id: 'self', role: 'user' },
    });
    const conversation = await createConversation(engine);

    const { result } = renderHook(() => useConversation(conversation.id), {
      wrapper: createWrapper(engine),
    });

    await waitFor(() => {
      expect(result.current?.id).toBe(conversation.id);
    });

    const nextConversation: Conversation = {
      ...conversation,
      updatedAt: conversation.updatedAt + 100,
      metadata: {
        title: 'Updated title',
      },
    };

    act(() => {
      emitConversationUpdated(engine, nextConversation, conversation);
    });

    await waitFor(() => {
      expect(result.current?.metadata).toEqual({
        title: 'Updated title',
      });
    });
  });

  it('useSendMessage delegates to the engine and returns the sent message', async () => {
    const engine = new ChatEngine({
      sender: { id: 'self', role: 'user' },
    });
    const conversation = await createConversation(engine);

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(engine),
    });

    let sentMessage: Message | undefined;
    await act(async () => {
      sentMessage = await result.current(conversation.id, {
        type: 'text',
        content: 'hello from hook',
      });
    });

    expect(sentMessage).toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        type: 'text',
        content: 'hello from hook',
      }),
    );
  });

  it('useStreamingMessage tracks start, chunk, end, and error lifecycle events', async () => {
    const engine = new ChatEngine({
      sender: { id: 'self', role: 'user' },
    });
    const conversation = await createConversation(engine);

    const { result } = renderHook(() => useStreamingMessage(conversation.id), {
      wrapper: createWrapper(engine),
    });

    act(() => {
      engine.emitStreamStart('stream-1', conversation.id);
      engine.emitStreamChunk('stream-1', 'Hello', 'Hello');
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(true);
      expect(result.current.message).toEqual(
        expect.objectContaining({
          id: 'stream-1',
          content: 'Hello',
          streamState: 'streaming',
        }),
      );
    });

    await act(async () => {
      await engine.emitStreamEnd({
        id: 'stream-1',
        conversationId: conversation.id,
        sender: { id: 'assistant', role: 'assistant' },
        timestamp: Date.now(),
        status: 'sent',
        type: 'ai',
        content: 'Hello',
        streamState: 'complete',
      });
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.message).toBeUndefined();
    });

    act(() => {
      engine.emitStreamStart('stream-2', conversation.id);
      engine.emitStreamError('stream-2', conversation.id, {
        kind: 'transport',
        message: 'failed',
      });
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.message).toBeUndefined();
    });
  });

  it('useOptimisticMessages replaces optimistic entries with the confirmed server message', () => {
    const confirmedMessages: ReadonlyArray<Message> = [
      {
        id: 'confirmed-1',
        conversationId: 'conversation-1',
        sender: { id: 'self', role: 'user' },
        timestamp: 1,
        status: 'sent',
        type: 'text',
        content: 'confirmed',
      },
    ];

    const { result, rerender } = renderHook(
      ({ messages }: { readonly messages: ReadonlyArray<Message> }) =>
        useOptimisticMessages(messages),
      {
        initialProps: { messages: confirmedMessages },
      },
    );

    act(() => {
      result.current.addOptimisticMessage(
        {
          id: 'optimistic-1',
          conversationId: 'conversation-1',
          sender: { id: 'self', role: 'user' },
          timestamp: 2,
          status: 'pending',
          type: 'text',
          content: 'draft',
          metadata: {
            clientNonce: 'nonce-1',
          },
        },
        'nonce-1',
      );
    });

    expect(result.current.optimisticMessages.map((message) => message.id)).toEqual([
      'optimistic-1',
    ]);
    expect(result.current.mergedMessages.map((message) => message.id)).toEqual([
      'confirmed-1',
      'optimistic-1',
    ]);

    expect(result.current.mergedMessages[1]).toEqual(
      expect.objectContaining({
        content: 'draft',
        status: 'pending',
      }),
    );

    rerender({
      messages: [
        ...confirmedMessages,
        {
          id: 'confirmed-2',
          conversationId: 'conversation-1',
          sender: { id: 'self', role: 'user' },
          timestamp: 3,
          status: 'sent',
          type: 'text',
          content: 'server-final copy',
          metadata: {
            clientNonce: 'nonce-1',
          },
        },
      ],
    });

    expect(result.current.mergedMessages.map((message) => message.id)).toEqual([
      'confirmed-1',
      'confirmed-2',
    ]);
    expect(result.current.mergedMessages[1]).toEqual(
      expect.objectContaining({
        content: 'server-final copy',
        status: 'sent',
      }),
    );

    act(() => {
      result.current.reconcileMessage({
        id: 'confirmed-2',
        conversationId: 'conversation-1',
        sender: { id: 'self', role: 'user' },
        timestamp: 3,
        status: 'sent',
        type: 'text',
        content: 'server-final copy',
        metadata: {
          clientNonce: 'nonce-1',
        },
      });
    });

    expect(result.current.optimisticMessages).toHaveLength(0);
    expect(
      result.current.mergedMessages.filter(
        (message) => getMessageClientNonce(message) === 'nonce-1',
      ),
    ).toHaveLength(1);
  });

  it('useOptimisticMessages rolls back optimistic entries by clientNonce', () => {
    const { result } = renderHook(() => useOptimisticMessages([]));

    act(() => {
      result.current.addOptimisticMessage(
        {
          id: 'optimistic-rollback',
          conversationId: 'conversation-1',
          sender: { id: 'self', role: 'user' },
          timestamp: 1,
          status: 'pending',
          type: 'text',
          content: 'will fail',
          metadata: {
            clientNonce: 'nonce-rollback',
          },
        },
        'nonce-rollback',
      );
    });

    expect(result.current.mergedMessages.map((message) => message.id)).toEqual([
      'optimistic-rollback',
    ]);

    act(() => {
      result.current.removeOptimisticMessage('nonce-rollback');
    });

    expect(result.current.optimisticMessages).toHaveLength(0);
    expect(result.current.mergedMessages).toHaveLength(0);
  });
});
