import type { Unsubscribe } from '../types/common.js';
import type { Conversation, CreateConversationParams } from '../types/conversation.js';
import type { ChatEngineConfig, IChatEngine } from '../types/engine.js';
import type {
  ChatEvent,
  ChatEventHandler,
  ChatEventType,
  ConnectionState,
  ConversationState,
} from '../types/event.js';
import type { Message, MessageContent, MessageMetadata, MessageStatus } from '../types/message.js';
import type { Participant } from '../types/participant.js';
import type { ChatPlugin } from '../types/plugin.js';
import type { ConversationQuery, CursorPage, IStorage, MessageQuery } from '../types/storage.js';
import type { ITransport, TransportEvent } from '../types/transport.js';
import type {
  ConversationTypingState,
  TypingConfig,
  TypingParticipantState,
  TypingStopReason,
  TypingTransportPayload,
} from '../types/typing.js';

import { EventBus } from '../event-bus/event-bus.js';
import { MessageRegistry } from '../message-registry/message-registry.js';
import { MiddlewarePipeline } from '../middleware/pipeline.js';
import { ConnectionStateMachine } from '../state/connection-state.js';
import { ConversationStateMachine } from '../state/conversation-state.js';
import { TypingStateStore } from '../state/typing-state.js';
import { createChatError } from '../types/error.js';
import { generateId } from '../utils/id.js';

const MESSAGE_INDEX_MAX = 10_000;
const DEFAULT_TYPING_CONFIG = {
  emitThrottleMs: 2000,
  idleTimeoutMs: 1500,
  remoteTtlMs: 6000,
} satisfies Required<TypingConfig>;
type ConnectionTransitionAction =
  | 'connect'
  | 'onOpen'
  | 'onError'
  | 'onClose'
  | 'disconnect'
  | 'retry'
  | 'maxRetries';

function isParticipantRole(value: unknown): value is Participant['role'] {
  return value === 'user' || value === 'assistant' || value === 'system' || value === 'custom';
}

function isParticipant(value: unknown): value is Participant {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'role' in value &&
    isParticipantRole(value.role)
  );
}

function isTypingTransportPayload(value: unknown): value is TypingTransportPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'action' in value &&
    (value.action === 'start' || value.action === 'stop') &&
    'conversationId' in value &&
    typeof value.conversationId === 'string' &&
    'participant' in value &&
    isParticipant(value.participant)
  );
}

function isMessageTransportEvent(event: TransportEvent): event is TransportEvent<'message'> {
  return event.type === 'message';
}

function isTypingTransportEvent(event: TransportEvent): event is TransportEvent<'typing'> {
  return event.type === 'typing';
}

function getClientNonceFromMetadata(metadata: MessageMetadata | undefined): string | undefined {
  return typeof metadata?.clientNonce === 'string' ? metadata.clientNonce : undefined;
}

function assertFiniteNumber(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw createChatError('validation', `${field}: expected finite number`);
  }
}

function assertOptionalNonNegativeNumber(value: number | undefined, field: string): void {
  if (value === undefined) {
    return;
  }

  assertFiniteNumber(value, field);
  if (value < 0) {
    throw createChatError('validation', `${field}: expected non-negative number`);
  }
}

function assertLatitude(value: number): void {
  assertFiniteNumber(value, 'Message.latitude');
  if (value < -90 || value > 90) {
    throw createChatError('validation', 'Message.latitude: expected latitude between -90 and 90');
  }
}

function assertLongitude(value: number): void {
  assertFiniteNumber(value, 'Message.longitude');
  if (value < -180 || value > 180) {
    throw createChatError(
      'validation',
      'Message.longitude: expected longitude between -180 and 180',
    );
  }
}

function validateBuiltInMessagePayload(message: Message): void {
  switch (message.type) {
    case 'audio':
      assertOptionalNonNegativeNumber(message.durationSeconds, 'Message.durationSeconds');
      assertOptionalNonNegativeNumber(message.size, 'Message.size');
      return;
    case 'video':
      assertOptionalNonNegativeNumber(message.durationSeconds, 'Message.durationSeconds');
      assertOptionalNonNegativeNumber(message.size, 'Message.size');
      return;
    case 'location':
      assertLatitude(message.latitude);
      assertLongitude(message.longitude);
      return;
    default:
      return;
  }
}

function hasMatchingClientNonce(
  messages: Iterable<Message>,
  conversationId: string,
  senderId: string,
  clientNonce: string,
): boolean {
  for (const message of messages) {
    if (message.conversationId !== conversationId) continue;
    if (message.sender.id !== senderId) continue;
    if (getClientNonceFromMetadata(message.metadata) !== clientNonce) continue;
    return true;
  }
  return false;
}

