'use client';

import type { ChatEngine } from '@kaira/chat-core';
import type { JSX, ReactNode } from 'react';

import { createContext, useContext, useEffect, useRef } from 'react';

const ChatEngineContext = createContext<ChatEngine | null>(null);

/**
 * Props for `ChatProvider`.
 */
export interface ChatProviderProps {
  readonly engine?: ChatEngine;
  readonly createEngine?: () => ChatEngine;
  readonly children: ReactNode;
  readonly autoConnect?: boolean;
  readonly onConnectError?: (error: Error) => void;
}

/**
 * Provides a ChatEngine instance to React descendants and optionally
 * handles connect/disconnect lifecycle on mount/unmount.
 */
export function ChatProvider(props: ChatProviderProps): JSX.Element {
  const { children, autoConnect = false, onConnectError } = props;
  const engineRef = useRef<ChatEngine | null>(null);
  if (!engineRef.current) {
    if (props.engine) {
      engineRef.current = props.engine;
    } else if (props.createEngine) {
      engineRef.current = props.createEngine();
    } else {
      throw new Error('ChatProvider requires either an engine or createEngine.');
    }
  }
  const engine = engineRef.current;

  useEffect(() => {
    if (!autoConnect) return;
    let isMounted = true;
    const connect = async (): Promise<void> => {
      try {
        await engine.connect();
      } catch (error) {
        if (!isMounted) return;
        const normalizedError =
          error instanceof Error ? error : new Error('Failed to connect ChatEngine');
        onConnectError?.(normalizedError);
      }
    };
    void connect();

    return () => {
      isMounted = false;
      void engine.disconnect();
    };
  }, [autoConnect, engine, onConnectError]);

  return <ChatEngineContext.Provider value={engine}>{children}</ChatEngineContext.Provider>;
}

/**
 * Returns the ChatEngine from context.
 * Throws when used outside `ChatProvider`.
 */
export function useChatEngine(): ChatEngine {
  const engine = useContext(ChatEngineContext);
  if (!engine) {
    throw new Error('useChatEngine must be used within a ChatProvider');
  }
  return engine;
}
