'use client';

import type { Message } from '@kaira/chat-core';

import { useCallback, useMemo, useState } from 'react';

import { getMessageClientNonce, mergeMessageSets } from '@kaira/chat-core';

interface OptimisticEntry {
  readonly message: Message;
  readonly clientNonce: string;
}

/**
 * Returned API for optimistic message composition.
 */
export interface OptimisticMessagesState {
  readonly optimisticMessages: ReadonlyArray<Message>;
  readonly mergedMessages: ReadonlyArray<Message>;
  readonly addOptimisticMessage: (message: Message, clientNonce: string) => void;
  readonly removeOptimisticMessage: (clientNonce: string) => void;
  readonly reconcileMessage: (message: Message) => void;
}

/**
 * Manages transport-agnostic optimistic messages and reconciliation.
 */
export function useOptimisticMessages(
  confirmedMessages: ReadonlyArray<Message>,
): OptimisticMessagesState {
  const [entries, setEntries] = useState<ReadonlyArray<OptimisticEntry>>([]);

  const optimisticMessages = useMemo(() => entries.map((entry) => entry.message), [entries]);

  const addOptimisticMessage = useCallback((message: Message, clientNonce: string): void => {
    setEntries((current) => {
      const withoutNonce = current.filter((entry) => entry.clientNonce !== clientNonce);
      return [...withoutNonce, { message, clientNonce }];
    });
  }, []);

  const removeOptimisticMessage = useCallback((clientNonce: string): void => {
    setEntries((current) => current.filter((entry) => entry.clientNonce !== clientNonce));
  }, []);

  const reconcileMessage = useCallback(
    (message: Message): void => {
      const clientNonce = getMessageClientNonce(message);
      if (!clientNonce) return;
      removeOptimisticMessage(clientNonce);
    },
    [removeOptimisticMessage],
  );

  const mergedMessages = useMemo(() => {
    const confirmedNonces = new Set(
      confirmedMessages
        .map((message) => getMessageClientNonce(message))
        .filter((nonce): nonce is string => Boolean(nonce)),
    );
    const activeOptimisticMessages = entries
      .filter((entry) => !confirmedNonces.has(entry.clientNonce))
      .map((entry) => entry.message);
    return mergeMessageSets(confirmedMessages, activeOptimisticMessages);
  }, [confirmedMessages, entries]);

  return {
    optimisticMessages,
    mergedMessages,
    addOptimisticMessage,
    removeOptimisticMessage,
    reconcileMessage,
  };
}
