import type {
  ChatSerializer,
  Conversation,
  ConversationQuery,
  CursorPage,
  IStorage,
  Message,
  MessageQuery,
} from '@kaira/chat-core';
import type { ChatStorageDBSchema } from './schema';
import type { IDBPDatabase } from 'idb';

import { openDB } from 'idb';

import { ChatSerializer as CoreChatSerializer } from '@kaira/chat-core';

import { MemoryStorage } from './MemoryStorage';
import {
  fromConversationRecord,
  fromMessageRecord,
  toConversationRecord,
  toMessageRecord,
} from './records';
import {
  CONVERSATIONS_BY_UPDATED_AT_INDEX,
  CONVERSATIONS_STORE,
  DEFAULT_DATABASE_NAME,
  DEFAULT_DATABASE_VERSION,
  MESSAGES_BY_CONVERSATION_TIMESTAMP_INDEX,
  MESSAGES_STORE,
  upgradeChatStorageDatabase,
} from './schema';

const MIN_INDEXED_TIMESTAMP = Number.MIN_SAFE_INTEGER;
const MAX_INDEXED_TIMESTAMP = Number.MAX_SAFE_INTEGER;
const MIN_INDEXED_ID = '';
const MAX_INDEXED_ID = '\uffff';

interface SerializerShape {
  readonly serializeMessage: ChatSerializer['serializeMessage'];
  readonly deserializeMessage: ChatSerializer['deserializeMessage'];
  readonly serializeConversation: ChatSerializer['serializeConversation'];
  readonly deserializeConversation: ChatSerializer['deserializeConversation'];
}

export interface IndexedDBStorageOptions {
  readonly databaseName?: string;
  readonly databaseVersion?: number;
  readonly fallbackStorage?: IStorage;
  readonly serializer?: SerializerShape;
  readonly onError?: (error: Error) => void;
}

export class IndexedDBStorage implements IStorage {
  private readonly databaseName: string;
  private readonly databaseVersion: number;
  private readonly fallbackStorage: IStorage;
  private readonly serializer: SerializerShape;
  private readonly onError?: (error: Error) => void;

  private databasePromise?: Promise<IDBPDatabase<ChatStorageDBSchema>>;
  private fallbackActivated = false;

  constructor(options: IndexedDBStorageOptions = {}) {
    this.databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME;
    this.databaseVersion = options.databaseVersion ?? DEFAULT_DATABASE_VERSION;
    this.serializer = options.serializer ?? new CoreChatSerializer();
    this.fallbackStorage = options.fallbackStorage ?? new MemoryStorage(this.serializer);
    this.onError = options.onError;
  }

  async saveMessage(message: Message): Promise<void> {
    await this.withStorage(
      async (database) => {
        await database.put(MESSAGES_STORE, toMessageRecord(message, this.serializer));
      },
      async (storage) => {
        await storage.saveMessage(message);
      },
    );
  }

  async getMessage(id: string): Promise<Message | undefined> {
    return this.withStorage(
      async (database) => {
        const record = await database.get(MESSAGES_STORE, id);
        return record === undefined ? undefined : fromMessageRecord(record, this.serializer);
      },
      async (storage) => storage.getMessage(id),
    );
  }

  async getMessages(query: MessageQuery): Promise<CursorPage<Message>> {
    return this.withStorage(
      async (database) => this.getMessagesFromDatabase(database, query),
      async (storage) => storage.getMessages(query),
    );
  }

  async updateMessage(id: string, update: Partial<Message>): Promise<void> {
    await this.withStorage(
      async (database) => {
        const existingRecord = await database.get(MESSAGES_STORE, id);
        if (existingRecord === undefined) {
          return;
        }

        const existing = fromMessageRecord(existingRecord, this.serializer);
        const nextMessage = this.validateMessageCandidate({ ...existing, ...update });
        await database.put(MESSAGES_STORE, toMessageRecord(nextMessage, this.serializer));
      },
      async (storage) => {
        await storage.updateMessage(id, update);
      },
    );
  }

