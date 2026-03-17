import type { Message } from '../types/message.js';

/**
 * Returns a new array sorted by ascending message timestamp.
 */
export function sortMessagesByTimestamp(messages: ReadonlyArray<Message>): ReadonlyArray<Message> {
  return [...messages].sort((left, right) => left.timestamp - right.timestamp);
}

/**
 * Returns messages without duplicate ids, keeping the latest occurrence.
 */
export function deduplicateMessages(messages: ReadonlyArray<Message>): ReadonlyArray<Message> {
  const unique = new Map<string, Message>();
  for (const message of messages) {
    unique.set(message.id, message);
  }
  return [...unique.values()];
}

/**
 * Merges two message sets, preferring incoming items on id conflict.
 */
export function mergeMessageSets(
  existing: ReadonlyArray<Message>,
  incoming: ReadonlyArray<Message>,
): ReadonlyArray<Message> {
  return sortMessagesByTimestamp(deduplicateMessages([...existing, ...incoming]));
}

/**
 * Safely extracts the client nonce used for optimistic reconciliation.
 */
export function getMessageClientNonce(message: Message): string | undefined {
  return typeof message.metadata?.clientNonce === 'string'
    ? message.metadata.clientNonce
    : undefined;
}
