import type { Conversation } from '../types/conversation.js';
import type { Message, MessageType } from '../types/message.js';

import { createChatError } from '../types/error.js';

const VALID_MESSAGE_TYPES: ReadonlySet<MessageType> = new Set<MessageType>([
  'text',
  'image',
  'file',
  'system',
  'ai',
  'tool_call',
  'tool_result',
  'custom',
]);

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw createChatError('validation', `${label}: expected an object, got ${typeof value}`);
  }
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') {
    throw createChatError('validation', `${field}: expected string, got ${typeof value}`);
  }
}

/**
 * JSON serialization/deserialization for messages and conversations
 * with runtime type validation.
 */
export class ChatSerializer {
  /** Serialize a Message to a JSON string. */
  serializeMessage(message: Message): string {
    return JSON.stringify(message);
  }

  /** Deserialize a JSON string to a Message with type validation. */
  deserializeMessage(json: string): Message {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json) as unknown;
    } catch (err) {
      throw createChatError('validation', 'Failed to parse message JSON', { cause: err });
    }

    assertRecord(parsed, 'Message');
    assertString(parsed['id'], 'Message.id');
    assertString(parsed['conversationId'], 'Message.conversationId');

    const type = parsed['type'];
    assertString(type, 'Message.type');
    if (!VALID_MESSAGE_TYPES.has(type as MessageType)) {
      throw createChatError('validation', `Unknown message type: "${type}"`);
    }

    return parsed as unknown as Message;
  }

  /** Serialize a Conversation to a JSON string. */
  serializeConversation(conversation: Conversation): string {
    return JSON.stringify(conversation);
  }

  /** Deserialize a JSON string to a Conversation with type validation. */
  deserializeConversation(json: string): Conversation {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json) as unknown;
    } catch (err) {
      throw createChatError('validation', 'Failed to parse conversation JSON', { cause: err });
    }

    assertRecord(parsed, 'Conversation');
    assertString(parsed['id'], 'Conversation.id');
    assertString(parsed['type'], 'Conversation.type');

    const validTypes = new Set(['direct', 'group', 'channel']);
    if (!validTypes.has(parsed['type'] as string)) {
      throw createChatError(
        'validation',
        `Unknown conversation type: "${parsed['type'] as string}"`,
      );
    }

    return parsed as unknown as Conversation;
  }
}
