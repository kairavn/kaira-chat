import type { Conversation, IStorage, Message } from '@kaira/chat-core';

import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IndexedDBStorage } from './IndexedDBStorage';
import { MemoryStorage } from './MemoryStorage';

const TEST_DATABASE_PREFIX = 'kaira-chat-storage-test';

describe('IndexedDBStorage', () => {
  let databaseName: string;
  let originalIndexedDB: IDBFactory | undefined;

  beforeEach(() => {
    databaseName = `${TEST_DATABASE_PREFIX}-${crypto.randomUUID()}`;
    originalIndexedDB = globalThis.indexedDB;
  });

  afterEach(async () => {
    if (originalIndexedDB === undefined) {
      Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        writable: true,
        value: undefined,
      });
    } else {
      Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        writable: true,
        value: originalIndexedDB,
      });
    }
  });

  it('saves, updates, and deletes messages', async () => {
    const storage = new IndexedDBStorage({ databaseName });
    const original = createTextMessage({
      id: 'm-1',
      conversationId: 'c-1',
      timestamp: 1_000,
      content: 'hello',
    });

    await storage.saveMessage(original);
    expect(await storage.getMessage(original.id)).toEqual(original);

    await storage.updateMessage(original.id, {
      status: 'read',
      content: 'hello again',
    });

    expect(await storage.getMessage(original.id)).toEqual({
      ...original,
      status: 'read',
      content: 'hello again',
    });

    await storage.deleteMessage(original.id);
    expect(await storage.getMessage(original.id)).toBeUndefined();
  });

  it('saves, updates, and deletes conversations', async () => {
    const storage = new IndexedDBStorage({ databaseName });
    const conversation = createConversation({
      id: 'c-1',
      updatedAt: 1_000,
      type: 'direct',
      participantIds: ['user-1', 'assistant-1'],
    });

    await storage.saveConversation(conversation);
    expect(await storage.getConversation(conversation.id)).toEqual(conversation);

    await storage.updateConversation(conversation.id, {
      updatedAt: 2_000,
      metadata: { archived: false },
    });

    expect(await storage.getConversation(conversation.id)).toEqual({
      ...conversation,
      updatedAt: 2_000,
      metadata: { archived: false },
    });

    await storage.deleteConversation(conversation.id);
    expect(await storage.getConversation(conversation.id)).toBeUndefined();
  });

  it('supports message pagination with before, after, direction, and cursor', async () => {
    const storage = new IndexedDBStorage({ databaseName });
    const messages = [
      createTextMessage({
        id: 'm-1',
        conversationId: 'c-1',
        timestamp: 1_000,
        content: 'first',
      }),
      createTextMessage({
        id: 'm-2',
        conversationId: 'c-1',
        timestamp: 2_000,
        content: 'second',
      }),
      createTextMessage({
        id: 'm-3',
        conversationId: 'c-1',
        timestamp: 3_000,
        content: 'third',
      }),
      createTextMessage({
        id: 'm-4',
        conversationId: 'c-2',
        timestamp: 4_000,
        content: 'other conversation',
      }),
    ];

    await Promise.all(messages.map(async (message) => storage.saveMessage(message)));

    const ascendingPage = await storage.getMessages({
      conversationId: 'c-1',
      direction: 'asc',
      after: 1_000,
      before: 3_000,
    });
    expect(ascendingPage.items.map((message) => message.id)).toEqual(['m-2']);

    const descendingPage = await storage.getMessages({
      conversationId: 'c-1',
      direction: 'desc',
      limit: 2,
    });
    expect(descendingPage.items.map((message) => message.id)).toEqual(['m-3', 'm-2']);
    expect(descendingPage.hasMore).toBe(true);
    expect(descendingPage.nextCursor).toBe('m-2');

    const nextPage = await storage.getMessages({
      conversationId: 'c-1',
      direction: 'desc',
      limit: 2,
      cursor: descendingPage.nextCursor,
    });
    expect(nextPage.items.map((message) => message.id)).toEqual(['m-1']);
    expect(nextPage.hasMore).toBe(false);
  });

  it('orders conversations by updatedAt descending by default and filters by type and participant', async () => {
    const storage = new IndexedDBStorage({ databaseName });
    const conversations = [
      createConversation({
        id: 'c-1',
        updatedAt: 1_000,
        type: 'direct',
        participantIds: ['user-1', 'assistant-1'],
      }),
      createConversation({
        id: 'c-2',
        updatedAt: 3_000,
        type: 'group',
        participantIds: ['user-1', 'assistant-1', 'user-2'],
      }),
      createConversation({
        id: 'c-3',
        updatedAt: 2_000,
        type: 'direct',
        participantIds: ['user-3', 'assistant-1'],
      }),
    ];

    await Promise.all(
      conversations.map(async (conversation) => storage.saveConversation(conversation)),
    );

    const defaultPage = await storage.getConversations();
    expect(defaultPage.items.map((conversation) => conversation.id)).toEqual(['c-2', 'c-3', 'c-1']);

    const filteredPage = await storage.getConversations({
      type: 'direct',
      participantId: 'assistant-1',
      limit: 1,
    });
    expect(filteredPage.items.map((conversation) => conversation.id)).toEqual(['c-3']);
    expect(filteredPage.nextCursor).toBe('c-3');

    const nextPage = await storage.getConversations({
      type: 'direct',
      participantId: 'assistant-1',
      cursor: filteredPage.nextCursor,
    });
    expect(nextPage.items.map((conversation) => conversation.id)).toEqual(['c-1']);
  });

  it('falls back to in-memory storage when IndexedDB is unavailable', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const storage = new IndexedDBStorage({ databaseName });
    const message = createTextMessage({
      id: 'm-fallback',
      conversationId: 'c-1',
      timestamp: 1_000,
      content: 'fallback message',
    });

    await storage.saveMessage(message);
    expect(await storage.getMessage(message.id)).toEqual(message);
  });

  it('falls back to the configured storage when opening IndexedDB fails', async () => {
    const openSpy = vi.fn();
    const originalOpen = globalThis.indexedDB.open.bind(globalThis.indexedDB);
    globalThis.indexedDB.open = function (): IDBOpenDBRequest {
      openSpy();
      throw new Error('open failed');
    };

    const fallbackStorage = createSpyStorage();
    const onError = vi.fn();
    const storage = new IndexedDBStorage({
      databaseName,
      fallbackStorage,
      onError,
    });
    const message = createTextMessage({
      id: 'm-open-failure',
      conversationId: 'c-1',
      timestamp: 1_000,
      content: 'fallback storage',
    });

    await storage.saveMessage(message);
    expect(openSpy).toHaveBeenCalledOnce();
    expect(fallbackStorage.saveMessage).toHaveBeenCalledWith(message);
    expect(onError).toHaveBeenCalledOnce();

    globalThis.indexedDB.open = originalOpen;
  });

  it('reuses the configured serializer in default fallback mode', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const deserializeMessage = vi.fn((json: string) => JSON.parse(json) as Message);
    const serializer = {
      serializeMessage: (message: Message): string => JSON.stringify(message),
      deserializeMessage,
      serializeConversation: (conversation: Conversation): string => JSON.stringify(conversation),
      deserializeConversation: (json: string) => JSON.parse(json) as Conversation,
    };

    const storage = new IndexedDBStorage({
      databaseName,
      serializer,
    });
    const message = createTextMessage({
      id: 'm-custom-serializer',
      conversationId: 'c-1',
      timestamp: 1_000,
      content: 'before update',
    });

    await storage.saveMessage(message);
    await storage.updateMessage(message.id, {
      content: 'after update',
      status: 'read',
    });

    expect(deserializeMessage).toHaveBeenCalledOnce();
    expect(await storage.getMessage(message.id)).toEqual({
      ...message,
      content: 'after update',
      status: 'read',
    });
  });

  it('persists data across adapter re-instantiation', async () => {
    const firstStorage = new IndexedDBStorage({ databaseName });
    const conversation = createConversation({
      id: 'c-persisted',
      updatedAt: 1_000,
      type: 'direct',
      participantIds: ['user-1', 'assistant-1'],
    });
    const message = createTextMessage({
      id: 'm-persisted',
      conversationId: conversation.id,
      timestamp: 1_500,
      content: 'persisted payload',
    });

    await firstStorage.saveConversation(conversation);
    await firstStorage.saveMessage(message);

    const secondStorage = new IndexedDBStorage({ databaseName });
    expect(await secondStorage.getConversation(conversation.id)).toEqual(conversation);
    expect(await secondStorage.getMessage(message.id)).toEqual(message);
  });

  it('clears stored data', async () => {
    const storage = new IndexedDBStorage({ databaseName });
    const conversation = createConversation({
      id: 'c-clear',
      updatedAt: 1_000,
      type: 'direct',
      participantIds: ['user-1', 'assistant-1'],
    });
    const message = createTextMessage({
      id: 'm-clear',
      conversationId: conversation.id,
      timestamp: 1_500,
      content: 'to be cleared',
    });

    await storage.saveConversation(conversation);
    await storage.saveMessage(message);
    await storage.clear();

    expect(await storage.getConversation(conversation.id)).toBeUndefined();
    expect(await storage.getMessage(message.id)).toBeUndefined();
  });
});

