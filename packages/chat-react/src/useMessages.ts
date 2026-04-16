'use client';

import type { Message } from '@kaira/chat-core';

import { useEffect, useState } from 'react';

import { mergeMessageSets } from '@kaira/chat-core';

import { useChatEngine } from './chat-context';

interface MessagesSnapshot {
  readonly conversationId: string;
  readonly messages: ReadonlyArray<Message>;
}

const EMPTY_MESSAGES: ReadonlyArray<Message> = [];

function upsertMessage(
  messages: ReadonlyArray<Message>,
  nextMessage: Message,
): ReadonlyArray<Message> {
  return mergeMessageSets(messages, [nextMessage]);
}

function removeMessageById(
  messages: ReadonlyArray<Message>,
  messageId: string,
): ReadonlyArray<Message> {
  const nextMessages = messages.filter((message) => message.id !== messageId);
  return nextMessages.length === messages.length ? messages : nextMessages;
}

function mergeWithExisting(
  existing: ReadonlyArray<Message>,
  loaded: ReadonlyArray<Message>,
): ReadonlyArray<Message> {
  return mergeMessageSets(loaded, existing);
}

/**
 * Loads and subscribes to messages for a conversation.
 */
export function useMessages(conversationId: string): ReadonlyArray<Message> {
  const engine = useChatEngine();
  const [snapshot, setSnapshot] = useState<MessagesSnapshot>(() => ({
    conversationId,
    messages: EMPTY_MESSAGES,
  }));

  useEffect(() => {
    let isMounted = true;

    const updateMessages = (
      updater: (messages: ReadonlyArray<Message>) => ReadonlyArray<Message>,
    ): void => {
      setSnapshot((current) => {
        const currentMessages =
          current.conversationId === conversationId ? current.messages : EMPTY_MESSAGES;

        return {
          conversationId,
          messages: updater(currentMessages),
        };
      });
    };

    const unsubscribeReceived = engine.on('message:received', (event) => {
      if (event.message.conversationId !== conversationId) return;
      updateMessages((current) => upsertMessage(current, event.message));
    });

    const unsubscribeSent = engine.on('message:sent', (event) => {
      if (event.message.conversationId !== conversationId) return;
      updateMessages((current) => upsertMessage(current, event.message));
    });

    const unsubscribeUpdated = engine.on('message:updated', (event) => {
      if (event.message.conversationId !== conversationId) return;
      updateMessages((current) => upsertMessage(current, event.message));
    });

    const unsubscribeDeleted = engine.on('message:deleted', (event) => {
      if (event.conversationId !== conversationId) return;
      updateMessages((current) => removeMessageById(current, event.messageId));
    });

    const unsubscribeStreamEnd = engine.on('message:stream:end', (event) => {
      if (event.message.conversationId !== conversationId) return;
      updateMessages((current) => upsertMessage(current, event.message));
    });

    const loadMessages = async (): Promise<void> => {
      const page = await engine.getMessages({ conversationId, direction: 'asc' });
      if (!isMounted) return;
      updateMessages((current) => mergeWithExisting(current, page.items));
    };

    const unsubscribeConnection = engine.on('connection:state', (event) => {
      if (event.state !== 'connected') return;
      void loadMessages();
    });

    void loadMessages();

    return () => {
      isMounted = false;
      unsubscribeReceived();
      unsubscribeSent();
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribeStreamEnd();
      unsubscribeConnection();
    };
  }, [conversationId, engine]);

  return snapshot.conversationId === conversationId ? snapshot.messages : EMPTY_MESSAGES;
}
