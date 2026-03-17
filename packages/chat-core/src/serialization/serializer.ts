import type { ImageDimensions } from '../types/common.js';
import type { Conversation, ConversationType } from '../types/conversation.js';
import type {
  AIMetadata,
  AIStreamState,
  Message,
  MessageMetadata,
  MessageStatus,
  MessageType,
  SystemEventKind,
  ToolCall,
} from '../types/message.js';
import type { Participant, ParticipantRole } from '../types/participant.js';

import { createChatError } from '../types/error.js';

const MESSAGE_TYPES = [
  'text',
  'image',
  'file',
  'system',
  'ai',
  'tool_call',
  'tool_result',
  'custom',
] as const satisfies ReadonlyArray<MessageType>;
const MESSAGE_STATUSES = [
  'pending',
  'sent',
  'delivered',
  'read',
  'failed',
] as const satisfies ReadonlyArray<MessageStatus>;
const CONVERSATION_TYPES = [
  'direct',
  'group',
  'channel',
] as const satisfies ReadonlyArray<ConversationType>;
const PARTICIPANT_ROLES = [
  'user',
  'assistant',
  'system',
  'custom',
] as const satisfies ReadonlyArray<ParticipantRole>;
const SYSTEM_EVENT_KINDS = [
  'participant_joined',
  'participant_left',
  'conversation_renamed',
  'custom',
] as const satisfies ReadonlyArray<SystemEventKind>;
const AI_STREAM_STATES = [
  'idle',
  'streaming',
  'complete',
  'error',
] as const satisfies ReadonlyArray<AIStreamState>;
const AI_FINISH_REASONS = ['stop', 'length', 'tool_calls', 'error'] as const;

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

function assertNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw createChatError('validation', `${field}: expected number, got ${typeof value}`);
  }
}

function parseOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  assertString(value, field);
  return value;
}

function parseOptionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  assertNumber(value, field);
  return value;
}

function parseOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw createChatError('validation', `${field}: expected boolean, got ${typeof value}`);
  }

  return value;
}

function parseStringLiteral<TValue extends string>(
  value: unknown,
  field: string,
  allowed: ReadonlyArray<TValue>,
): TValue {
  assertString(value, field);

  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) {
    throw createChatError('validation', `Unknown ${field}: "${value}"`);
  }

  return match;
}

function parseOptionalRecord(value: unknown, field: string): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  assertRecord(value, field);
  return { ...value };
}

function parseMessageMetadata(value: unknown, field: string): MessageMetadata | undefined {
  const record = parseOptionalRecord(value, field);
  if (record === undefined) {
    return undefined;
  }

  const clientNonce = parseOptionalString(record['clientNonce'], `${field}.clientNonce`);
  return {
    ...record,
    ...(clientNonce !== undefined ? { clientNonce } : {}),
  };
}

function parseParticipant(value: unknown, field: string): Participant {
  assertRecord(value, field);

  return {
    id: parseRequiredString(value['id'], `${field}.id`),
    role: parseStringLiteral(value['role'], `${field}.role`, PARTICIPANT_ROLES),
    ...(parseOptionalString(value['displayName'], `${field}.displayName`) !== undefined
      ? { displayName: parseOptionalString(value['displayName'], `${field}.displayName`) }
      : {}),
    ...(parseOptionalString(value['avatarUrl'], `${field}.avatarUrl`) !== undefined
      ? { avatarUrl: parseOptionalString(value['avatarUrl'], `${field}.avatarUrl`) }
      : {}),
    ...(parseOptionalRecord(value['metadata'], `${field}.metadata`) !== undefined
      ? { metadata: parseOptionalRecord(value['metadata'], `${field}.metadata`) }
      : {}),
  };
}

function parseRequiredString(value: unknown, field: string): string {
  assertString(value, field);
  return value;
}