  async deleteMessage(id: string): Promise<void> {
    await this.withStorage(
      async (database) => {
        await database.delete(MESSAGES_STORE, id);
      },
      async (storage) => {
        await storage.deleteMessage(id);
      },
    );
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    await this.withStorage(
      async (database) => {
        await database.put(
          CONVERSATIONS_STORE,
          toConversationRecord(conversation, this.serializer),
        );
      },
      async (storage) => {
        await storage.saveConversation(conversation);
      },
    );
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.withStorage(
      async (database) => {
        const record = await database.get(CONVERSATIONS_STORE, id);
        return record === undefined ? undefined : fromConversationRecord(record, this.serializer);
      },
      async (storage) => storage.getConversation(id),
    );
  }

  async getConversations(query?: ConversationQuery): Promise<CursorPage<Conversation>> {
    return this.withStorage(
      async (database) => this.getConversationsFromDatabase(database, query),
      async (storage) => storage.getConversations(query),
    );
  }

  async updateConversation(id: string, update: Partial<Conversation>): Promise<void> {
    await this.withStorage(
      async (database) => {
        const existingRecord = await database.get(CONVERSATIONS_STORE, id);
        if (existingRecord === undefined) {
          return;
        }

        const existing = fromConversationRecord(existingRecord, this.serializer);
        const nextConversation = this.validateConversationCandidate({ ...existing, ...update });
        await database.put(
          CONVERSATIONS_STORE,
          toConversationRecord(nextConversation, this.serializer),
        );
      },
      async (storage) => {
        await storage.updateConversation(id, update);
      },
    );
  }

  async deleteConversation(id: string): Promise<void> {
    await this.withStorage(
      async (database) => {
        await database.delete(CONVERSATIONS_STORE, id);
      },
      async (storage) => {
        await storage.deleteConversation(id);
      },
    );
  }

  async clear(): Promise<void> {
    await this.withStorage(
      async (database) => {
        const transaction = database.transaction(
          [CONVERSATIONS_STORE, MESSAGES_STORE],
          'readwrite',
        );
        await Promise.all([
          transaction.objectStore(CONVERSATIONS_STORE).clear(),
          transaction.objectStore(MESSAGES_STORE).clear(),
          transaction.done,
        ]);
      },
      async (storage) => {
        await storage.clear();
      },
    );
  }

  private async getMessagesFromDatabase(
    database: IDBPDatabase<ChatStorageDBSchema>,
    query: MessageQuery,
  ): Promise<CursorPage<Message>> {
    const transaction = database.transaction(MESSAGES_STORE, 'readonly');
    const index = transaction.store.index(MESSAGES_BY_CONVERSATION_TIMESTAMP_INDEX);
    const range = globalThis.IDBKeyRange.bound(
      [
        query.conversationId,
        query.after ?? MIN_INDEXED_TIMESTAMP,
        query.after === undefined ? MIN_INDEXED_ID : MAX_INDEXED_ID,
      ],
      [
        query.conversationId,
        query.before ?? MAX_INDEXED_TIMESTAMP,
        query.before === undefined ? MAX_INDEXED_ID : MIN_INDEXED_ID,
      ],
      query.after !== undefined,
      query.before !== undefined,
    );

    const records = await index.getAll(range);
    await transaction.done;

    const messages = records.map((record) => fromMessageRecord(record, this.serializer));
    const orderedItems = query.direction === 'desc' ? [...messages].reverse() : messages;
    return paginateItems(orderedItems, query.cursor, query.limit);
  }

