import type { ChatSerializer, Conversation, Message } from '@kaira/chat-core';

export interface MessageRecord {
  readonly id: string;
  readonly conversationId: string;
  readonly timestamp: number;
  readonly payload: string;
}

export interface ConversationRecord {
  readonly id: string;
  readonly updatedAt: number;
  readonly type: Conversation['type'];
  readonly participantIds: ReadonlyArray<string>;
  readonly payload: string;
}

interface EntitySerializer {
  readonly serializeMessage: ChatSerializer['serializeMessage'];
  readonly deserializeMessage: ChatSerializer['deserializeMessage'];
  readonly serializeConversation: ChatSerializer['serializeConversation'];
  readonly deserializeConversation: ChatSerializer['deserializeConversation'];
}

export function toMessageRecord(message: Message, serializer: EntitySerializer): MessageRecord {
  return {
    id: message.id,
    conversationId: message.conversationId,
    timestamp: message.timestamp,
    payload: serializer.serializeMessage(message),
  };
}

export function fromMessageRecord(record: MessageRecord, serializer: EntitySerializer): Message {
  return serializer.deserializeMessage(record.payload);
}

export function toConversationRecord(
  conversation: Conversation,
  serializer: EntitySerializer,
): ConversationRecord {
  return {
    id: conversation.id,
    updatedAt: conversation.updatedAt,
    type: conversation.type,
    participantIds: conversation.participants.map((participant) => participant.id),
    payload: serializer.serializeConversation(conversation),
  };
}

export function fromConversationRecord(
  record: ConversationRecord,
  serializer: EntitySerializer,
): Conversation {
  return serializer.deserializeConversation(record.payload);
}
