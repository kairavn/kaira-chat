'use client';

import type {
  Message,
  MessageMetadata,
  TransportEvent,
  TypingTransportPayload,
} from '@kaira/chat-core';

import { ChatEngine, ChatSerializer } from '@kaira/chat-core';
import { IndexedDBStorage } from '@kaira/chat-storage-indexeddb';
import { PollingTransport } from '@kaira/chat-transport-polling';

import { demoConfig } from '@/config/demo';

interface PollEventsResponse {
  readonly success: boolean;
  readonly data: ReadonlyArray<TransportEvent<'message' | 'typing'>>;
  readonly nextCursor?: string;
}

interface SendTypingResponse {
  readonly success: boolean;
}

const serializer = new ChatSerializer();

let engineInstance: ChatEngine | undefined;
let pollCursor: string | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isParticipantRole(value: unknown): value is 'user' | 'assistant' | 'system' | 'custom' {
  return value === 'user' || value === 'assistant' || value === 'system' || value === 'custom';
}

function isTypingTransportPayload(value: unknown): value is TypingTransportPayload {
  return (
    isRecord(value) &&
    (value['action'] === 'start' || value['action'] === 'stop') &&
    typeof value['conversationId'] === 'string' &&
    isRecord(value['participant']) &&
    typeof value['participant']['id'] === 'string' &&
    isParticipantRole(value['participant']['role'])
  );
}

function parseTransportEvent(value: unknown): TransportEvent<'message' | 'typing'> {
  if (
    !isRecord(value) ||
    typeof value['timestamp'] !== 'number' ||
    typeof value['type'] !== 'string'
  ) {
    throw new Error('Poll response event is invalid');
  }

  if (value['type'] === 'message') {
    return {
      type: 'message',
      payload: serializer.deserializeMessage(JSON.stringify(value['payload'])),
      timestamp: value['timestamp'],
    };
  }

  if (value['type'] === 'typing' && isTypingTransportPayload(value['payload'])) {
    return {
      type: 'typing',
      payload: value['payload'],
      timestamp: value['timestamp'],
    };
  }

  throw new Error('Poll response event type is unsupported');
}

function parsePollEventsResponse(value: unknown): PollEventsResponse {
  if (!isRecord(value)) {
    throw new Error('Poll response must be an object');
  }

  if (typeof value['success'] !== 'boolean') {
    throw new Error('Poll response success must be a boolean');
  }

  const data = value['data'];
  if (!Array.isArray(data)) {
    throw new Error('Poll response data must be an array');
  }

  const nextCursor = value['nextCursor'];
  if (nextCursor !== undefined && typeof nextCursor !== 'string') {
    throw new Error('Poll response nextCursor must be a string');
  }

  return {
    success: value['success'],
    data: data.map((item) => parseTransportEvent(item)),
    ...(nextCursor !== undefined ? { nextCursor } : {}),
  };
}

function parseSendTypingResponse(value: unknown): SendTypingResponse {
  if (!isRecord(value) || typeof value['success'] !== 'boolean') {
    throw new Error('Typing response must be an object with a boolean success field');
  }

  return {
    success: value['success'],
  };
}

function extractMessageText(message: Message): string {
  switch (message.type) {
    case 'text':
    case 'ai':
    case 'system':
      return message.content;
    default:
      return '';
  }
}

/**
 * Polls the server-side API route for new message and typing transport events.
 * API keys stay server-only — the client never touches them.
 */
async function pollServerEvents(
  conversationId: string,
): Promise<ReadonlyArray<TransportEvent<'message' | 'typing'>>> {
  const searchParams = new URLSearchParams({
    conversationId,
  });
  if (pollCursor) {
    searchParams.set('cursor', pollCursor);
  }

  const response = await fetch(`/api/chat/events?${searchParams.toString()}`);
  if (!response.ok) {
    return [];
  }

  const json = parsePollEventsResponse(await response.json());
  if (!json.success) {
    return [];
  }

  if (json.nextCursor !== undefined) {
    pollCursor = json.nextCursor;
  }

  return json.data;
}

/**
 * Sends a message through the server-side API route.
 */
async function sendMessageToServer(event: TransportEvent<'message'>): Promise<void> {
  const requestMetadata: MessageMetadata | undefined = event.payload.metadata;

  const response = await fetch('/api/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId: event.payload.conversationId,
      message: extractMessageText(event.payload),
      metadata: requestMetadata,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Send failed (${response.status}): ${text}`);
  }
}

/**
 * Sends a typing update through the server-side API route.
 */
async function sendTypingToServer(event: TransportEvent<'typing'>): Promise<void> {
  const response = await fetch('/api/chat/typing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: event.payload.action,
      conversationId: event.payload.conversationId,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Typing failed (${response.status}): ${text}`);
  }

  const json = parseSendTypingResponse(await response.json());
  if (!json.success) {
    throw new Error('Typing update returned unsuccessful response');
  }
}

async function sendToServer(event: TransportEvent<'message' | 'typing'>): Promise<void> {
  if (event.type === 'message') {
    await sendMessageToServer(event);
    return;
  }

  await sendTypingToServer(event);
}

/**
 * Creates or returns a singleton ChatEngine for the browser runtime.
 * All DIT API calls are proxied through Next.js API routes — no API keys on the client.
 */
export function getChatEngine(): ChatEngine {
  if (engineInstance) {
    return engineInstance;
  }

  pollCursor = undefined;
  const { chatroomId: conversationId, senderId } = demoConfig;
  const storage = new IndexedDBStorage({
    databaseName: `kaira-chat-demo:${conversationId}`,
  });

  const transport = new PollingTransport<
    TransportEvent<'message' | 'typing'>,
    TransportEvent<'message' | 'typing'>
  >({
    capabilities: {
      typing: true,
    },
    intervalMs: 2000,
    poll: () => pollServerEvents(conversationId),
    send: sendToServer,
  });

  engineInstance = new ChatEngine({
    storage,
    transport,
    sender: {
      id: senderId,
      role: 'user',
    },
  });

  return engineInstance;
}
