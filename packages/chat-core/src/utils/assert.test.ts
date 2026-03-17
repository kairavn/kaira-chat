import type { Message } from '../types/message.js';

import { describe, expect, it } from 'vitest';

import {
  isAIMessage,
  isCustomMessage,
  isFileMessage,
  isImageMessage,
  isSystemMessage,
  isTextMessage,
  isToolCallMessage,
  isToolResultMessage,
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
  {
    ...base,
    type: 'file',
    url: 'https://f.pdf',
    name: 'f.pdf',
    mimeType: 'application/pdf',
    size: 1024,
  },
  { ...base, type: 'system', eventKind: 'participant_joined', content: 'User joined' },
  { ...base, type: 'ai', content: 'Hello!', streamState: 'complete' },
  { ...base, type: 'tool_call', toolCalls: [{ id: 'tc1', name: 'search', arguments: {} }] },
  { ...base, type: 'tool_result', toolCallId: 'tc1', result: 'ok', isError: false },
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
    expect(isFileMessage(messages[2]!)).toBe(true);
    expect(isFileMessage(messages[0]!)).toBe(false);
  });

  it('isSystemMessage narrows correctly', () => {
    expect(isSystemMessage(messages[3]!)).toBe(true);
    expect(isSystemMessage(messages[0]!)).toBe(false);
  });

  it('isAIMessage narrows correctly', () => {
    expect(isAIMessage(messages[4]!)).toBe(true);
    expect(isAIMessage(messages[0]!)).toBe(false);
  });

  it('isToolCallMessage narrows correctly', () => {
    expect(isToolCallMessage(messages[5]!)).toBe(true);
    expect(isToolCallMessage(messages[0]!)).toBe(false);
  });

  it('isToolResultMessage narrows correctly', () => {
    expect(isToolResultMessage(messages[6]!)).toBe(true);
    expect(isToolResultMessage(messages[0]!)).toBe(false);
  });

  it('isCustomMessage narrows correctly', () => {
    expect(isCustomMessage(messages[7]!)).toBe(true);
    expect(isCustomMessage(messages[0]!)).toBe(false);
  });

  it('exactly one guard returns true per message', () => {
    const guards = [
      isTextMessage,
      isImageMessage,
      isFileMessage,
      isSystemMessage,
      isAIMessage,
      isToolCallMessage,
      isToolResultMessage,
      isCustomMessage,
    ];
    for (const msg of messages) {
      const matches = guards.filter((g) => g(msg));
      expect(matches).toHaveLength(1);
    }
  });
});
