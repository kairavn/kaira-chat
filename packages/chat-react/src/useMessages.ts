'use client';

import type { Message } from '@kaira/chat-core';

import { useEffect, useState } from 'react';

import { mergeMessageSets } from '@kaira/chat-core';

import { useChatEngine } from './chat-context';

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
  const [messages, setMessages] = useState<ReadonlyArray<Message>>([]);

  useEffect(() => {
    setMessages([]);
    let isMounted = true;
    const unsubscribeReceived = engine.on('message:received', (event) => {
      if (event.message.conversationId !== conversationId) return;
      setMessages((current) => upsertMessage(current, event.message));
    });

    const unsubscribeSent = engine.on('message:sent', (event) => {
      if (event.message.conversationId !== conversationId) return;
      setMessages((current) => upsertMessage(current, event.message));
    });

    const unsubscribeUpdated = engine.on('message:updated', (event) => {
      if (event.message.conversationId !== conversationId) return;
      setMessages((current) => upsertMessage(current, event.message));
    });

    const unsubscribeDeleted = engine.on('message:deleted', (event) => {
      if (event.conversationId !== conversationId) return;
      setMessages((current) => removeMessageById(current, event.messageId));
    });

    const unsubscribeStreamEnd = engine.on('message:stream:end', (event) => {
      if (event.message.conversationId !== conversationId) return;
      setMessages((current) => upsertMessage(current, event.message));
    });

    const loadMessages = async (): Promise<void> => {
      const page = await engine.getMessages({ conversationId, direction: 'asc' });
      if (!isMounted) return;
      setMessages((current) => mergeWithExisting(current, page.items));
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

  return messages;
}
