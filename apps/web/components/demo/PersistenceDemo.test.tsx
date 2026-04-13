// @vitest-environment jsdom

import type {
  Conversation,
  ConversationQuery,
  CursorPage,
  IStorage,
  Message,
  MessageQuery,
  Participant,
} from '@kaira/chat-core';
import type { Root } from 'react-dom/client';

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearDemoClientRuntimeCache } from '@/lib/demo/client-runtime';

import { DemoRuntimeProvider } from './DemoRuntimeProvider';
import { PersistenceDemo } from './PersistenceDemo';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

interface TestStorageOptions {
  readonly databaseName?: string;
}

interface TestDatabaseState {
  readonly conversations: Map<string, Conversation>;
  readonly messages: Map<string, Message>;
}

interface SeedDatabaseInput {
  readonly conversations?: ReadonlyArray<Conversation>;
  readonly messages?: ReadonlyArray<Message>;
}

const ACTIVE_CONVERSATION_STORAGE_KEY = 'kaira-chat-demo:persistence:active-conversation-id';
const TEST_STORAGE_NAME = 'persistence-demo-integration-test';
const TEST_SENDER = {
  id: 'persistence:user',
  role: 'user',
  displayName: 'SDK Explorer',
} satisfies Participant;

const { PersistentTestStorage, clearTestDatabases, seedTestDatabase } = vi.hoisted(() => {
  const databases = new Map<string, TestDatabaseState>();

  function getDatabase(databaseName: string): TestDatabaseState {
    const existing = databases.get(databaseName);
    if (existing) {
      return existing;
    }

    const created: TestDatabaseState = {
      conversations: new Map<string, Conversation>(),
      messages: new Map<string, Message>(),
    };
    databases.set(databaseName, created);
    return created;
  }

  class HoistedPersistentTestStorage implements IStorage {
    private readonly database: TestDatabaseState;

    constructor(options: TestStorageOptions = {}) {
      this.database = getDatabase(options.databaseName ?? 'default');
    }

    async clear(): Promise<void> {
      this.database.conversations.clear();
      this.database.messages.clear();
    }

    async deleteConversation(id: string): Promise<void> {
      this.database.conversations.delete(id);
    }

    async deleteMessage(id: string): Promise<void> {
      this.database.messages.delete(id);
    }

    async getConversation(id: string): Promise<Conversation | undefined> {
      return this.database.conversations.get(id);
    }

    async getConversations(query?: ConversationQuery): Promise<CursorPage<Conversation>> {
      void query;
      return {
        hasMore: false,
        items: [...this.database.conversations.values()],
      };
    }

    async getMessage(id: string): Promise<Message | undefined> {
      return this.database.messages.get(id);
    }

    async getMessages(query: MessageQuery): Promise<CursorPage<Message>> {
      const items = [...this.database.messages.values()]
        .filter((message) => message.conversationId === query.conversationId)
        .sort((left, right) => left.timestamp - right.timestamp);

      return {
        hasMore: false,
        items,
      };
    }

    async saveConversation(conversation: Conversation): Promise<void> {
      this.database.conversations.set(conversation.id, conversation);
    }

    async saveMessage(message: Message): Promise<void> {
      this.database.messages.set(message.id, message);
    }

    async updateConversation(id: string, update: Partial<Conversation>): Promise<void> {
      void id;
      void update;
    }

    async updateMessage(id: string, update: Partial<Message>): Promise<void> {
      void id;
      void update;
    }
  }

  function clearDatabases(): void {
    databases.clear();
  }

  function seedDatabase(databaseName: string, input: SeedDatabaseInput): void {
    const database = getDatabase(databaseName);
    database.conversations.clear();
    database.messages.clear();

    for (const conversation of input.conversations ?? []) {
      database.conversations.set(conversation.id, conversation);
    }

    for (const message of input.messages ?? []) {
      database.messages.set(message.id, message);
    }
  }

  return {
    PersistentTestStorage: HoistedPersistentTestStorage,
    clearTestDatabases: clearDatabases,
    seedTestDatabase: seedDatabase,
  };
});

vi.mock('@kaira/chat-storage-indexeddb', () => {
  return {
    IndexedDBStorage: PersistentTestStorage,
    MemoryStorage: PersistentTestStorage,
  };
});

const originalFetch = globalThis.fetch;
const originalScrollTo = HTMLElement.prototype.scrollTo;

function createConversation(id: string, title: string): Conversation {
  return {
    id,
    type: 'direct',
    participants: [
      TEST_SENDER,
      {
        id: 'persistence:assistant',
        role: 'assistant',
        displayName: 'Kaira Assistant',
      },
    ],
    metadata: {
      title,
    },
    createdAt: 1_710_000_000_000,
    updatedAt: 1_710_000_000_000,
  };
}

function createTextMessage(id: string, conversationId: string, content: string): Message {
  return {
    id,
    conversationId,
    sender: {
      id: 'persistence:assistant',
      role: 'assistant',
      displayName: 'Kaira Assistant',
    },
    timestamp: 1_710_000_000_000,
    status: 'sent',
    type: 'text',
    content,
  };
}