  private async getConversationsFromDatabase(
    database: IDBPDatabase<ChatStorageDBSchema>,
    query?: ConversationQuery,
  ): Promise<CursorPage<Conversation>> {
    const transaction = database.transaction(CONVERSATIONS_STORE, 'readonly');
    const index = transaction.store.index(CONVERSATIONS_BY_UPDATED_AT_INDEX);
    const records = await index.getAll();
    await transaction.done;

    const filteredRecords = records
      .filter((record) => (query?.type === undefined ? true : record.type === query.type))
      .filter((record) =>
        query?.participantId === undefined
          ? true
          : record.participantIds.includes(query.participantId),
      );

    const orderedRecords =
      (query?.direction ?? 'desc') === 'desc' ? [...filteredRecords].reverse() : filteredRecords;
    const conversations = orderedRecords.map((record) =>
      fromConversationRecord(record, this.serializer),
    );

    return paginateItems(conversations, query?.cursor, query?.limit);
  }

  private async withStorage<TResult>(
    runWithDatabase: (database: IDBPDatabase<ChatStorageDBSchema>) => Promise<TResult>,
    runWithFallback: (storage: IStorage) => Promise<TResult>,
  ): Promise<TResult> {
    if (this.fallbackActivated) {
      return runWithFallback(this.fallbackStorage);
    }

    const database = await this.getDatabase();
    if (database === undefined) {
      return runWithFallback(this.fallbackStorage);
    }

    return runWithDatabase(database);
  }

  private async getDatabase(): Promise<IDBPDatabase<ChatStorageDBSchema> | undefined> {
    if (this.fallbackActivated) {
      return undefined;
    }

    if (!hasIndexedDB()) {
      this.activateFallback(new Error('IndexedDB is unavailable in this environment.'));
      return undefined;
    }

    if (!this.databasePromise) {
      try {
        this.databasePromise = openDB<ChatStorageDBSchema>(
          this.databaseName,
          this.databaseVersion,
          {
            upgrade: (database) => {
              upgradeChatStorageDatabase(database);
            },
            blocked: () => {
              this.reportError(
                new Error('IndexedDB storage open request is blocked by another connection.'),
              );
            },
            terminated: () => {
              this.reportError(new Error('IndexedDB connection terminated unexpectedly.'));
              this.databasePromise = undefined;
            },
          },
        );
      } catch (error) {
        const normalizedError = normalizeError(error, 'Failed to open IndexedDB storage.');
        this.activateFallback(normalizedError);
        return undefined;
      }
    }

    try {
      return await this.databasePromise;
    } catch (error) {
      const normalizedError = normalizeError(error, 'Failed to open IndexedDB storage.');
      this.activateFallback(normalizedError);
      return undefined;
    }
  }

  private activateFallback(error: Error): void {
    if (this.fallbackActivated) {
      return;
    }

    this.fallbackActivated = true;
    this.databasePromise = undefined;
    this.reportError(error);
  }

  private validateMessageCandidate(candidate: unknown): Message {
    return this.serializer.deserializeMessage(JSON.stringify(candidate));
  }

  private validateConversationCandidate(candidate: unknown): Conversation {
    return this.serializer.deserializeConversation(JSON.stringify(candidate));
  }

  private reportError(error: Error): void {
    this.onError?.(error);
  }
}

function hasIndexedDB(): boolean {
  return typeof globalThis.indexedDB !== 'undefined';
}

function paginateItems<TItem extends { readonly id: string }>(
  orderedItems: ReadonlyArray<TItem>,
  cursor?: string,
  limit?: number,
): CursorPage<TItem> {
  const safeLimit = limit ?? Number.POSITIVE_INFINITY;
  const cursorIndex =
    cursor === undefined ? -1 : orderedItems.findIndex((item) => item.id === cursor);
  const pagedSource = cursorIndex >= 0 ? orderedItems.slice(cursorIndex + 1) : orderedItems;
  const items = pagedSource.slice(0, safeLimit);
  const hasMore = pagedSource.length > items.length;
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

  return {
    items,
    hasMore,
    ...(nextCursor === undefined ? {} : { nextCursor }),
  };
}

function normalizeError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
}
