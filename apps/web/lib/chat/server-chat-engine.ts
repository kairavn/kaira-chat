import type { ChatEvent, CursorPage, Message, MessageMetadata } from '@kaira/chat-core';
import type { DemoMessagePageQuery } from '@/lib/demo/contracts';

import { ChatEngine } from '@kaira/chat-core';
import { DitTransport, fetchDitHistoryPage } from '@kaira/chat-provider-dit';

import { publishChatEvent } from './event-broker';
import { getChatDemoAvailability, getChatDemoConfig } from './server-config';

interface ServerChatEngineContext {
  readonly engine: ChatEngine;
  readonly conversationId: string;
}

let engineContextPromise: Promise<ServerChatEngineContext> | undefined;
let hasCreatedConversation = false;
const CHAT_HISTORY_LIMIT = 2000;

function forwardEvent(event: ChatEvent): void {
  publishChatEvent('dit-modive', event);
}

async function buildContext(): Promise<ServerChatEngineContext> {
  const config = getChatDemoConfig();

  const transport = new DitTransport({
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    chatroomId: config.chatroomId,
    senderId: config.senderId,
    chatbotNickname: config.chatbotNickname,
    initialHistoryLimit: 8,
    initialBackfillPageCount: 1,
    send: {
      apiId: config.apiId,
      sessionId: config.sessionId,
      appContext: config.appContext,
    },
  });

  const engine = new ChatEngine({
    transport,
    sender: {
      id: config.senderId,
      role: 'user',
      displayName: config.appContext.username,
    },
  });

  await engine.connect();
  engine.on('message:received', forwardEvent);
  engine.on('message:stream:start', forwardEvent);
  engine.on('message:stream:chunk', forwardEvent);
  engine.on('message:stream:end', forwardEvent);
  engine.on('message:stream:error', forwardEvent);
  engine.on('typing:start', forwardEvent);
  engine.on('typing:stop', forwardEvent);

  return {
    engine,
    conversationId: config.chatroomId,
  };
}

/**
 * Returns a singleton server-owned ChatEngine.
 */
export async function getServerChatEngineContext(): Promise<ServerChatEngineContext> {
  if (!getChatDemoAvailability().available) {
    throw new Error('The DIT demo is unavailable because its environment variables are missing.');
  }

  if (!engineContextPromise) {
    engineContextPromise = buildContext();
  }
  return engineContextPromise;
}

/**
 * Demonstrates conversation creation while preserving DIT chatroom identity
 * for message operations.
 */
export async function ensureDemoConversationCreated(): Promise<void> {
  if (hasCreatedConversation) {
    return;
  }

  const config = getChatDemoConfig();
  const { engine } = await getServerChatEngineContext();
  await engine.createConversation({
    type: 'direct',
    participants: [
      { id: config.senderId, role: 'user', displayName: config.appContext.username },
      { id: config.chatbotNickname, role: 'assistant', displayName: config.chatbotNickname },
    ],
    metadata: { chatroomId: config.chatroomId },
  });
  hasCreatedConversation = true;
}

/**
 * Sends a user text message through ChatEngine.
 */
export async function sendChatMessage(
  conversationId: string,
  text: string,
  metadata?: MessageMetadata,
): Promise<Message> {
  const { engine } = await getServerChatEngineContext();
  return engine.sendMessage(conversationId, {
    type: 'text',
    content: text,
    ...(metadata ? { metadata } : {}),
  });
}

/**
 * Starts conversation-scoped typing on the server-owned engine.
 */
export async function notifyChatTyping(conversationId: string): Promise<void> {
  const { engine } = await getServerChatEngineContext();
  engine.notifyTyping(conversationId);
}

/**
 * Stops conversation-scoped typing on the server-owned engine.
 */
export async function stopChatTyping(conversationId: string): Promise<void> {
  const { engine } = await getServerChatEngineContext();
  engine.stopTyping(conversationId);
}

/**
 * Reads currently known messages from ChatEngine.
 */
export async function getChatMessages(conversationId: string): Promise<ReadonlyArray<Message>> {
  const { engine } = await getServerChatEngineContext();
  const result = await engine.getMessages({
    conversationId,
    direction: 'asc',
    limit: CHAT_HISTORY_LIMIT,
  });
  return result.items;
}

export async function getChatMessagesPage(
  conversationId: string,
  query: DemoMessagePageQuery,
): Promise<CursorPage<Message>> {
  const config = getChatDemoConfig();
  if (conversationId !== config.chatroomId) {
    return {
      items: [],
      hasMore: false,
    };
  }

  return fetchDitHistoryPage(
    {
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      chatroomId: config.chatroomId,
      senderId: config.senderId,
      chatbotNickname: config.chatbotNickname,
    },
    query,
  );
}

export async function listChatConversations(): Promise<ReadonlyArray<{ readonly id: string }>> {
  const config = getChatDemoConfig();
  await ensureDemoConversationCreated();

  return [{ id: config.chatroomId }];
}
