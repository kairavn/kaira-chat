'use client';

import type {
  ChatError,
  ChatSerializer,
  Conversation,
  Message,
  Participant,
  TransportEvent,
  TypingTransportPayload,
} from '@kaira/chat-core';
import type { DemoId } from '@/config/demo-registry';
import type { DemoConversationBootstrap, DemoPollEventsResponse } from '@/lib/demo/contracts';

import { ChatEngine, createChatError, ChatSerializer as Serializer } from '@kaira/chat-core';
import { IndexedDBStorage } from '@kaira/chat-storage-indexeddb';
import { PollingTransport } from '@kaira/chat-transport-polling';

import { DEMO_DEFINITIONS } from '@/config/demo-registry';

interface DemoClientRuntimeConfig {
  readonly demoId: DemoId;
  readonly apiBasePath: string;
  readonly storageName: string;
  readonly sender: Participant;
  readonly pollIntervalMs?: number;
  readonly enableStreamingBridge?: boolean;
}

export interface DemoClientRuntime {
  readonly demoId: DemoId;
  readonly apiBasePath: string;
  readonly sessionId: string;
  readonly engine: ChatEngine;
  readonly storage: IndexedDBStorage;
  readonly sender: Participant;
  readonly supportsStreamingBridge: boolean;
  setActiveConversationId(conversationId: string | null): void;
  bootstrapConversation(): Promise<DemoConversationBootstrap>;
  listConversations(): Promise<ReadonlyArray<Conversation>>;
  syncConversations(conversations: ReadonlyArray<Conversation>): Promise<void>;
}

interface SendTypingResponse {
  readonly success: boolean;
}

interface StreamStartEventPayload {
  readonly messageId: string;
  readonly conversationId: string;
}

interface StreamChunkEventPayload {
  readonly messageId: string;
  readonly chunk: string;
  readonly accumulated: string;
}

interface StreamEndEventPayload {
  readonly message: Message;
}

interface StreamErrorEventPayload {
  readonly messageId: string;
  readonly conversationId: string;
  readonly error?: ChatError;
}

interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const serializer: ChatSerializer = new Serializer();
const runtimeCache = new Map<string, DemoClientRuntime>();
const DEMO_SESSION_STORAGE_KEY_PREFIX = 'kaira-chat-demo:session-id';

// Used by jsdom integration tests to simulate a full page reload.
export function clearDemoClientRuntimeCache(): void {
  runtimeCache.clear();
}

function isKnownDemoId(value: string): value is DemoId {
  return DEMO_DEFINITIONS.some((definition) => definition.id === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBrowserStorageLike(value: unknown): value is BrowserStorageLike {
  return (
    isRecord(value) &&
    typeof value['getItem'] === 'function' &&
    typeof value['setItem'] === 'function'
  );
}

function getBrowserStorage(): BrowserStorageLike | null {
  const storageCandidate = Reflect.get(globalThis, 'localStorage');
  return isBrowserStorageLike(storageCandidate) ? storageCandidate : null;
}

function normalizeStoredSessionId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function getDemoSessionStorageKey(storageName: string): string {
  return `${DEMO_SESSION_STORAGE_KEY_PREFIX}:${storageName}`;
}

function getOrCreateDemoSessionId(storageName: string): string {
  const storage = getBrowserStorage();
  if (!storage) {
    return crypto.randomUUID();
  }

  const storageKey = getDemoSessionStorageKey(storageName);
  const storedSessionId = normalizeStoredSessionId(storage.getItem(storageKey));
  if (storedSessionId) {
    return storedSessionId;
  }

  const nextSessionId = crypto.randomUUID();
  storage.setItem(storageKey, nextSessionId);
  return nextSessionId;
}

export function buildDemoRouteUrl(
  apiBasePath: string,
  path: string,
  sessionId: string,
  searchParams?: URLSearchParams,
): string {
  const nextSearchParams = new URLSearchParams(searchParams);
  nextSearchParams.set('sessionId', sessionId);
  const queryString = nextSearchParams.toString();
  return `${apiBasePath}/${path}${queryString.length > 0 ? `?${queryString}` : ''}`;
}

function parseString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }

  return value;
}

