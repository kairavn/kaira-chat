import type { ConversationRecord, MessageRecord } from './records';
import type { DBSchema, IDBPDatabase } from 'idb';

export const DEFAULT_DATABASE_NAME = 'kaira-chat-storage';
export const DEFAULT_DATABASE_VERSION = 1;

export const CONVERSATIONS_STORE = 'conversations';
export const MESSAGES_STORE = 'messages';
export const CONVERSATIONS_BY_UPDATED_AT_INDEX = 'by-updated-at';
export const MESSAGES_BY_CONVERSATION_TIMESTAMP_INDEX = 'by-conversation-timestamp';

export interface ChatStorageDBSchema extends DBSchema {
  conversations: {
    key: string;
    value: ConversationRecord;
    indexes: {
      [CONVERSATIONS_BY_UPDATED_AT_INDEX]: [number, string];
    };
  };
  messages: {
    key: string;
    value: MessageRecord;
    indexes: {
      [MESSAGES_BY_CONVERSATION_TIMESTAMP_INDEX]: [string, number, string];
    };
  };
}

export function upgradeChatStorageDatabase(db: IDBPDatabase<ChatStorageDBSchema>): void {
  if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
    const messageStore = db.createObjectStore(MESSAGES_STORE, {
      keyPath: 'id',
    });
    messageStore.createIndex(MESSAGES_BY_CONVERSATION_TIMESTAMP_INDEX, [
      'conversationId',
      'timestamp',
      'id',
    ]);
  }

  if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
    const conversationStore = db.createObjectStore(CONVERSATIONS_STORE, {
      keyPath: 'id',
    });
    conversationStore.createIndex(CONVERSATIONS_BY_UPDATED_AT_INDEX, ['updatedAt', 'id']);
  }
}
