import type { Message, TextMessage } from '../types/message.js';

import { describe, expect, it } from 'vitest';

import {
  deduplicateMessages,
  getMessageClientNonce,
  mergeMessageSets,
  sortMessagesByTimestamp,
} from './messages.js';

const baseMessage: Omit<TextMessage, 'id' | 'timestamp' | 'content'> = {
  type: 'text',
  conversationId: 'conversation-1',
  sender: { id: 'user-1', role: 'user' },
  status: 'sent',
};

function createTextMessage(
  id: string,
  timestamp: number,
  content: string,
  clientNonce?: string,
): Message {
  return {
    ...baseMessage,
    id,
    timestamp,
    content,
    metadata: clientNonce ? { clientNonce } : undefined,
  };
}

describe('message utilities', () => {
  it('sorts messages by timestamp ascending', () => {
    const sorted = sortMessagesByTimestamp([
      createTextMessage('m2', 20, 'second'),
      createTextMessage('m1', 10, 'first'),
    ]);
    expect(sorted.map((message) => message.id)).toEqual(['m1', 'm2']);
  });

  it('deduplicates by id and keeps latest occurrence', () => {
    const deduped = deduplicateMessages([
      createTextMessage('m1', 10, 'old'),
      createTextMessage('m1', 10, 'new'),
    ]);
    expect(deduped).toHaveLength(1);
    expect((deduped[0] as { content: string }).content).toBe('new');
  });

  it('merges and sorts sets while preferring incoming collisions', () => {
    const merged = mergeMessageSets(
      [createTextMessage('m1', 10, 'existing'), createTextMessage('m2', 30, 'third')],
      [createTextMessage('m1', 10, 'incoming'), createTextMessage('m3', 20, 'second')],
    );
    expect(merged.map((message) => message.id)).toEqual(['m1', 'm3', 'm2']);
    expect((merged[0] as { content: string }).content).toBe('incoming');
  });

  it('extracts client nonce safely from metadata', () => {
    expect(getMessageClientNonce(createTextMessage('m1', 1, 'hello', 'nonce-1'))).toBe('nonce-1');
    expect(getMessageClientNonce(createTextMessage('m2', 2, 'hello'))).toBeUndefined();
  });
});