function createFileMessage(id: string, conversationId: string, name: string): Message {
  return {
    id,
    conversationId,
    sender: {
      id: 'persistence:assistant',
      role: 'assistant',
      displayName: 'Kaira Assistant',
    },
    timestamp: 1_710_000_000_100,
    status: 'sent',
    type: 'file',
    url: '/next.svg',
    name,
    mimeType: 'image/svg+xml',
    size: 3800,
  };
}

function createSystemMessage(id: string, conversationId: string, content: string): Message {
  return {
    id,
    conversationId,
    sender: {
      id: 'persistence:assistant',
      role: 'system',
      displayName: 'Kaira Assistant',
    },
    timestamp: 1_710_000_000_200,
    status: 'sent',
    type: 'system',
    eventKind: 'custom',
    content,
  };
}

function getUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function getRequestUrl(input: RequestInfo | URL): URL {
  return new URL(getUrl(input), 'http://localhost');
}

async function renderPersistenceDemo(container: HTMLDivElement): Promise<Root> {
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <DemoRuntimeProvider
        demoId="persistence"
        apiBasePath="/api/demos/persistence"
        storageName={TEST_STORAGE_NAME}
        sender={TEST_SENDER}
      >
        <PersistenceDemo />
      </DemoRuntimeProvider>,
    );
  });

  return root;
}

function getConversationButton(container: HTMLDivElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find(
    (element): element is HTMLButtonElement => element.textContent?.includes(label) === true,
  );

  if (!button) {
    throw new Error(`Unable to find conversation button for ${label}.`);
  }

  return button;
}

describe('PersistenceDemo', () => {
  afterEach(async () => {
    clearDemoClientRuntimeCache();
    clearTestDatabases();
    window.localStorage.clear();
    globalThis.fetch = originalFetch;
    HTMLElement.prototype.scrollTo = originalScrollTo;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('restores the previously selected conversation after a simulated reload', async () => {
    const onboardingConversation = createConversation('conversation-onboarding', 'Onboarding Flow');
    const assetReviewConversation = createConversation('conversation-assets', 'Asset Review');
    const incidentsConversation = createConversation('conversation-incidents', 'Incidents');

    seedTestDatabase(TEST_STORAGE_NAME, {
      conversations: [onboardingConversation, assetReviewConversation, incidentsConversation],
      messages: [
        createTextMessage(
          'message-onboarding',
          onboardingConversation.id,
          'Welcome to the persistence demo. Reload the page after sending a few messages.',
        ),
        createFileMessage('message-assets', assetReviewConversation.id, 'next-logo.svg'),
        createSystemMessage(
          'message-incidents',
          incidentsConversation.id,
          'Incident review thread created for retry-state verification.',
        ),
      ],
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = getRequestUrl(input);

      if (url.pathname === '/api/demos/persistence/conversations') {
        return new Response(
          JSON.stringify({
            success: true,
            data: [onboardingConversation, assetReviewConversation, incidentsConversation],
          }),
          {
            headers: {
              'Content-Type': 'application/json',
            },
            status: 200,
          },
        );
      }

      if (url.pathname === '/api/demos/persistence/events') {
        return new Response(
          JSON.stringify({
            success: true,
            data: [],
            nextCursor: 'cursor-1',
          }),
          {
            headers: {
              'Content-Type': 'application/json',
            },
            status: 200,
          },
        );
      }

      throw new Error(`Unhandled fetch request for ${url.toString()}`);
    });

    globalThis.fetch = fetchMock;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    HTMLElement.prototype.scrollTo = vi.fn();

    const firstContainer = document.createElement('div');
    document.body.append(firstContainer);
    const firstRoot = await renderPersistenceDemo(firstContainer);

    await vi.waitFor(() => {
      const onboardingButton = getConversationButton(firstContainer, 'Onboarding Flow');
      expect(onboardingButton.getAttribute('aria-pressed')).toBe('true');
      expect(firstContainer.textContent).toContain(
        'Welcome to the persistence demo. Reload the page after sending a few messages.',
      );
    });

    const assetReviewButton = getConversationButton(firstContainer, 'Asset Review');
    await act(async () => {
      assetReviewButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await vi.waitFor(() => {
      const activeAssetReviewButton = getConversationButton(firstContainer, 'Asset Review');
      expect(activeAssetReviewButton.getAttribute('aria-pressed')).toBe('true');
      expect(window.localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY)).toBe(
        assetReviewConversation.id,
      );
      expect(firstContainer.textContent).toContain('next-logo.svg');
    });

    await act(async () => {
      firstRoot.unmount();
    });

    clearDemoClientRuntimeCache();

    const secondContainer = document.createElement('div');
    document.body.append(secondContainer);
    const secondRoot = await renderPersistenceDemo(secondContainer);

    await vi.waitFor(() => {
      const restoredAssetReviewButton = getConversationButton(secondContainer, 'Asset Review');
      expect(restoredAssetReviewButton.getAttribute('aria-pressed')).toBe('true');
      expect(window.localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY)).toBe(
        assetReviewConversation.id,
      );
      expect(secondContainer.textContent).toContain('next-logo.svg');
      expect(secondContainer.textContent).not.toContain(
        'Welcome to the persistence demo. Reload the page after sending a few messages.',
      );
      expect(secondContainer.textContent).not.toContain(
        'Incident review thread created for retry-state verification.',
      );
    });

    await act(async () => {
      secondRoot.unmount();
    });
  });
});
