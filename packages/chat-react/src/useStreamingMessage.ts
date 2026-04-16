'use client';

import type { AIMessage } from '@kaira/chat-core';

import { useEffect, useRef, useState } from 'react';

import { useChatEngine } from './chat-context';

interface StreamingSnapshot {
  readonly conversationId: string;
  readonly message: AIMessage | undefined;
  readonly isStreaming: boolean;
}

const IDLE_STREAMING_STATE: StreamingState = {
  message: undefined,
  isStreaming: false,
};

/**
 * Result of the streaming message hook.
 */
export interface StreamingState {
  /** The synthetic AI message being streamed, or undefined when idle. */
  readonly message: AIMessage | undefined;
  /** Whether a stream is actively in progress. */
  readonly isStreaming: boolean;
}

/**
 * Tracks a streaming AI message for a given conversation.
 *
 * Builds a synthetic `AIMessage` from `stream:start` and `stream:chunk`
 * events and clears it on `stream:end` or `stream:error`.
 */
export function useStreamingMessage(conversationId: string): StreamingState {
  const engine = useChatEngine();
  const [snapshot, setSnapshot] = useState<StreamingSnapshot>(() => ({
    conversationId,
    message: undefined,
    isStreaming: false,
  }));
  const activeMessageIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const unsubStart = engine.on('message:stream:start', (event) => {
      if (event.conversationId !== conversationId) return;
      activeMessageIdRef.current = event.messageId;
      setSnapshot({
        conversationId,
        isStreaming: true,
        message: {
          id: event.messageId,
          conversationId,
          sender: { id: 'assistant:stream', role: 'assistant' },
          timestamp: Date.now(),
          status: 'sent',
          type: 'ai',
          content: '',
          streamState: 'streaming',
        },
      });
    });

    const unsubChunk = engine.on('message:stream:chunk', (event) => {
      if (activeMessageIdRef.current !== event.messageId) return;
      setSnapshot((current) => {
        if (
          current.conversationId !== conversationId ||
          !current.message ||
          current.message.id !== event.messageId
        ) {
          return current;
        }

        return {
          conversationId,
          isStreaming: current.isStreaming,
          message: { ...current.message, content: event.accumulated },
        };
      });
    });

    const unsubEnd = engine.on('message:stream:end', (event) => {
      if (event.message.conversationId !== conversationId) return;
      if (activeMessageIdRef.current !== event.message.id) return;
      activeMessageIdRef.current = undefined;
      setSnapshot({
        conversationId,
        message: undefined,
        isStreaming: false,
      });
    });

    const unsubError = engine.on('message:stream:error', (event) => {
      if (event.conversationId !== conversationId) return;
      if (activeMessageIdRef.current !== event.messageId) return;
      activeMessageIdRef.current = undefined;
      setSnapshot({
        conversationId,
        message: undefined,
        isStreaming: false,
      });
    });

    return () => {
      activeMessageIdRef.current = undefined;
      unsubStart();
      unsubChunk();
      unsubEnd();
      unsubError();
    };
  }, [conversationId, engine]);

  if (snapshot.conversationId !== conversationId) {
    return IDLE_STREAMING_STATE;
  }

  return {
    message: snapshot.message,
    isStreaming: snapshot.isStreaming,
  };
}