function parseImageDimensionsValue(value: unknown, field: string): ImageDimensions | undefined {
  if (value === undefined) {
    return undefined;
  }

  assertRecord(value, field);
  return {
    width: parseRequiredNumber(value['width'], `${field}.width`),
    height: parseRequiredNumber(value['height'], `${field}.height`),
  };
}

function parseRequiredNumber(value: unknown, field: string): number {
  assertNumber(value, field);
  return value;
}

function parseToolCall(value: unknown, field: string): ToolCall {
  assertRecord(value, field);
  return {
    id: parseRequiredString(value['id'], `${field}.id`),
    name: parseRequiredString(value['name'], `${field}.name`),
    arguments: parseRequiredRecord(value['arguments'], `${field}.arguments`),
  };
}

function parseRequiredRecord(value: unknown, field: string): Record<string, unknown> {
  assertRecord(value, field);
  return { ...value };
}

function parseToolCalls(value: unknown, field: string): ReadonlyArray<ToolCall> {
  if (!Array.isArray(value)) {
    throw createChatError('validation', `${field}: expected an array`);
  }

  return value.map((item, index) => parseToolCall(item, `${field}[${index}]`));
}

function parseAIMetadata(value: unknown, field: string): AIMetadata | undefined {
  if (value === undefined) {
    return undefined;
  }

  assertRecord(value, field);
  const tokensUsedValue = value['tokensUsed'];
  const tokensUsed =
    tokensUsedValue === undefined
      ? undefined
      : parseTokenUsage(tokensUsedValue, `${field}.tokensUsed`);
  const finishReason = value['finishReason'];
  const parsedFinishReason =
    finishReason === undefined
      ? undefined
      : parseStringLiteral(finishReason, `${field}.finishReason`, AI_FINISH_REASONS);

  return {
    ...(parseOptionalString(value['model'], `${field}.model`) !== undefined
      ? { model: parseOptionalString(value['model'], `${field}.model`) }
      : {}),
    ...(parseOptionalString(value['provider'], `${field}.provider`) !== undefined
      ? { provider: parseOptionalString(value['provider'], `${field}.provider`) }
      : {}),
    ...(tokensUsed !== undefined ? { tokensUsed } : {}),
    ...(parseOptionalNumber(value['latencyMs'], `${field}.latencyMs`) !== undefined
      ? { latencyMs: parseOptionalNumber(value['latencyMs'], `${field}.latencyMs`) }
      : {}),
    ...(parsedFinishReason !== undefined ? { finishReason: parsedFinishReason } : {}),
    ...(parseOptionalRecord(value['metadata'], `${field}.metadata`) !== undefined
      ? { metadata: parseOptionalRecord(value['metadata'], `${field}.metadata`) }
      : {}),
  };
}

function parseTokenUsage(value: unknown, field: string): AIMetadata['tokensUsed'] | undefined {
  if (value === undefined) {
    return undefined;
  }

  assertRecord(value, field);
  return {
    prompt: parseRequiredNumber(value['prompt'], `${field}.prompt`),
    completion: parseRequiredNumber(value['completion'], `${field}.completion`),
    total: parseRequiredNumber(value['total'], `${field}.total`),
  };
}

