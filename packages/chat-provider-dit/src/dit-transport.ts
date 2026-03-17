import type {
  ConnectionState,
  ITransport,
  Message,
  MessageMetadata,
  TransportEvent,
  Unsubscribe,
} from '@kaira/chat-core';

import { PollingTransport } from '@kaira/chat-transport-polling';

interface DitFetchMessage {
  readonly id: string;
  readonly chatroom_id: string;
  readonly message: string;
  readonly speaker_type?: 'user' | 'chatbot' | 'system';
  readonly speaker_id?: string;
  readonly metadata?: MessageMetadata;
  readonly created_at?: string;
}

interface DitFetchMessagesResponse {
  readonly success: boolean;
  readonly data: ReadonlyArray<DitFetchMessage>;
}

interface DitSendMessageResponse {
  readonly success: boolean;
}

/**
 * Fetch implementation used by DitTransport (allows custom runtime fetch).
 */
export type DitFetchFn = typeof fetch;

/**
 * DIT sender app context payload.
 */
export interface DitAppContext {
  readonly username: string;
  readonly gender: string;
  readonly dob: string;
}

/**
 * Configuration for DitTransport.
 */
export interface DitTransportConfig {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly chatroomId: string;
  readonly senderId: string;
  readonly chatbotNickname: string;
  readonly pollIntervalMs?: number;
  readonly fetch?: DitFetchFn;
  /** Optional SEND_MESSAGE_TO_CHATROOM support. */
  readonly send?: {
    readonly apiId: string;
    readonly sessionId: string;
    readonly appContext: DitAppContext;
  };
}

interface DitToMessageMapConfig {
  readonly senderId: string;
  readonly chatbotNickname: string;
}

type MessageTransportEvent = TransportEvent<'message'>;

const SEEN_IDS_MAX = 2000;
const DIT_PAGE_LIMIT = 100;
const INITIAL_BACKFILL_MAX_PAGES = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }

  return value;
}

function parseOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseRequiredString(value, field);
}

function parseOptionalMessageMetadata(value: unknown, field: string): MessageMetadata | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`${field} must be an object`);
  }

  const clientNonce = value['clientNonce'];
  if (clientNonce !== undefined && typeof clientNonce !== 'string') {
    throw new Error(`${field}.clientNonce must be a string`);
  }

  return {
    ...value,
    ...(clientNonce !== undefined ? { clientNonce } : {}),
  };
}

function parseOptionalSpeakerType(value: unknown, field: string): DitFetchMessage['speaker_type'] {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'user' || value === 'chatbot' || value === 'system') {
    return value;
  }

  throw new Error(`${field} must be "user", "chatbot", or "system"`);
}

function parseDitFetchMessage(value: unknown, field: string): DitFetchMessage {
  if (!isRecord(value)) {
    throw new Error(`${field} must be an object`);
  }

  return {
    id: parseRequiredString(value['id'], `${field}.id`),
    chatroom_id: parseRequiredString(value['chatroom_id'], `${field}.chatroom_id`),
    message: parseRequiredString(value['message'], `${field}.message`),
    ...(parseOptionalSpeakerType(value['speaker_type'], `${field}.speaker_type`) !== undefined
      ? { speaker_type: parseOptionalSpeakerType(value['speaker_type'], `${field}.speaker_type`) }
      : {}),
    ...(parseOptionalString(value['speaker_id'], `${field}.speaker_id`) !== undefined
      ? { speaker_id: parseOptionalString(value['speaker_id'], `${field}.speaker_id`) }
      : {}),
    ...(parseOptionalMessageMetadata(value['metadata'], `${field}.metadata`) !== undefined
      ? { metadata: parseOptionalMessageMetadata(value['metadata'], `${field}.metadata`) }
      : {}),
    ...(parseOptionalString(value['created_at'], `${field}.created_at`) !== undefined
      ? { created_at: parseOptionalString(value['created_at'], `${field}.created_at`) }
      : {}),
  };
}

export function parseDitFetchMessagesResponse(value: unknown): DitFetchMessagesResponse {
  if (!isRecord(value)) {
    throw new Error('DIT fetch response must be an object');
  }

  if (typeof value['success'] !== 'boolean') {
    throw new Error('DIT fetch response success must be a boolean');
  }

  const success = value['success'];
  const dataValue = value['data'];
  if (dataValue === undefined && !success) {
    return {
      success,
      data: [],
    };
  }

  if (!Array.isArray(dataValue)) {
    throw new Error('DIT fetch response data must be an array');
  }

  return {
    success,
    data: dataValue.map((item, index) => parseDitFetchMessage(item, `data[${index}]`)),
  };
}