function createTextMessage(params: {
  readonly id: string;
  readonly conversationId: string;
  readonly timestamp: number;
  readonly content: string;
}): Message {
  return {
    id: params.id,
    conversationId: params.conversationId,
    sender: {
      id: 'user-1',
      role: 'user',
    },
    timestamp: params.timestamp,
    status: 'sent',
    type: 'text',
    content: params.content,
  };
}

function createConversation(params: {
  readonly id: string;
  readonly updatedAt: number;
  readonly type: Conversation['type'];
  readonly participantIds: ReadonlyArray<string>;
}): Conversation {
  return {
    id: params.id,
    type: params.type,
    participants: params.participantIds.map((participantId) => ({
      id: participantId,
      role: participantId.startsWith('assistant') ? 'assistant' : 'user',
    })),
    createdAt: params.updatedAt - 100,
    updatedAt: params.updatedAt,
  };
}

function createSpyStorage(): IStorage & {
  readonly saveMessage: ReturnType<typeof vi.fn>;
} {
  const memoryStorage = new MemoryStorage();

  return {
    saveMessage: vi.fn(async (message: Message) => {
      await memoryStorage.saveMessage(message);
    }),
    getMessage: vi.fn(async (id: string) => memoryStorage.getMessage(id)),
    getMessages: vi.fn(async (query) => memoryStorage.getMessages(query)),
    updateMessage: vi.fn(async (id: string, update: Partial<Message>) => {
      await memoryStorage.updateMessage(id, update);
    }),
    deleteMessage: vi.fn(async (id: string) => {
      await memoryStorage.deleteMessage(id);
    }),
    saveConversation: vi.fn(async (conversation: Conversation) => {
      await memoryStorage.saveConversation(conversation);
    }),
    getConversation: vi.fn(async (id: string) => memoryStorage.getConversation(id)),
    getConversations: vi.fn(async (query) => memoryStorage.getConversations(query)),
    updateConversation: vi.fn(async (id: string, update: Partial<Conversation>) => {
      await memoryStorage.updateConversation(id, update);
    }),
    deleteConversation: vi.fn(async (id: string) => {
      await memoryStorage.deleteConversation(id);
    }),
    clear: vi.fn(async () => {
      await memoryStorage.clear();
    }),
  };
}
