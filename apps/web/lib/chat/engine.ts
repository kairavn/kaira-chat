'use client';

import type { Message, MessageMetadata, TransportEvent } from '@kaira/chat-core';

import { ChatEngine, ChatSerializer } from '@kaira/chat-core';
import { PollingTransport } from '@kaira/chat-transport-polling';

import { demoConfig } from '@/config/demo';

interface PollEventsResponse {
  readonly success: boolean;
  readonly data: ReadonlyArray<Message>;
  readonly nextCursor?: string;
}

const serializer = new ChatSerializer();

let engineInstance: ChatEngine | undefined;
let pollCursor: string | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    data: data.map((message) => serializer.deserializeMessage(JSON.stringify(message))),
    ...(nextCursor !== undefined ? { nextCursor } : {}),
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
 * Polls the server-side API route for new messages.
 * API keys stay server-only — the client never touches them.
 */
async function pollServerEvents(
  conversationId: string,
): Promise<ReadonlyArray<TransportEvent<'message'>>> {
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

  const nextCursor = json.nextCursor ?? json.data.at(-1)?.id;
  if (nextCursor !== undefined) {
    pollCursor = nextCursor;
  }

  return json.data.map((message) => ({
    type: 'message',
    payload: message,
    timestamp: message.timestamp,
  }));
}

/**
 * Sends a message through the server-side API route.
 */
async function sendToServer(event: TransportEvent<'message'>): Promise<void> {
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
 * Creates or returns a singleton ChatEngine for the browser runtime.
 * All DIT API calls are proxied through Next.js API routes — no API keys on the client.
 */
export function getChatEngine(): ChatEngine {
  if (engineInstance) {
    return engineInstance;
  }

  pollCursor = undefined;
  const { chatroomId: conversationId, senderId } = demoConfig;

  const transport = new PollingTransport({
    intervalMs: 2000,
    poll: () => pollServerEvents(conversationId),
    send: sendToServer,
  });

  engineInstance = new ChatEngine({
    transport,
    sender: {
      id: senderId,
      role: 'user',
    },
  });

  return engineInstance;
}
