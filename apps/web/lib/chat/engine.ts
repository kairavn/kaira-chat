'use client';

import type { MessageMetadata, TransportEvent } from '@kaira/chat-core';

import { ChatEngine } from '@kaira/chat-core';
import { PollingTransport } from '@kaira/chat-transport-polling';

import { demoConfig } from '@/config/demo';

let engineInstance: ChatEngine | undefined;
let hasLoadedInitialHistory = false;

/**
 * Polls the server-side API route for new messages.
 * API keys stay server-only — the client never touches them.
 */
async function pollServerEvents(
  conversationId: string,
  senderId: string,
): Promise<ReadonlyArray<TransportEvent>> {
  const response = await fetch(
    `/api/chat/events?conversationId=${encodeURIComponent(conversationId)}`,
  );
  if (!response.ok) return [];

  const json = (await response.json()) as {
    success: boolean;
    data?: ReadonlyArray<Record<string, unknown>>;
  };
  if (!json.success || !json.data) return [];

  const includeSelfMessages = !hasLoadedInitialHistory;
  hasLoadedInitialHistory = true;

  const nextItems = includeSelfMessages
    ? json.data
    : json.data.filter((item) => {
        const sender = item['sender'];
        if (!sender || typeof sender !== 'object') return true;
        const senderRecord = sender as Record<string, unknown>;
        return senderRecord['id'] !== senderId;
      });

  return nextItems.map((item) => ({
    type: 'message' as const,
    payload: item,
    timestamp: Date.now(),
  }));
}

/**
 * Sends a message through the server-side API route.
 */
async function sendToServer(event: TransportEvent): Promise<void> {
  if (event.type !== 'message') return;

  const payload = event.payload as Record<string, unknown>;
  const content = typeof payload['content'] === 'string' ? payload['content'] : '';
  const conversationId =
    typeof payload['conversationId'] === 'string' ? payload['conversationId'] : '';
  const metadata = payload['metadata'];
  const requestMetadata =
    metadata && typeof metadata === 'object' ? (metadata as MessageMetadata) : undefined;

  const response = await fetch('/api/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, message: content, metadata: requestMetadata }),
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

  hasLoadedInitialHistory = false;
  const { chatroomId: conversationId, senderId } = demoConfig;

  const transport = new PollingTransport({
    intervalMs: 2000,
    poll: () => pollServerEvents(conversationId, senderId),
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