function getConnectionTransitionActions(
  currentState: ConnectionState,
  targetState: ConnectionState,
): ReadonlyArray<ConnectionTransitionAction> {
  if (currentState === targetState) {
    return [];
  }

  if (currentState === 'disconnected' && targetState === 'connecting') {
    return ['connect'];
  }

  if (currentState === 'disconnected' && targetState === 'connected') {
    return ['connect', 'onOpen'];
  }

  if (currentState === 'connecting' && targetState === 'connected') {
    return ['onOpen'];
  }

  if (currentState === 'connecting' && targetState === 'disconnected') {
    return ['onError'];
  }

  if (currentState === 'connected' && targetState === 'reconnecting') {
    return ['onClose'];
  }

  if (currentState === 'connected' && targetState === 'disconnecting') {
    return ['disconnect'];
  }

  if (currentState === 'connected' && targetState === 'disconnected') {
    return ['onClose', 'maxRetries'];
  }

  if (currentState === 'reconnecting' && targetState === 'connecting') {
    return ['retry'];
  }

  if (currentState === 'reconnecting' && targetState === 'connected') {
    return ['retry', 'onOpen'];
  }

  if (currentState === 'reconnecting' && targetState === 'disconnecting') {
    return ['disconnect'];
  }

  if (currentState === 'reconnecting' && targetState === 'disconnected') {
    return ['maxRetries'];
  }

  if (currentState === 'disconnecting' && targetState === 'disconnected') {
    return ['onClose'];
  }

  return [];
}

function createOutgoingMessage(
  conversationId: string,
  content: MessageContent,
  sender: Message['sender'],
  timestamp: number,
  status: MessageStatus,
): Message {
  const metadata = content.metadata;
  const baseFields = {
    id: generateId(),
    conversationId,
    sender,
    timestamp,
    status,
  };

  switch (content.type) {
    case 'text':
      return {
        ...baseFields,
        type: 'text',
        content: content.content,
        ...(metadata ? { metadata } : {}),
      };
    case 'image':
      return {
        ...baseFields,
        type: 'image',
        url: content.url,
        ...(content.alt ? { alt: content.alt } : {}),
        ...(content.dimensions ? { dimensions: content.dimensions } : {}),
        ...(metadata ? { metadata } : {}),
      };
    case 'audio':
      return {
        ...baseFields,
        type: 'audio',
        url: content.url,
        ...('mimeType' in content ? { mimeType: content.mimeType } : {}),
        ...('title' in content ? { title: content.title } : {}),
        ...('durationSeconds' in content ? { durationSeconds: content.durationSeconds } : {}),
        ...('size' in content ? { size: content.size } : {}),
        ...(metadata ? { metadata } : {}),
      };
    case 'video':
      return {
        ...baseFields,
        type: 'video',
        url: content.url,
        ...('mimeType' in content ? { mimeType: content.mimeType } : {}),
        ...('title' in content ? { title: content.title } : {}),
        ...('posterUrl' in content ? { posterUrl: content.posterUrl } : {}),
        ...('dimensions' in content ? { dimensions: content.dimensions } : {}),
        ...('durationSeconds' in content ? { durationSeconds: content.durationSeconds } : {}),
        ...('size' in content ? { size: content.size } : {}),
        ...(metadata ? { metadata } : {}),
      };
    case 'file':
      return {
        ...baseFields,
        type: 'file',
        url: content.url,
        name: content.name,
        mimeType: content.mimeType,
        size: content.size,
        ...(metadata ? { metadata } : {}),
      };
    case 'location':
      return {
        ...baseFields,
        type: 'location',
        latitude: content.latitude,
        longitude: content.longitude,
        ...('label' in content ? { label: content.label } : {}),
        ...('address' in content ? { address: content.address } : {}),
        ...('url' in content ? { url: content.url } : {}),
        ...(metadata ? { metadata } : {}),
      };
    case 'system':
      return {
        ...baseFields,
        type: 'system',
        eventKind: content.eventKind,
        content: content.content,
        ...(metadata ? { metadata } : {}),
      };
    case 'ai':
      return {
        ...baseFields,
        type: 'ai',
        content: content.content,
        streamState: 'idle',
        ...(content.aiMetadata ? { aiMetadata: content.aiMetadata } : {}),
        ...(metadata ? { metadata } : {}),
      };
    case 'custom':
      return {
        ...baseFields,
        type: 'custom',
        customType: content.customType,
        payload: content.payload,
        ...(metadata ? { metadata } : {}),
      };
  }
}

