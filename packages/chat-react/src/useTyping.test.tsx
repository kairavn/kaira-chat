'use client';

import type {
  ConnectionState,
  ConversationTypingState,
  ITransport,
  TransportEvent,
} from '@kaira/chat-core';
import type { ReactNode } from 'react';

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatEngine } from '@kaira/chat-core';

import { ChatProvider } from './chat-context';
import { useTypingController } from './useTypingController';
import { useTypingParticipants } from './useTypingParticipants';
import { useTypingState } from './useTypingState';

function createMockTransport(supportsTyping: boolean = true): ITransport<
  TransportEvent<'typing'>,
  TransportEvent<'typing'>
> & {
  readonly send: ReturnType<typeof vi.fn>;
  simulateTyping: (payload: TransportEvent<'typing'>['payload']) => void;
} {
  const messageHandlers = new Set<(event: TransportEvent<'typing'>) => void>();
  const stateHandlers = new Set<(state: ConnectionState) => void>();

  return {
    capabilities: supportsTyping ? { typing: true } : {},
    connect: async (): Promise<void> => {
      stateHandlers.forEach((handler) => {
        handler('connected');
      });
    },
    disconnect: async (): Promise<void> => {
      stateHandlers.forEach((handler) => {
        handler('disconnected');
      });
    },
    send: vi.fn(async () => {}),
    onMessage(handler) {
      messageHandlers.add(handler);
      return () => {
        messageHandlers.delete(handler);
      };
    },
    onStateChange(handler) {
      stateHandlers.add(handler);
      return () => {
        stateHandlers.delete(handler);
      };
    },
    getState(): ConnectionState {
      return 'connected';
    },
    simulateTyping(payload) {
      for (const handler of messageHandlers) {
        handler({
          type: 'typing',
          payload,
          timestamp: Date.now(),
        });
      }
    },
  };
}

function createWrapper(engine: ChatEngine) {
  return function Wrapper(props: { readonly children: ReactNode }): ReactNode {
    return <ChatProvider engine={engine}>{props.children}</ChatProvider>;
  };
}

class RemoteSelfTypingEngine extends ChatEngine {
  override getTypingState(conversationId: string): ConversationTypingState {
    return {
      conversationId,
      participants: [
        {
          conversationId,
          participant: { id: 'self', role: 'user' },
          startedAt: 1,
          lastUpdatedAt: 1,
          expiresAt: 10,
          source: 'remote',
        },
      ],
    };
  }
}

describe('typing hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('useTypingState reflects start and stop events for the current conversation', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({
      transport,
      sender: { id: 'self', role: 'user' },
    });
    await engine.connect();

    const { result } = renderHook(() => useTypingState('conversation-1'), {
      wrapper: createWrapper(engine),
    });

    await act(async () => {
      transport.simulateTyping({
        action: 'start',
        conversationId: 'conversation-1',
        participant: { id: 'assistant-1', role: 'assistant', displayName: 'Helper' },
      });
    });

    expect(result.current.participants).toHaveLength(1);
    expect(result.current.participants[0]?.participant.id).toBe('assistant-1');

    await act(async () => {
      transport.simulateTyping({
        action: 'stop',
        conversationId: 'conversation-1',
        participant: { id: 'assistant-1', role: 'assistant', displayName: 'Helper' },
      });
    });

    expect(result.current.participants).toHaveLength(0);
  });

  it('useTypingParticipants excludes local typing by default', () => {
    const engine = new ChatEngine({
      sender: { id: 'self', role: 'user' },
    });
    engine.notifyTyping('conversation-1');

    const { result } = renderHook(() => useTypingParticipants('conversation-1'), {
      wrapper: createWrapper(engine),
    });
    const allParticipants = renderHook(
      () => useTypingParticipants('conversation-1', { excludeSelf: false }),
      {
        wrapper: createWrapper(engine),
      },
    );

    expect(result.current).toHaveLength(0);
    expect(allParticipants.result.current).toHaveLength(1);
    expect(allParticipants.result.current[0]?.participant.id).toBe('self');
  });

  it('useTypingParticipants excludes the current participant by id even for remote state', () => {
    const engine = new RemoteSelfTypingEngine({
      sender: { id: 'self', role: 'user' },
    });

    const { result } = renderHook(() => useTypingParticipants('conversation-1'), {
      wrapper: createWrapper(engine),
    });
    const allParticipants = renderHook(
      () => useTypingParticipants('conversation-1', { excludeSelf: false }),
      {
        wrapper: createWrapper(engine),
      },
    );

    expect(result.current).toHaveLength(0);
    expect(allParticipants.result.current).toHaveLength(1);
    expect(allParticipants.result.current[0]?.participant.id).toBe('self');
  });

  it('useTypingController delegates typing actions and exposes transport support', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({
      transport,
      sender: { id: 'self', role: 'user' },
    });
    await engine.connect();

    const { result } = renderHook(() => useTypingController('conversation-1'), {
      wrapper: createWrapper(engine),
    });

    expect(result.current.isSupported).toBe(true);

    act(() => {
      result.current.notifyTyping();
    });

    expect(engine.isTyping('conversation-1', 'self')).toBe(true);
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'typing',
        payload: expect.objectContaining({
          action: 'start',
          conversationId: 'conversation-1',
        }),
      }),
    );

    act(() => {
      result.current.stopTyping();
    });

    expect(engine.isTyping('conversation-1', 'self')).toBe(false);
  });

  it('tears down subscriptions when the conversation id changes', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({
      transport,
      sender: { id: 'self', role: 'user' },
    });
    await engine.connect();

    const { result, rerender } = renderHook(
      ({ conversationId }) => useTypingState(conversationId),
      {
        initialProps: { conversationId: 'conversation-1' },
        wrapper: createWrapper(engine),
      },
    );

    await act(async () => {
      transport.simulateTyping({
        action: 'start',
        conversationId: 'conversation-1',
        participant: { id: 'assistant-1', role: 'assistant' },
      });
    });
    expect(result.current.participants).toHaveLength(1);

    rerender({ conversationId: 'conversation-2' });
    expect(result.current.participants).toHaveLength(0);

    await act(async () => {
      transport.simulateTyping({
        action: 'stop',
        conversationId: 'conversation-1',
        participant: { id: 'assistant-1', role: 'assistant' },
      });
    });
    expect(result.current.participants).toHaveLength(0);
  });
});
