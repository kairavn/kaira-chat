'use client';

import type { AIMessage } from '@kaira/chat-core';

import { useEffect, useRef, useState } from 'react';

import { useChatEngine } from './chat-context';

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
  const [message, setMessage] = useState<AIMessage | undefined>(undefined);
  const [isStreaming, setIsStreaming] = useState(false);
  const activeMessageIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    activeMessageIdRef.current = undefined;
    setMessage(undefined);
    setIsStreaming(false);

    const unsubStart = engine.on('message:stream:start', (event) => {
      if (event.conversationId !== conversationId) return;
      activeMessageIdRef.current = event.messageId;
      setIsStreaming(true);
      setMessage({
        id: event.messageId,
        conversationId,
        sender: { id: 'assistant:stream', role: 'assistant' },
        timestamp: Date.now(),
        status: 'sent',
        type: 'ai',
        content: '',
        streamState: 'streaming',
      });
    });

    const unsubChunk = engine.on('message:stream:chunk', (event) => {
      if (activeMessageIdRef.current !== event.messageId) return;
      setMessage((current) => {
        if (!current || current.id !== event.messageId) return current;
        return { ...current, content: event.accumulated };
      });
    });

    const unsubEnd = engine.on('message:stream:end', (event) => {
      if (event.message.conversationId !== conversationId) return;
      if (activeMessageIdRef.current !== event.message.id) return;
      activeMessageIdRef.current = undefined;
      setMessage(undefined);
      setIsStreaming(false);
    });

    const unsubError = engine.on('message:stream:error', (event) => {
      if (event.conversationId !== conversationId) return;
      if (activeMessageIdRef.current !== event.messageId) return;
      activeMessageIdRef.current = undefined;
      setMessage(undefined);
      setIsStreaming(false);
    });

    return () => {
      activeMessageIdRef.current = undefined;
      unsubStart();
      unsubChunk();
      unsubEnd();
      unsubError();
    };
  }, [conversationId, engine]);

  return { message, isStreaming };
}