function parseMessageValue(value: unknown): Message {
  assertRecord(value, 'Message');

  const id = parseRequiredString(value['id'], 'Message.id');
  const conversationId = parseRequiredString(value['conversationId'], 'Message.conversationId');
  const sender = parseParticipant(value['sender'], 'Message.sender');
  const timestamp = parseRequiredNumber(value['timestamp'], 'Message.timestamp');
  const status = parseStringLiteral(value['status'], 'Message.status', MESSAGE_STATUSES);
  const type = parseStringLiteral(value['type'], 'Message.type', MESSAGE_TYPES);
  const metadata = parseMessageMetadata(value['metadata'], 'Message.metadata');

  const shared = {
    id,
    conversationId,
    sender,
    timestamp,
    status,
    ...(metadata !== undefined ? { metadata } : {}),
  };

  switch (type) {
    case 'text':
      return {
        ...shared,
        type,
        content: parseRequiredString(value['content'], 'Message.content'),
      };
    case 'image':
      return {
        ...shared,
        type,
        url: parseRequiredString(value['url'], 'Message.url'),
        ...(parseOptionalString(value['alt'], 'Message.alt') !== undefined
          ? { alt: parseOptionalString(value['alt'], 'Message.alt') }
          : {}),
        ...(parseImageDimensionsValue(value['dimensions'], 'Message.dimensions') !== undefined
          ? { dimensions: parseImageDimensionsValue(value['dimensions'], 'Message.dimensions') }
          : {}),
      };
    case 'file':
      return {
        ...shared,
        type,
        url: parseRequiredString(value['url'], 'Message.url'),
        name: parseRequiredString(value['name'], 'Message.name'),
        mimeType: parseRequiredString(value['mimeType'], 'Message.mimeType'),
        size: parseRequiredNumber(value['size'], 'Message.size'),
      };
    case 'system':
      return {
        ...shared,
        type,
        eventKind: parseStringLiteral(value['eventKind'], 'Message.eventKind', SYSTEM_EVENT_KINDS),
        content: parseRequiredString(value['content'], 'Message.content'),
      };
    case 'ai':
      return {
        ...shared,
        type,
        content: parseRequiredString(value['content'], 'Message.content'),
        streamState: parseStringLiteral(
          value['streamState'],
          'Message.streamState',
          AI_STREAM_STATES,
        ),
        ...(parseAIMetadata(value['aiMetadata'], 'Message.aiMetadata') !== undefined
          ? { aiMetadata: parseAIMetadata(value['aiMetadata'], 'Message.aiMetadata') }
          : {}),
      };
    case 'tool_call':
      return {
        ...shared,
        type,
        toolCalls: parseToolCalls(value['toolCalls'], 'Message.toolCalls'),
      };
    case 'tool_result':
      return {
        ...shared,
        type,
        toolCallId: parseRequiredString(value['toolCallId'], 'Message.toolCallId'),
        result: value['result'],
        isError:
          parseOptionalBoolean(value['isError'], 'Message.isError') ??
          (() => {
            throw createChatError('validation', 'Message.isError: expected boolean');
          })(),
      };
    case 'custom':
      return {
        ...shared,
        type,
        customType: parseRequiredString(value['customType'], 'Message.customType'),
        payload: value['payload'],
      };
  }
}

function parseConversationValue(value: unknown): Conversation {
  assertRecord(value, 'Conversation');

  const metadata = parseOptionalRecord(value['metadata'], 'Conversation.metadata');
  return {
    id: parseRequiredString(value['id'], 'Conversation.id'),
    type: parseStringLiteral(value['type'], 'Conversation.type', CONVERSATION_TYPES),
    participants: parseParticipants(value['participants'], 'Conversation.participants'),
    createdAt: parseRequiredNumber(value['createdAt'], 'Conversation.createdAt'),
    updatedAt: parseRequiredNumber(value['updatedAt'], 'Conversation.updatedAt'),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

function parseParticipants(value: unknown, field: string): ReadonlyArray<Participant> {
  if (!Array.isArray(value)) {
    throw createChatError('validation', `${field}: expected an array`);
  }

  return value.map((participant, index) => parseParticipant(participant, `${field}[${index}]`));
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
      parsed = JSON.parse(json);
    } catch (err) {
      throw createChatError('validation', 'Failed to parse message JSON', { cause: err });
    }

    return parseMessageValue(parsed);
  }

  /** Serialize a Conversation to a JSON string. */
  serializeConversation(conversation: Conversation): string {
    return JSON.stringify(conversation);
  }

  /** Deserialize a JSON string to a Conversation with type validation. */
  deserializeConversation(json: string): Conversation {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      throw createChatError('validation', 'Failed to parse conversation JSON', { cause: err });
    }

    return parseConversationValue(parsed);
  }
}