function requireSentMessageEvent(event: ChatEvent): ChatEvent<'message:sent'> {
  if (event.type === 'message:sent' && 'message' in event) {
    return {
      type: 'message:sent',
      timestamp: event.timestamp,
      message: event.message,
    };
  }

  throw createChatError('middleware', 'Middleware changed the sendMessage event type');
}

function updateMessageStatus(message: Message, status: MessageStatus): Message {
  return {
    ...message,
    status,
  };
}

function applyMessageContentUpdate(existing: Message, update: Partial<MessageContent>): Message {
  if (update.type !== undefined && update.type !== existing.type) {
    throw createChatError('validation', `Cannot change message type from ${existing.type}`);
  }

  const metadataPatch = 'metadata' in update ? { metadata: update.metadata } : {};

  switch (existing.type) {
    case 'text':
      return {
        ...existing,
        ...metadataPatch,
        ...('content' in update && typeof update.content === 'string'
          ? { content: update.content }
          : {}),
      };
    case 'image':
      return {
        ...existing,
        ...metadataPatch,
        ...('url' in update && typeof update.url === 'string' ? { url: update.url } : {}),
        ...('alt' in update ? { alt: update.alt } : {}),
        ...('dimensions' in update ? { dimensions: update.dimensions } : {}),
      };
    case 'audio':
      return {
        ...existing,
        ...metadataPatch,
        ...('url' in update && typeof update.url === 'string' ? { url: update.url } : {}),
        ...('mimeType' in update ? { mimeType: update.mimeType } : {}),
        ...('title' in update ? { title: update.title } : {}),
        ...('durationSeconds' in update ? { durationSeconds: update.durationSeconds } : {}),
        ...('size' in update ? { size: update.size } : {}),
      };
    case 'video':
      return {
        ...existing,
        ...metadataPatch,
        ...('url' in update && typeof update.url === 'string' ? { url: update.url } : {}),
        ...('mimeType' in update ? { mimeType: update.mimeType } : {}),
        ...('title' in update ? { title: update.title } : {}),
        ...('posterUrl' in update ? { posterUrl: update.posterUrl } : {}),
        ...('dimensions' in update ? { dimensions: update.dimensions } : {}),
        ...('durationSeconds' in update ? { durationSeconds: update.durationSeconds } : {}),
        ...('size' in update ? { size: update.size } : {}),
      };
    case 'file':
      return {
        ...existing,
        ...metadataPatch,
        ...('url' in update && typeof update.url === 'string' ? { url: update.url } : {}),
        ...('name' in update && typeof update.name === 'string' ? { name: update.name } : {}),
        ...('mimeType' in update && typeof update.mimeType === 'string'
          ? { mimeType: update.mimeType }
          : {}),
        ...('size' in update && typeof update.size === 'number' ? { size: update.size } : {}),
      };
    case 'location':
      return {
        ...existing,
        ...metadataPatch,
        ...('latitude' in update && typeof update.latitude === 'number'
          ? { latitude: update.latitude }
          : {}),
        ...('longitude' in update && typeof update.longitude === 'number'
          ? { longitude: update.longitude }
          : {}),
        ...('label' in update ? { label: update.label } : {}),
        ...('address' in update ? { address: update.address } : {}),
        ...('url' in update ? { url: update.url } : {}),
      };
    case 'system':
      return {
        ...existing,
        ...metadataPatch,
        ...('eventKind' in update && typeof update.eventKind === 'string'
          ? { eventKind: update.eventKind }
          : {}),
        ...('content' in update && typeof update.content === 'string'
          ? { content: update.content }
          : {}),
      };
    case 'ai':
      return {
        ...existing,
        ...metadataPatch,
        ...('content' in update && typeof update.content === 'string'
          ? { content: update.content }
          : {}),
        ...('aiMetadata' in update ? { aiMetadata: update.aiMetadata } : {}),
      };
    case 'custom':
      return {
        ...existing,
        ...metadataPatch,
        ...('customType' in update && typeof update.customType === 'string'
          ? { customType: update.customType }
          : {}),
        ...('payload' in update ? { payload: update.payload } : {}),
      };
  }
}

/**
 * Top-level orchestrator that wires EventBus, state machines,
 * middleware pipeline, and optional transport/storage together.
 *
 * Operates in **standalone mode** when transport and storage are omitted —
 * events still fire and state machines still work, but messages are held
 * only in-memory.
 */