function parseDemoId(value: unknown): DemoId {
  const demoId = parseString(value, 'DemoConversationBootstrap.demoId');
  if (!isKnownDemoId(demoId)) {
    throw new Error('DemoConversationBootstrap.demoId is invalid');
  }

  return demoId;
}

function parseNumber(value: unknown, field: string): number {
  if (typeof value !== 'number') {
    throw new Error(`${field} must be a number`);
  }

  return value;
}

function parseParticipant(value: unknown, field: string): Participant {
  if (!isRecord(value)) {
    throw new Error(`${field} must be an object`);
  }

  const role = value['role'];
  if (role !== 'user' && role !== 'assistant' && role !== 'system' && role !== 'custom') {
    throw new Error(`${field}.role is invalid`);
  }

  const displayName = value['displayName'];
  const avatarUrl = value['avatarUrl'];

  return {
    id: parseString(value['id'], `${field}.id`),
    role,
    ...(typeof displayName === 'string' ? { displayName } : {}),
    ...(typeof avatarUrl === 'string' ? { avatarUrl } : {}),
  };
}

function parseConversation(value: unknown, field: string): Conversation {
  if (!isRecord(value)) {
    throw new Error(`${field} must be an object`);
  }

  const type = value['type'];
  if (type !== 'direct' && type !== 'group' && type !== 'channel') {
    throw new Error(`${field}.type is invalid`);
  }

  const participants = value['participants'];
  if (!Array.isArray(participants)) {
    throw new Error(`${field}.participants must be an array`);
  }

  const metadata = value['metadata'];
  if (metadata !== undefined && !isRecord(metadata)) {
    throw new Error(`${field}.metadata must be an object when present`);
  }

  return {
    id: parseString(value['id'], `${field}.id`),
    type,
    participants: participants.map((participant, index) =>
      parseParticipant(participant, `${field}.participants[${index}]`),
    ),
    ...(metadata ? { metadata } : {}),
    createdAt: parseNumber(value['createdAt'], `${field}.createdAt`),
    updatedAt: parseNumber(value['updatedAt'], `${field}.updatedAt`),
  };
}

function isTypingTransportPayload(value: unknown): value is TypingTransportPayload {
  return (
    isRecord(value) &&
    (value['action'] === 'start' || value['action'] === 'stop') &&
    typeof value['conversationId'] === 'string' &&
    isRecord(value['participant']) &&
    typeof value['participant']['id'] === 'string'
  );
}

function parseTransportEvent(value: unknown): TransportEvent<'message' | 'typing'> {
  if (!isRecord(value)) {
    throw new Error('Transport event must be an object');
  }

  if (value['type'] === 'message') {
    return {
      type: 'message',
      payload: serializer.deserializeMessage(JSON.stringify(value['payload'])),
      timestamp: parseNumber(value['timestamp'], 'TransportEvent.timestamp'),
    };
  }

  if (value['type'] === 'typing' && isTypingTransportPayload(value['payload'])) {
    return {
      type: 'typing',
      payload: value['payload'],
      timestamp: parseNumber(value['timestamp'], 'TransportEvent.timestamp'),
    };
  }

  throw new Error('Unsupported transport event type');
}

function parseDemoPollEventsResponse(value: unknown): DemoPollEventsResponse {
  if (!isRecord(value) || value['success'] !== true) {
    throw new Error('Expected a successful polling response');
  }

  const data = value['data'];
  if (!Array.isArray(data)) {
    throw new Error('Polling response data must be an array');
  }

  const nextCursor = value['nextCursor'];
  if (nextCursor !== undefined && typeof nextCursor !== 'string') {
    throw new Error('Polling response nextCursor must be a string when present');
  }

  return {
    success: true,
    data: data.map((item) => parseTransportEvent(item)),
    ...(typeof nextCursor === 'string' ? { nextCursor } : {}),
  };
}

