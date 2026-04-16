import type { Conversation } from '../types/conversation.js';
import type { Message } from '../types/message.js';

import { describe, expect, it } from 'vitest';

import { ChatSerializer } from './serializer.js';

const serializer = new ChatSerializer();

const baseMessage = {
  id: 'm1',
  conversationId: 'c1',
  sender: { id: 'u1', role: 'user' as const },
  timestamp: 1000,
  status: 'sent' as const,
};

const validMessages: ReadonlyArray<Message> = [
  {
    ...baseMessage,
    type: 'text',
    content: 'hello',
  },
  {
    ...baseMessage,
    type: 'image',
    url: 'https://example.com/image.png',
    alt: 'preview',
    dimensions: { width: 640, height: 480 },
  },
  {
    ...baseMessage,
    type: 'audio',
    url: 'https://example.com/audio.mp3',
    mimeType: 'audio/mpeg',
    title: 'Voice note',
    durationSeconds: 45,
    size: 4096,
  },
  {
    ...baseMessage,
    type: 'video',
    url: 'https://example.com/video.mp4',
    mimeType: 'video/mp4',
    title: 'Walkthrough',
    posterUrl: 'https://example.com/video-poster.jpg',
    dimensions: { width: 1280, height: 720 },
    durationSeconds: 93,
    size: 8192,
  },
  {
    ...baseMessage,
    type: 'file',
    url: 'https://example.com/file.pdf',
    name: 'file.pdf',
    mimeType: 'application/pdf',
    size: 1024,
  },
  {
    ...baseMessage,
    type: 'location',
    latitude: 10.77689,
    longitude: 106.70081,
    label: 'Ho Chi Minh City',
    address: 'District 1, Ho Chi Minh City, Vietnam',
    url: 'https://maps.example.com/location',
  },
  {
    ...baseMessage,
    type: 'system',
    eventKind: 'participant_joined',
    content: 'User joined',
  },
  {
    ...baseMessage,
    type: 'ai',
    content: 'Hello',
    streamState: 'complete',
    aiMetadata: {
      model: 'demo',
      tokensUsed: {
        prompt: 10,
        completion: 12,
        total: 22,
      },
    },
  },
  {
    ...baseMessage,
    type: 'custom',
    customType: 'demo',
    payload: { hello: 'world' },
  },
];

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
      const message = validMessages[0]!;
      const json = serializer.serializeMessage(message);
      const restored = serializer.deserializeMessage(json);
      expect(restored).toEqual(message);
    });

    it('handles all message types', () => {
      for (const message of validMessages) {
        const restored = serializer.deserializeMessage(serializer.serializeMessage(message));
        expect(restored).toEqual(message);
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

    it('throws on malformed sender payload', () => {
      expect(() =>
        serializer.deserializeMessage(
          JSON.stringify({
            ...validMessages[0],
            sender: { role: 'user' },
          }),
        ),
      ).toThrow(/Message.sender.id/);
    });

    it('throws on unknown message type', () => {
      expect(() =>
        serializer.deserializeMessage(JSON.stringify({ ...validMessages[0], type: 'unknown' })),
      ).toThrow(/Unknown Message.type/);
    });

    it('throws on invalid ai stream state', () => {
      expect(() =>
        serializer.deserializeMessage(
          JSON.stringify({
            ...validMessages[7],
            streamState: 'broken',
          }),
        ),
      ).toThrow(/Unknown Message.streamState/);
    });

    it('throws on invalid location coordinates', () => {
      expect(() =>
        serializer.deserializeMessage(
          JSON.stringify({
            ...validMessages[5],
            latitude: 120,
          }),
        ),
      ).toThrow(/Message.latitude/);
    });

    it('throws on invalid media numeric metadata', () => {
      expect(() =>
        serializer.deserializeMessage(
          JSON.stringify({
            ...validMessages[2],
            durationSeconds: -3,
          }),
        ),
      ).toThrow(/Message.durationSeconds/);
    });
  });

  describe('conversation round-trip', () => {
    it('serializes and deserializes a conversation', () => {
      const conversation = makeConversation();
      const json = serializer.serializeConversation(conversation);
      const restored = serializer.deserializeConversation(json);
      expect(restored).toEqual(conversation);
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

    it('throws on malformed participants', () => {
      expect(() =>
        serializer.deserializeConversation(
          JSON.stringify({
            ...makeConversation(),
            participants: [{ role: 'user' }],
          }),
        ),
      ).toThrow(/Conversation.participants\[0\].id/);
    });

    it('throws on unknown conversation type', () => {
      expect(() =>
        serializer.deserializeConversation(
          JSON.stringify({ ...makeConversation(), type: 'unknown' }),
        ),
      ).toThrow(/Unknown Conversation.type/);
    });
  });
});