export class ChatEngine implements IChatEngine {
  private readonly eventBus: EventBus;
  private readonly connectionState: ConnectionStateMachine;
  private readonly conversationStates = new Map<string, ConversationStateMachine>();
  private readonly pipeline: MiddlewarePipeline;
  private readonly transport?: ITransport;
  private readonly storage?: IStorage;
  private readonly plugins: ChatPlugin[] = [];
  private readonly installedPlugins = new WeakSet<ChatPlugin>();
  private readonly typingState: TypingStateStore;
  private readonly typingConfig: Required<TypingConfig>;
  private readonly defaultSender: Participant;
  private readonly inMemoryMessages = new Map<string, Message>();
  private readonly inMemoryConversations = new Map<string, Conversation>();
  private readonly messageIndex = new Set<string>();
  private readonly pendingInboundMessageIds = new Set<string>();
  private readonly messageRegistry = new MessageRegistry();
  private readonly localTypingIdleTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly typingEmitTimestamps = new Map<string, number>();

  private transportUnsubs: Unsubscribe[] = [];

  constructor(config: ChatEngineConfig = {}) {
    this.eventBus = new EventBus();
    this.connectionState = new ConnectionStateMachine();
    this.pipeline = new MiddlewarePipeline();
    this.transport = config.transport;
    this.storage = config.storage;
    this.typingConfig = {
      emitThrottleMs: config.typing?.emitThrottleMs ?? DEFAULT_TYPING_CONFIG.emitThrottleMs,
      idleTimeoutMs: config.typing?.idleTimeoutMs ?? DEFAULT_TYPING_CONFIG.idleTimeoutMs,
      remoteTtlMs: config.typing?.remoteTtlMs ?? DEFAULT_TYPING_CONFIG.remoteTtlMs,
    };
    this.typingState = new TypingStateStore({
      onExpire: (conversationId, participantId) => {
        this.stopTypingByParticipant(conversationId, participantId, 'expired', Date.now());
      },
    });
    this.defaultSender = config.sender ?? { id: 'anonymous', role: 'user' };
    this.registerDefaultMessageTypes();

    for (const mw of config.middleware ?? []) {
      this.pipeline.use(mw);
    }

    for (const plugin of config.plugins ?? []) {
      this.registerPlugin(plugin);
    }
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async connect(): Promise<void> {
    if (this.transport) {
      if (this.connectionState.state !== 'disconnected') {
        return;
      }

      this.syncConnectionState('connecting');
      this.unwireTransport();
      const detachTransport = this.wireTransport();
      try {
        await this.transport.connect();
        if (this.getConnectionState() === 'connecting') {
          this.syncConnectionState('connected');
        }
      } catch (err) {
        detachTransport();
        if (this.getConnectionState() === 'connecting') {
          this.syncConnectionState('disconnected');
        }
        throw createChatError('transport', 'Transport connection failed', { cause: err });
      }
    }

    for (const plugin of this.plugins) {
      if (this.installedPlugins.has(plugin)) continue;
      try {
        await plugin.install(this);
        this.installedPlugins.add(plugin);
      } catch (err) {
        this.emitError(
          createChatError('plugin', `Plugin "${plugin.name}" install failed`, { cause: err }),
        );
      }
    }
  }

  async disconnect(): Promise<void> {
    for (const plugin of this.plugins) {
      if (!this.installedPlugins.has(plugin)) continue;
      try {
        await plugin.destroy?.();
      } catch {
        // Best-effort destroy
      }
      this.installedPlugins.delete(plugin);
    }

    if (this.transport) {
      const currentState = this.connectionState.state;
      if (currentState === 'disconnected') {
        this.unwireTransport();
        this.clearTypingRuntime();
        return;
      }

      if (currentState === 'connecting') {
        this.syncConnectionState('disconnected');
        this.unwireTransport();
        this.clearTypingRuntime();
        return;
      }

      this.syncConnectionState('disconnecting');
      try {
        await this.transport.disconnect();
      } finally {
        if (this.connectionState.state !== 'disconnected') {
          this.syncConnectionState('disconnected');
        }
        this.unwireTransport();
        this.clearTypingRuntime();
      }
      return;
    }

    this.clearTypingRuntime();
  }

  // -----------------------------------------------------------------------
  // Conversations
  // -----------------------------------------------------------------------

  async getConversation(id: string): Promise<Conversation | undefined> {
    if (this.storage) {
      return this.storage.getConversation(id);
    }
    return this.inMemoryConversations.get(id);
  }

  async getConversations(query?: ConversationQuery): Promise<CursorPage<Conversation>> {
    if (this.storage) {
      return this.storage.getConversations(query);
    }
    const items = [...this.inMemoryConversations.values()];
    return { items, hasMore: false };
  }

  async createConversation(params: CreateConversationParams): Promise<Conversation> {
    const now = Date.now();
    const conversation: Conversation = {
      id: generateId(),
      type: params.type,
      participants: params.participants,
      metadata: params.metadata,
      createdAt: now,
      updatedAt: now,
    };

    if (this.storage) {
      await this.storage.saveConversation(conversation);
    } else {
      this.inMemoryConversations.set(conversation.id, conversation);
    }

    this.conversationStates.set(conversation.id, new ConversationStateMachine('active'));

    this.eventBus.emit('conversation:created', {
      type: 'conversation:created',
      timestamp: now,
      conversation,
    });

    return conversation;
  }

  // -----------------------------------------------------------------------
  // Messages
  // -----------------------------------------------------------------------

  async sendMessage(conversationId: string, content: MessageContent): Promise<Message> {
    const now = Date.now();
    this.stopTypingByParticipant(conversationId, this.defaultSender.id, 'message', now);
    const message = createOutgoingMessage(
      conversationId,
      content,
      this.defaultSender,
      now,
      'pending',
    );
    validateBuiltInMessagePayload(message);

    const processed = await this.pipeline.run(
      {
        type: 'message:sent',
        timestamp: now,
        message,
      },
      this,
    );

    const finalMessage = requireSentMessageEvent(processed).message;
    validateBuiltInMessagePayload(finalMessage);
    this.addToMessageIndex(finalMessage.id);

    if (this.storage) {
      await this.storage.saveMessage(finalMessage);
    } else {
      this.inMemoryMessages.set(finalMessage.id, finalMessage);
    }

    if (this.transport) {
      await this.transport.send({
        type: 'message',
        payload: finalMessage,
        timestamp: now,
      });
    }

    const sentMessage = updateMessageStatus(finalMessage, 'sent');
    if (this.storage) {
      await this.storage.updateMessage(sentMessage.id, { status: 'sent' });
    } else {
      this.inMemoryMessages.set(sentMessage.id, sentMessage);
    }

    this.eventBus.emit('message:sent', {
      type: 'message:sent',
      timestamp: now,
      message: sentMessage,
    });

    return sentMessage;
  }

  notifyTyping(conversationId: string): void {
    const now = Date.now();
    const update = this.typingState.upsertLocalState({
      conversationId,
      participant: this.defaultSender,
      now,
    });

    if (update.didStart) {
      this.emitTypingStart(update.state, now);
    }

    this.scheduleLocalTypingIdleStop(conversationId);
    if (!this.supportsTyping()) {
      return;
    }

    const previousEmitAt = this.typingEmitTimestamps.get(conversationId);
    if (previousEmitAt !== undefined && now - previousEmitAt < this.typingConfig.emitThrottleMs) {
      return;
    }

    this.typingEmitTimestamps.set(conversationId, now);
    void this.sendTransportTypingEvent(
      {
        action: 'start',
        conversationId,
        participant: this.defaultSender,
      },
      now,
    );
  }

  stopTyping(conversationId: string): void {
    this.stopTypingByParticipant(conversationId, this.defaultSender.id, 'explicit', Date.now());
  }

  async getMessages(query: MessageQuery): Promise<CursorPage<Message>> {
    if (this.storage) {
      return this.storage.getMessages(query);
    }
    const direction = query.direction ?? 'asc';
    const limit = query.limit ?? Number.POSITIVE_INFINITY;
    const items = [...this.inMemoryMessages.values()]
      .filter((message) => message.conversationId === query.conversationId)
      .filter((message) => (query.before ? message.timestamp < query.before : true))
      .filter((message) => (query.after ? message.timestamp > query.after : true))
      .sort((left, right) => left.timestamp - right.timestamp);

    const orderedItems = direction === 'desc' ? [...items].reverse() : items;
    const cursorIndex = query.cursor
      ? orderedItems.findIndex((message) => message.id === query.cursor)
      : -1;
    const cursorItems = cursorIndex >= 0 ? orderedItems.slice(cursorIndex + 1) : orderedItems;
    const pagedItems = cursorItems.slice(0, limit);
    const hasMore = cursorItems.length > pagedItems.length;
    const nextCursor = hasMore ? pagedItems[pagedItems.length - 1]?.id : undefined;
    return { items: pagedItems, nextCursor, hasMore };
  }

  async updateMessage(id: string, update: Partial<MessageContent>): Promise<Message> {
    const existing = this.storage
      ? await this.storage.getMessage(id)
      : this.inMemoryMessages.get(id);

    if (!existing) {
      throw createChatError('validation', `Message not found: ${id}`);
    }

    const updated = applyMessageContentUpdate(existing, update);
    validateBuiltInMessagePayload(updated);

    if (this.storage) {
      await this.storage.updateMessage(id, updated);
    } else {
      this.inMemoryMessages.set(id, updated);
    }

    this.eventBus.emit('message:updated', {
      type: 'message:updated',
      timestamp: Date.now(),
      message: updated,
      previous: existing,
    });

    return updated;
  }

  async deleteMessage(id: string): Promise<void> {
    const existing = this.storage
      ? await this.storage.getMessage(id)
      : this.inMemoryMessages.get(id);

    if (!existing) {
      throw createChatError('validation', `Message not found: ${id}`);
    }

    if (this.storage) {
      await this.storage.deleteMessage(id);
    } else {
      this.inMemoryMessages.delete(id);
    }

    this.eventBus.emit('message:deleted', {
      type: 'message:deleted',
      timestamp: Date.now(),
      messageId: id,
      conversationId: existing.conversationId,
    });
  }

  // -----------------------------------------------------------------------
  // AI Streaming
  // -----------------------------------------------------------------------

  /**
   * Emit streaming events for an AI response being received in chunks.
   * Consumers call this from their transport handler to drive the
   * stream:start → stream:chunk* → stream:end / stream:error lifecycle.
   */
  emitStreamStart(messageId: string, conversationId: string): void {
    this.eventBus.emit('message:stream:start', {
      type: 'message:stream:start',
      timestamp: Date.now(),
      messageId,
      conversationId,
    });
  }

  emitStreamChunk(messageId: string, chunk: string, accumulated: string): void {
    this.eventBus.emit('message:stream:chunk', {
      type: 'message:stream:chunk',
      timestamp: Date.now(),
      messageId,
      chunk,
      accumulated,
    });
  }

  async emitStreamEnd(message: Message & { type: 'ai' }): Promise<void> {
    this.addToMessageIndex(message.id);
    if (this.storage) {
      await this.storage.saveMessage(message);
    } else {
      this.inMemoryMessages.set(message.id, message);
    }

    this.eventBus.emit('message:stream:end', {
      type: 'message:stream:end',
      timestamp: Date.now(),
      message,
    });
  }

  emitStreamError(
    messageId: string,
    conversationId: string,
    error: ReturnType<typeof createChatError>,
  ): void {
    this.eventBus.emit('message:stream:error', {
      type: 'message:stream:error',
      timestamp: Date.now(),
      messageId,
      conversationId,
      error,
    });
  }

  // -----------------------------------------------------------------------
  // Events
  // -----------------------------------------------------------------------

  on<E extends ChatEventType>(event: E, handler: ChatEventHandler<E>): Unsubscribe;
  on(event: `custom:${string}`, handler: (event: Record<string, unknown>) => void): Unsubscribe;
  on(event: string, handler: (...args: never[]) => void): Unsubscribe {
    return this.eventBus.on(event as ChatEventType, handler as ChatEventHandler<ChatEventType>);
  }

  off<E extends ChatEventType>(event: E, handler: ChatEventHandler<E>): void;
  off(event: `custom:${string}`, handler: (event: Record<string, unknown>) => void): void;
  off(event: string, handler: (...args: never[]) => void): void {
    this.eventBus.off(event as ChatEventType, handler as ChatEventHandler<ChatEventType>);
  }

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  getConnectionState(): ConnectionState {
    return this.connectionState.state;
  }

  getConversationState(id: string): ConversationState {
    const sm = this.conversationStates.get(id);
    return sm?.state ?? 'active';
  }

  getCurrentParticipant(): Participant {
    return this.defaultSender;
  }

  getTypingState(conversationId: string): ConversationTypingState {
    return this.typingState.getConversationState(conversationId);
  }

  isTyping(conversationId: string, participantId?: string): boolean {
    return this.typingState.isTyping(conversationId, participantId);
  }

  supportsTyping(): boolean {
    return this.transport?.capabilities?.typing === true;
  }

  // -----------------------------------------------------------------------
  // Plugins
  // -----------------------------------------------------------------------

  use(plugin: ChatPlugin): void {
    this.registerPlugin(plugin);
    if (this.connectionState.state === 'connected') {
      this.installPluginSafe(plugin);
    }
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  private registerPlugin(plugin: ChatPlugin): void {
    this.plugins.push(plugin);
  }

  private installPluginSafe(plugin: ChatPlugin): void {
    if (this.installedPlugins.has(plugin)) return;
    Promise.resolve(plugin.install(this))
      .then(() => {
        this.installedPlugins.add(plugin);
      })
      .catch((err) => {
        this.emitError(
          createChatError('plugin', `Plugin "${plugin.name}" install failed`, { cause: err }),
        );
      });
  }

  private wireTransport(): () => void {
    if (!this.transport) {
      return () => {};
    }

    const msgUnsub = this.transport.onMessage((transportEvent) => {
      const handler = isMessageTransportEvent(transportEvent)
        ? this.handleIncomingTransportMessage(transportEvent.payload)
        : isTypingTransportEvent(transportEvent)
          ? this.handleIncomingTransportTyping(transportEvent.payload, transportEvent.timestamp)
          : Promise.resolve();

      handler.catch((err) => {
        this.emitError(
          createChatError('transport', 'Failed to handle inbound transport event', { cause: err }),
        );
      });
    });

    const stateUnsub = this.transport.onStateChange((state) => {
      this.syncConnectionState(state);
    });

    this.transportUnsubs.push(msgUnsub, stateUnsub);
    return () => {
      msgUnsub();
      stateUnsub();
      this.transportUnsubs = this.transportUnsubs.filter(
        (unsub) => unsub !== msgUnsub && unsub !== stateUnsub,
      );
    };
  }

  private async handleIncomingTransportMessage(message: Message): Promise<void> {
    if (
      typeof message.id !== 'string' ||
      typeof message.type !== 'string' ||
      typeof message.conversationId !== 'string' ||
      typeof message.sender !== 'object' ||
      message.sender === null ||
      typeof message.sender.id !== 'string'
    ) {
      this.emitError(
        createChatError('transport', 'Received malformed message payload', {
          metadata: { message },
        }),
      );
      return;
    }

    const messageType = message.type;
    if (!this.messageRegistry.has(messageType)) {
      this.emitError(
        createChatError(
          'validation',
          `Received unknown message type "${messageType}" — accepting anyway`,
          {
            metadata: { message, messageType },
          },
        ),
      );
    }

    const inboundClientNonce = getClientNonceFromMetadata(message.metadata);
    const isOwnEchoWithKnownNonce =
      typeof inboundClientNonce === 'string' &&
      message.sender.id === this.defaultSender.id &&
      hasMatchingClientNonce(
        this.inMemoryMessages.values(),
        message.conversationId,
        message.sender.id,
        inboundClientNonce,
      );
    if (isOwnEchoWithKnownNonce) {
      this.addToMessageIndex(message.id);
      this.stopTypingByParticipant(
        message.conversationId,
        message.sender.id,
        'message',
        Date.now(),
      );
      return;
    }

    const isDuplicate = await this.reserveInboundMessageId(message.id);
    if (isDuplicate) return;

    try {
      this.addToMessageIndex(message.id);
      if (this.storage) {
        await this.storage.saveMessage(message);
      } else {
        this.inMemoryMessages.set(message.id, message);
      }

      this.stopTypingByParticipant(
        message.conversationId,
        message.sender.id,
        'message',
        Date.now(),
      );
      this.eventBus.emit('message:received', {
        type: 'message:received',
        timestamp: Date.now(),
        message,
      });
    } catch (err) {
      this.emitError(
        createChatError('storage', 'Failed to persist inbound message', {
          cause: err,
          metadata: { messageId: message.id },
        }),
      );
    } finally {
      this.pendingInboundMessageIds.delete(message.id);
    }
  }

  private async handleIncomingTransportTyping(
    payload: TypingTransportPayload,
    timestamp: number,
  ): Promise<void> {
    if (!isTypingTransportPayload(payload)) {
      this.emitError(
        createChatError('transport', 'Received malformed typing payload', {
          metadata: { payload },
        }),
      );
      return;
    }

    if (payload.participant.id === this.defaultSender.id) {
      return;
    }

    if (payload.action === 'stop') {
      this.stopTypingByParticipant(
        payload.conversationId,
        payload.participant.id,
        'explicit',
        timestamp,
      );
      return;
    }

    const update = this.typingState.upsertRemoteState({
      conversationId: payload.conversationId,
      participant: payload.participant,
      now: timestamp,
      ttlMs: this.typingConfig.remoteTtlMs,
    });

    if (update.didStart) {
      this.emitTypingStart(update.state, timestamp);
    }
  }

  private async reserveInboundMessageId(messageId: string): Promise<boolean> {
    if (this.messageIndex.has(messageId) || this.pendingInboundMessageIds.has(messageId)) {
      return true;
    }

    this.pendingInboundMessageIds.add(messageId);

    if (!this.storage) {
      return false;
    }

    try {
      const existing = await this.storage.getMessage(messageId);
      if (existing) {
        this.addToMessageIndex(messageId);
        this.pendingInboundMessageIds.delete(messageId);
        return true;
      }
    } catch (err) {
      this.emitError(
        createChatError('storage', 'Failed to check message existence for deduplication', {
          cause: err,
          metadata: { messageId },
        }),
      );
    }

    return false;
  }

  /** Adds an id to the dedup index, evicting oldest entries when capped. */
  private addToMessageIndex(messageId: string): void {
    this.messageIndex.add(messageId);
    if (this.messageIndex.size > MESSAGE_INDEX_MAX) {
      const iterator = this.messageIndex.values();
      const excess = this.messageIndex.size - MESSAGE_INDEX_MAX;
      for (let i = 0; i < excess; i++) {
        const oldest = iterator.next();
        if (!oldest.done) this.messageIndex.delete(oldest.value);
      }
    }
  }

  private registerDefaultMessageTypes(): void {
    this.messageRegistry.register({ type: 'text' });
    this.messageRegistry.register({ type: 'image' });
    this.messageRegistry.register({ type: 'audio' });
    this.messageRegistry.register({ type: 'video' });
    this.messageRegistry.register({ type: 'file' });
    this.messageRegistry.register({ type: 'location' });
    this.messageRegistry.register({ type: 'system' });
    this.messageRegistry.register({ type: 'ai' });
    this.messageRegistry.register({ type: 'custom' });
  }

  private emitError(error: ReturnType<typeof createChatError>): void {
    this.eventBus.emit('error', {
      type: 'error',
      timestamp: Date.now(),
      error,
    });
  }

  private emitConnectionState(previousState: ConnectionState): void {
    this.eventBus.emit('connection:state', {
      type: 'connection:state',
      timestamp: Date.now(),
      state: this.connectionState.state,
      previousState,
    });
  }

  private syncConnectionState(targetState: ConnectionState): void {
    const actions = getConnectionTransitionActions(this.connectionState.state, targetState);
    for (const action of actions) {
      const previousState = this.connectionState.state;
      this.connectionState.transition(action);
      this.emitConnectionState(previousState);
    }
  }

  private unwireTransport(): void {
    for (const unsub of this.transportUnsubs) {
      unsub();
    }
    this.transportUnsubs = [];
  }

  private emitTypingStart(typing: TypingParticipantState, timestamp: number): void {
    this.eventBus.emit('typing:start', {
      type: 'typing:start',
      timestamp,
      conversationId: typing.conversationId,
      participant: typing.participant,
      typing,
    });
  }

  private emitTypingStop(
    typing: TypingParticipantState,
    reason: TypingStopReason,
    timestamp: number,
  ): void {
    this.eventBus.emit('typing:stop', {
      type: 'typing:stop',
      timestamp,
      conversationId: typing.conversationId,
      participant: typing.participant,
      typing,
      reason,
    });
  }

  private scheduleLocalTypingIdleStop(conversationId: string): void {
    const existingTimer = this.localTypingIdleTimers.get(conversationId);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.stopTypingByParticipant(conversationId, this.defaultSender.id, 'explicit', Date.now());
    }, this.typingConfig.idleTimeoutMs);
    this.localTypingIdleTimers.set(conversationId, timer);
  }

