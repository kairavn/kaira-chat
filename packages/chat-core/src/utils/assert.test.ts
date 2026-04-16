import type { Message } from '../types/message.js';

import { describe, expect, it } from 'vitest';

import {
  isAIMessage,
  isAudioMessage,
  isCustomMessage,
  isFileMessage,
  isImageMessage,
  isLocationMessage,
  isSystemMessage,
  isTextMessage,
  isVideoMessage,
} from './assert.js';

const base = {
  id: '1',
  conversationId: 'c1',
  sender: { id: 'u1', role: 'user' as const },
  timestamp: Date.now(),
  status: 'sent' as const,
};

const messages: Message[] = [
  { ...base, type: 'text', content: 'hello' },
  { ...base, type: 'image', url: 'https://img.png' },
  { ...base, type: 'audio', url: 'https://audio.mp3', durationSeconds: 30 },
  { ...base, type: 'video', url: 'https://video.mp4', durationSeconds: 60 },
  {
    ...base,
    type: 'file',
    url: 'https://f.pdf',
    name: 'f.pdf',
    mimeType: 'application/pdf',
    size: 1024,
  },
  { ...base, type: 'location', latitude: 10.77, longitude: 106.7 },
  { ...base, type: 'system', eventKind: 'participant_joined', content: 'User joined' },
  { ...base, type: 'ai', content: 'Hello!', streamState: 'complete' },
  { ...base, type: 'custom', customType: 'poll', payload: {} },
];

describe('type guards', () => {
  it('isTextMessage narrows correctly', () => {
    expect(isTextMessage(messages[0]!)).toBe(true);
    expect(isTextMessage(messages[1]!)).toBe(false);
  });

  it('isImageMessage narrows correctly', () => {
    expect(isImageMessage(messages[1]!)).toBe(true);
    expect(isImageMessage(messages[0]!)).toBe(false);
  });

  it('isFileMessage narrows correctly', () => {
    expect(isFileMessage(messages[4]!)).toBe(true);
    expect(isFileMessage(messages[0]!)).toBe(false);
  });

  it('isAudioMessage narrows correctly', () => {
    expect(isAudioMessage(messages[2]!)).toBe(true);
    expect(isAudioMessage(messages[0]!)).toBe(false);
  });

  it('isVideoMessage narrows correctly', () => {
    expect(isVideoMessage(messages[3]!)).toBe(true);
    expect(isVideoMessage(messages[0]!)).toBe(false);
  });

  it('isLocationMessage narrows correctly', () => {
    expect(isLocationMessage(messages[5]!)).toBe(true);
    expect(isLocationMessage(messages[0]!)).toBe(false);
  });

  it('isSystemMessage narrows correctly', () => {
    expect(isSystemMessage(messages[6]!)).toBe(true);
    expect(isSystemMessage(messages[0]!)).toBe(false);
  });

  it('isAIMessage narrows correctly', () => {
    expect(isAIMessage(messages[7]!)).toBe(true);
    expect(isAIMessage(messages[0]!)).toBe(false);
  });

  it('isCustomMessage narrows correctly', () => {
    expect(isCustomMessage(messages[8]!)).toBe(true);
    expect(isCustomMessage(messages[0]!)).toBe(false);
  });

  it('exactly one guard returns true per message', () => {
    const guards = [
      isTextMessage,
      isImageMessage,
      isAudioMessage,
      isVideoMessage,
      isFileMessage,
      isLocationMessage,
      isSystemMessage,
      isAIMessage,
      isCustomMessage,
    ];
    for (const msg of messages) {
      const matches = guards.filter((g) => g(msg));
      expect(matches).toHaveLength(1);
    }
  });
});
