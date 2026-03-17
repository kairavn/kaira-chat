import type { Conversation } from '../types/conversation.js';
import type { Message } from '../types/message.js';

import { describe, expect, it } from 'vitest';

import { ChatSerializer } from './serializer.js';

const serializer = new ChatSerializer();

const makeMessage = (): Message => ({
  id: 'm1',
  conversationId: 'c1',
  sender: { id: 'u1', role: 'user' },
  timestamp: 1000,
  status: 'sent',
  type: 'text',
  content: 'hello',
});

const makeConversation = (): Conversation => ({
  id: 'c1',
  type: 'direct',
  participants: [{ id: 'u1', role: 'user' }],
  createdAt: 1000,
  updatedAt: 1000,
});

describe('ChatSerializer', () => {
  describe('message round-trip', () => {
    it('serializes and deserializes a text message', () => {
      const msg = makeMessage();
      const json = serializer.serializeMessage(msg);
      const restored = serializer.deserializeMessage(json);
      expect(restored).toEqual(msg);
    });

    it('handles all message types', () => {
      const types: Message['type'][] = [
        'text',
        'image',
        'file',
        'system',
        'ai',
        'tool_call',
        'tool_result',
        'custom',
      ];
      for (const type of types) {
        const raw = JSON.stringify({ ...makeMessage(), type });
        expect(() => serializer.deserializeMessage(raw)).not.toThrow();
      }
    });
  });

  describe('message validation', () => {
    it('throws on invalid JSON', () => {
      expect(() => serializer.deserializeMessage('not json')).toThrow(/Failed to parse/);
    });

    it('throws on non-object', () => {
      expect(() => serializer.deserializeMessage('"string"')).toThrow(/expected an object/);
    });

    it('throws on missing id', () => {
      expect(() =>
        serializer.deserializeMessage(JSON.stringify({ type: 'text', conversationId: 'c1' })),
      ).toThrow(/Message.id/);
    });

    it('throws on missing conversationId', () => {
      expect(() =>
        serializer.deserializeMessage(JSON.stringify({ id: '1', type: 'text' })),
      ).toThrow(/Message.conversationId/);
    });

    it('throws on unknown message type', () => {
      expect(() =>
        serializer.deserializeMessage(
          JSON.stringify({ id: '1', conversationId: 'c1', type: 'unknown' }),
        ),
      ).toThrow(/Unknown message type/);
    });
  });

  describe('conversation round-trip', () => {
    it('serializes and deserializes a conversation', () => {
      const conv = makeConversation();
      const json = serializer.serializeConversation(conv);
      const restored = serializer.deserializeConversation(json);
      expect(restored).toEqual(conv);
    });
  });

  describe('conversation validation', () => {
    it('throws on invalid JSON', () => {
      expect(() => serializer.deserializeConversation('nope')).toThrow(/Failed to parse/);
    });

    it('throws on non-object', () => {
      expect(() => serializer.deserializeConversation('42')).toThrow(/expected an object/);
    });

    it('throws on missing id', () => {
      expect(() => serializer.deserializeConversation(JSON.stringify({ type: 'direct' }))).toThrow(
        /Conversation.id/,
      );
    });

    it('throws on unknown conversation type', () => {
      expect(() =>
        serializer.deserializeConversation(JSON.stringify({ id: '1', type: 'unknown' })),
      ).toThrow(/Unknown conversation type/);
    });
  });
});