export function parseDitSendMessageResponse(value: unknown): DitSendMessageResponse {
  if (!isRecord(value)) {
    throw new Error('DIT send response must be an object');
  }

  if (typeof value['success'] !== 'boolean') {
    throw new Error('DIT send response success must be a boolean');
  }

  return {
    success: value['success'],
  };
}

function parseDitTimestamp(value: string | undefined): number {
  if (value === undefined) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * DIT provider transport using PollingTransport under the hood.
 */
export class DitTransport implements ITransport<MessageTransportEvent, MessageTransportEvent> {
  private readonly config: DitTransportConfig;
  private readonly transport: PollingTransport<MessageTransportEvent, MessageTransportEvent>;
  private readonly fetchImpl: DitFetchFn;
  private readonly seenMessageIds = new Set<string>();
  private cursor: string | undefined;
  private hasBootstrappedHistory = false;

  constructor(config: DitTransportConfig) {
    this.config = config;
    this.fetchImpl = config.fetch ?? fetch;
    this.transport = new PollingTransport({
      intervalMs: config.pollIntervalMs ?? 2000,
      poll: async () => this.pollEvents(),
      send: async (event) => this.sendToDit(event),
    });
  }

  /**
   * Opens polling transport, resetting dedup state for a fresh session.
   */
  connect(): Promise<void> {
    this.seenMessageIds.clear();
    this.cursor = undefined;
    this.hasBootstrappedHistory = false;
    return this.transport.connect();
  }

  /**
   * Closes polling transport.
   */
  disconnect(): Promise<void> {
    return this.transport.disconnect();
  }

  /**
   * Sends outbound message through configured DIT send endpoint when available.
   */
  send(event: MessageTransportEvent): Promise<void> {
    return this.transport.send(event);
  }

  /**
   * Subscribes to inbound transport events.
   */
  onMessage(handler: (event: MessageTransportEvent) => void): Unsubscribe {
    return this.transport.onMessage(handler);
  }

  /**
   * Subscribes to connection state changes.
   */
  onStateChange(handler: (state: ConnectionState) => void): Unsubscribe {
    return this.transport.onStateChange(handler);
  }

  /**
   * Returns current transport state.
   */
  getState(): ConnectionState {
    return this.transport.getState();
  }

  private async pollEvents(): Promise<ReadonlyArray<MessageTransportEvent>> {
    if (!this.hasBootstrappedHistory) {
      this.hasBootstrappedHistory = true;
      const initialMessages = await this.fetchInitialHistory();
      return this.toTransportEvents(initialMessages);
    }

    const incrementalMessages = await this.fetchMessages('after', this.cursor);
    const sortedMessages = sortDitMessagesByCreatedAt(incrementalMessages);
    if (sortedMessages.length > 0) {
      this.cursor = sortedMessages[sortedMessages.length - 1]?.id;
    }

    return this.toTransportEvents(sortedMessages);
  }

  private async fetchInitialHistory(): Promise<ReadonlyArray<DitFetchMessage>> {
    const collected = new Map<string, DitFetchMessage>();
    let pageCursor: string | undefined;
    let pagesFetched = 0;

    while (pagesFetched < INITIAL_BACKFILL_MAX_PAGES) {
      const page = await this.fetchMessages('before', pageCursor);
      if (page.length === 0) {
        break;
      }

      for (const message of page) {
        collected.set(message.id, message);
      }

      const oldestMessage = getOldestDitMessage(page);
      if (!oldestMessage || pageCursor === oldestMessage.id) {
        break;
      }

      pageCursor = oldestMessage.id;
      pagesFetched++;

      if (page.length < DIT_PAGE_LIMIT) {
        break;
      }
    }

    const sortedMessages = sortDitMessagesByCreatedAt([...collected.values()]);
    if (sortedMessages.length > 0) {
      this.cursor = sortedMessages[sortedMessages.length - 1]?.id;
    }

    return sortedMessages;
  }

  private async fetchMessages(
    direction: 'before' | 'after',
    cursor: string | undefined,
  ): Promise<ReadonlyArray<DitFetchMessage>> {
    const searchParams = new URLSearchParams({
      direction,
      limit: String(DIT_PAGE_LIMIT),
    });
    if (cursor) {
      searchParams.set('cursor', cursor);
    }

    const response = await this.fetchImpl(
      `${this.config.apiUrl}/chats/chatroom/${this.config.chatroomId}?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`DIT poll failed (${response.status}): ${errorBody}`);
    }

    const json = parseDitFetchMessagesResponse(await response.json());
    if (!json.success) {
      return [];
    }

    return json.data;
  }

  private toTransportEvents(
    messages: ReadonlyArray<DitFetchMessage>,
  ): ReadonlyArray<MessageTransportEvent> {
    const newMessages = messages.filter((item) => !this.seenMessageIds.has(item.id));
    return newMessages.map((item) => {
      this.seenMessageIds.add(item.id);
      this.pruneSeenIds();

      return {
        type: 'message',
        payload: mapDitMessageToCoreMessage(item, {
          senderId: this.config.senderId,
          chatbotNickname: this.config.chatbotNickname,
        }),
        timestamp: parseDitTimestamp(item.created_at),
      };
    });
  }

  private pruneSeenIds(): void {
    if (this.seenMessageIds.size <= SEEN_IDS_MAX) {
      return;
    }

    const iterator = this.seenMessageIds.values();
    const excess = this.seenMessageIds.size - SEEN_IDS_MAX;
    for (let index = 0; index < excess; index++) {
      const oldest = iterator.next();
      if (!oldest.done) {
        this.seenMessageIds.delete(oldest.value);
      }
    }
  }

  private async sendToDit(event: MessageTransportEvent): Promise<void> {
    if (!this.config.send) {
      return;
    }

    const messageText = extractMessageText(event.payload);
    if (!messageText) {
      return;
    }

    const response = await this.fetchImpl(
      `${this.config.apiUrl}/v3/universe/session/${this.config.send.sessionId}`,
      {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.config.send.apiId,
          command: {
            type: 'SEND_MESSAGE_TO_CHATROOM',
            messages: [messageText],
            metadata: event.payload.metadata ?? {},
            senderId: this.config.senderId,
            chatroomId: this.config.chatroomId,
            senderType: 'user',
            appContext: this.config.send.appContext,
            purpose: 'user_chat',
          },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`DIT send failed (${response.status}): ${errorBody}`);
    }

    const json = parseDitSendMessageResponse(await response.json());
    if (!json.success) {
      throw new Error('DIT send returned unsuccessful response');
    }
  }
}

/**
 * Maps DIT message payload to chat-core Message union.
 */
export function mapDitMessageToCoreMessage(
  raw: DitFetchMessage,
  config: DitToMessageMapConfig,
): Message {
  const timestamp = parseDitTimestamp(raw.created_at) || Date.now();
  const senderRole =
    raw.speaker_type === 'chatbot'
      ? 'assistant'
      : raw.speaker_type === 'system'
        ? 'system'
        : 'user';

  if (raw.speaker_type === 'chatbot') {
    return {
      id: raw.id,
      conversationId: raw.chatroom_id,
      sender: {
        id: raw.speaker_id ?? config.chatbotNickname,
        role: senderRole,
      },
      timestamp,
      status: 'sent',
      type: 'ai',
      content: raw.message,
      streamState: 'complete',
      ...(raw.metadata ? { metadata: raw.metadata } : {}),
    };
  }

  return {
    id: raw.id,
    conversationId: raw.chatroom_id,
    sender: {
      id: raw.speaker_id ?? config.senderId,
      role: senderRole,
    },
    timestamp,
    status: 'sent',
    type: 'text',
    content: raw.message,
    ...(raw.metadata ? { metadata: raw.metadata } : {}),
  };
}

/**
 * Extracts text payload supported by DIT send endpoint.
 */
export function extractMessageText(payload: Message): string | null {
  switch (payload.type) {
    case 'text':
    case 'ai':
    case 'system':
      return payload.content;
    default:
      return null;
  }
}

function sortDitMessagesByCreatedAt(
  messages: ReadonlyArray<DitFetchMessage>,
): ReadonlyArray<DitFetchMessage> {
  return [...messages].sort(
    (left, right) => parseDitTimestamp(left.created_at) - parseDitTimestamp(right.created_at),
  );
}

function getOldestDitMessage(
  messages: ReadonlyArray<DitFetchMessage>,
): DitFetchMessage | undefined {
  const sorted = sortDitMessagesByCreatedAt(messages);
  return sorted[0];
}