  private stopTypingByParticipant(
    conversationId: string,
    participantId: string,
    reason: TypingStopReason,
    timestamp: number,
  ): void {
    const current = this.typingState.getParticipantState(conversationId, participantId);
    if (!current) {
      if (participantId === this.defaultSender.id) {
        this.clearLocalTypingRuntime(conversationId);
      }
      return;
    }

    const removed = this.typingState.stopTyping(conversationId, participantId);
    if (!removed) {
      if (participantId === this.defaultSender.id) {
        this.clearLocalTypingRuntime(conversationId);
      }
      return;
    }

    if (participantId === this.defaultSender.id) {
      this.clearLocalTypingRuntime(conversationId);
      if (reason === 'explicit' && current.source === 'local' && this.supportsTyping()) {
        void this.sendTransportTypingEvent(
          {
            action: 'stop',
            conversationId,
            participant: this.defaultSender,
          },
          timestamp,
        );
      }
    }

    this.emitTypingStop(removed, reason, timestamp);
  }

  private clearLocalTypingRuntime(conversationId: string): void {
    const timer = this.localTypingIdleTimers.get(conversationId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.localTypingIdleTimers.delete(conversationId);
    }

    this.typingEmitTimestamps.delete(conversationId);
  }

  private clearTypingRuntime(): void {
    for (const timer of this.localTypingIdleTimers.values()) {
      clearTimeout(timer);
    }

    this.localTypingIdleTimers.clear();
    this.typingEmitTimestamps.clear();
    this.typingState.clearAll();
  }

  private async sendTransportTypingEvent(
    payload: TypingTransportPayload,
    timestamp: number,
  ): Promise<void> {
    if (!this.transport || !this.supportsTyping()) {
      return;
    }

    await this.transport.send({
      type: 'typing',
      payload,
      timestamp,
    });
  }
}