function parseDemoRouteResponse<TData>(
  value: unknown,
  dataParser: (data: unknown) => TData,
): TData {
  if (!isRecord(value) || typeof value['success'] !== 'boolean') {
    throw new Error('Route response must include a boolean success field');
  }

  if (value['success'] === false) {
    throw new Error(
      typeof value['error'] === 'string' ? value['error'] : 'The demo route returned an error.',
    );
  }

  return dataParser(value['data']);
}

function parseBootstrapResponse(value: unknown): DemoConversationBootstrap {
  return parseDemoRouteResponse(value, (data) => {
    if (!isRecord(data)) {
      throw new Error('Bootstrap data must be an object');
    }

    return {
      demoId: parseDemoId(data['demoId']),
      conversationId: parseString(
        data['conversationId'],
        'DemoConversationBootstrap.conversationId',
      ),
      conversation: parseConversation(
        data['conversation'],
        'DemoConversationBootstrap.conversation',
      ),
    };
  });
}

function parseConversationsResponse(value: unknown): ReadonlyArray<Conversation> {
  return parseDemoRouteResponse(value, (data) => {
    if (!Array.isArray(data)) {
      throw new Error('Conversations payload must be an array');
    }

    return data.map((conversation, index) =>
      parseConversation(conversation, `Conversations[${index}]`),
    );
  });
}

function parseSendTypingResponse(value: unknown): SendTypingResponse {
  if (!isRecord(value) || typeof value['success'] !== 'boolean') {
    throw new Error('Typing response must include a boolean success field');
  }

  return {
    success: value['success'],
  };
}

function parseChatError(value: unknown): ChatError {
  if (!isRecord(value)) {
    return createChatError('transport', 'Unknown stream error');
  }

  const kind = value['kind'];
  const message = value['message'];
  if (
    (kind === 'transport' ||
      kind === 'storage' ||
      kind === 'middleware' ||
      kind === 'validation' ||
      kind === 'state' ||
      kind === 'plugin' ||
      kind === 'unknown') &&
    typeof message === 'string'
  ) {
    return createChatError(kind, message);
  }

  return createChatError('transport', 'Unknown stream error');
}

export function parseStreamStartEvent(value: unknown): StreamStartEventPayload {
  if (!isRecord(value)) {
    throw new Error('Stream start payload must be an object');
  }

  return {
    messageId: parseString(value['messageId'], 'StreamStart.messageId'),
    conversationId: parseString(value['conversationId'], 'StreamStart.conversationId'),
  };
}

export function parseStreamChunkEvent(value: unknown): StreamChunkEventPayload {
  if (!isRecord(value)) {
    throw new Error('Stream chunk payload must be an object');
  }

  return {
    messageId: parseString(value['messageId'], 'StreamChunk.messageId'),
    chunk: parseString(value['chunk'], 'StreamChunk.chunk'),
    accumulated: parseString(value['accumulated'], 'StreamChunk.accumulated'),
  };
}

export function parseStreamEndEvent(value: unknown): StreamEndEventPayload {
  if (!isRecord(value)) {
    throw new Error('Stream end payload must be an object');
  }

  return {
    message: serializer.deserializeMessage(JSON.stringify(value['message'])),
  };
}

export function parseStreamErrorEvent(value: unknown): StreamErrorEventPayload {
  if (!isRecord(value)) {
    throw new Error('Stream error payload must be an object');
  }

  return {
    messageId: parseString(value['messageId'], 'StreamError.messageId'),
    conversationId: parseString(value['conversationId'], 'StreamError.conversationId'),
    ...(value['error'] !== undefined ? { error: parseChatError(value['error']) } : {}),
  };
}

