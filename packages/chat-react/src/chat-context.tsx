'use client';

import type { ChatEngine } from '@kaira/chat-core';
import type { JSX, ReactNode } from 'react';

import { createContext, useContext, useEffect, useRef } from 'react';

const ChatEngineContext = createContext<ChatEngine | null>(null);

function normalizeError(error: unknown, fallbackMessage: string): Error {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

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
  const onConnectErrorRef = useRef<typeof onConnectError>(onConnectError);
  const connectAttemptRef = useRef(0);
  const disconnectPromiseRef = useRef<Promise<void> | null>(null);
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
    onConnectErrorRef.current = onConnectError;
  }, [onConnectError]);

  useEffect(() => {
    if (!autoConnect) {
      return;
    }

    let isActive = true;
    const attemptId = connectAttemptRef.current + 1;
    connectAttemptRef.current = attemptId;

    const connect = async (): Promise<void> => {
      try {
        const pendingDisconnect = disconnectPromiseRef.current;
        if (pendingDisconnect) {
          await pendingDisconnect;
        }

        if (!isActive || connectAttemptRef.current !== attemptId) {
          return;
        }

        await engine.connect();
      } catch (error) {
        if (!isActive || connectAttemptRef.current !== attemptId) {
          return;
        }

        const normalizedError = normalizeError(error, 'Failed to connect ChatEngine');
        onConnectErrorRef.current?.(normalizedError);
      }
    };
    void connect();

    return () => {
      isActive = false;
      connectAttemptRef.current++;

      const disconnectPromise = engine
        .disconnect()
        .catch((error) => {
          const normalizedError = normalizeError(error, 'Failed to disconnect ChatEngine');
          onConnectErrorRef.current?.(normalizedError);
        })
        .finally(() => {
          if (disconnectPromiseRef.current === disconnectPromise) {
            disconnectPromiseRef.current = null;
          }
        });

      disconnectPromiseRef.current = disconnectPromise;
    };
  }, [autoConnect, engine]);

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