export function getOrCreateDemoClientRuntime(config: DemoClientRuntimeConfig): DemoClientRuntime {
  const cacheKey = `${config.demoId}:${config.storageName}`;
  const cachedRuntime = runtimeCache.get(cacheKey);
  if (cachedRuntime) {
    return cachedRuntime;
  }

  const storage = new IndexedDBStorage({
    databaseName: config.storageName,
  });
  const sessionId = getOrCreateDemoSessionId(config.storageName);

  const cursors = new Map<string, string | undefined>();
  let activeConversationId: string | null = null;

  async function pollEvents(): Promise<ReadonlyArray<TransportEvent<'message' | 'typing'>>> {
    if (!activeConversationId) {
      return [];
    }

    const searchParams = new URLSearchParams({
      conversationId: activeConversationId,
    });
    const cursor = cursors.get(activeConversationId);
    if (cursor) {
      searchParams.set('cursor', cursor);
    }

    const response = await fetch(
      buildDemoRouteUrl(config.apiBasePath, 'events', sessionId, searchParams),
    );
    if (!response.ok) {
      throw new Error(`Polling failed with status ${response.status}`);
    }

    const json = parseDemoPollEventsResponse(await response.json());
    if (json.nextCursor) {
      cursors.set(activeConversationId, json.nextCursor);
    }

    return json.data;
  }

  async function sendTyping(event: TransportEvent<'typing'>): Promise<void> {
    const response = await fetch(buildDemoRouteUrl(config.apiBasePath, 'typing', sessionId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: event.payload.action,
        conversationId: event.payload.conversationId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Typing failed with status ${response.status}`);
    }

    const json = parseSendTypingResponse(await response.json());
    if (!json.success) {
      throw new Error('Typing update failed.');
    }
  }

  async function sendMessage(event: TransportEvent<'message'>): Promise<void> {
    const response = await fetch(buildDemoRouteUrl(config.apiBasePath, 'messages', sessionId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId: event.payload.conversationId,
        message:
          event.payload.type === 'text' ||
          event.payload.type === 'ai' ||
          event.payload.type === 'system'
            ? event.payload.content
            : '',
        ...(event.payload.metadata ? { metadata: event.payload.metadata } : {}),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Send failed with status ${response.status}`);
    }
  }

  const transport = new PollingTransport<
    TransportEvent<'message' | 'typing'>,
    TransportEvent<'message' | 'typing'>
  >({
    capabilities: {
      typing: true,
    },
    intervalMs: config.pollIntervalMs ?? 1800,
    pollAfterSend: true,
    poll: pollEvents,
    send: async (event) => {
      if (event.type === 'typing') {
        await sendTyping(event);
        return;
      }

      await sendMessage(event);
    },
  });

  const engine = new ChatEngine({
    storage,
    transport,
    sender: config.sender,
  });

  const runtime: DemoClientRuntime = {
    demoId: config.demoId,
    apiBasePath: config.apiBasePath,
    sessionId,
    engine,
    storage,
    sender: config.sender,
    supportsStreamingBridge: config.enableStreamingBridge === true,
    setActiveConversationId(conversationId) {
      activeConversationId = conversationId;
      if (conversationId) {
        if (!cursors.has(conversationId)) {
          cursors.set(conversationId, undefined);
        }
      }
    },
    async bootstrapConversation(): Promise<DemoConversationBootstrap> {
      const response = await fetch(
        buildDemoRouteUrl(config.apiBasePath, 'conversation', sessionId),
        {
          method: 'POST',
        },
      );
      const json = await response.json();
      const bootstrap = parseBootstrapResponse(json);
      await runtime.syncConversations([bootstrap.conversation]);
      runtime.setActiveConversationId(bootstrap.conversationId);
      return bootstrap;
    },
    async listConversations(): Promise<ReadonlyArray<Conversation>> {
      const response = await fetch(
        buildDemoRouteUrl(config.apiBasePath, 'conversations', sessionId),
      );
      const json = await response.json();
      const conversations = parseConversationsResponse(json);
      await runtime.syncConversations(conversations);
      return conversations;
    },
    async syncConversations(conversations: ReadonlyArray<Conversation>): Promise<void> {
      await Promise.all(
        conversations.map(async (conversation) => {
          await storage.saveConversation(conversation);
        }),
      );
    },
  };

  runtimeCache.set(cacheKey, runtime);
  return runtime;
}
