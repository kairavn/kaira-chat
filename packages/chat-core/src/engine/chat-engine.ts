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
import type { Message, MessageContent, MessageMetadata } from '../types/message.js';
import type { ChatPlugin } from '../types/plugin.js';
import type { ConversationQuery, CursorPage, IStorage, MessageQuery } from '../types/storage.js';
import type { ITransport } from '../types/transport.js';

import { EventBus } from '../event-bus/event-bus.js';
import { MessageRegistry } from '../message-registry/message-registry.js';
import { MiddlewarePipeline } from '../middleware/pipeline.js';
import { ConnectionStateMachine } from '../state/connection-state.js';
import { ConversationStateMachine } from '../state/conversation-state.js';
import { createChatError } from '../types/error.js';
import { generateId } from '../utils/id.js';

const MESSAGE_INDEX_MAX = 10_000;

function getClientNonceFromMetadata(metadata: MessageMetadata | undefined): string | undefined {
  return typeof metadata?.clientNonce === 'string' ? metadata.clientNonce : undefined;
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

  private readonly defaultSender: {
    readonly id: string;
    readonly role: 'user' | 'assistant' | 'system' | 'custom';
  };
  private readonly inMemoryMessages = new Map<string, Message>();
  private readonly inMemoryConversations = new Map<string, Conversation>();
  private readonly messageIndex = new Set<string>();
  private readonly pendingInboundMessageIds = new Set<string>();
  private readonly messageRegistry = new MessageRegistry();

  private transportUnsubs: Unsubscribe[] = [];

  constructor(config: ChatEngineConfig = {}) {
    this.eventBus = new EventBus();
    this.connectionState = new ConnectionStateMachine();
    this.pipeline = new MiddlewarePipeline();
    this.transport = config.transport;
    this.storage = config.storage;
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
      this.connectionState.transition('connect');
      this.wireTransport();
      try {
        await this.transport.connect();
        this.connectionState.transition('onOpen');
      } catch (err) {
        this.connectionState.transition('onError');
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

    for (const unsub of this.transportUnsubs) {
      unsub();
    }
    this.transportUnsubs = [];

    if (this.transport) {
      const currentState = this.connectionState.state;
      if (currentState === 'disconnected' || currentState === 'disconnecting') {
        return;
      }

      if (currentState === 'connecting') {
        this.connectionState.reset();
        return;
      }

      this.connectionState.transition('disconnect');
      try {
        await this.transport.disconnect();
      } finally {
        this.connectionState.transition('onClose');
      }
    }
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
    const message: Message = {
      ...content,
      id: generateId(),
      conversationId,
      sender: this.defaultSender,
      timestamp: now,
      status: 'pending',
    } as Message;

    const processed = await this.pipeline.run(
      {
        type: 'message:sent',
        timestamp: now,
        message,
      } as ChatEvent<'message:sent'>,
      this,
    );

    const finalMessage = (processed as ChatEvent<'message:sent'>).message;
    this.addToMessageIndex(finalMessage.id);

    if (this.storage) {
      await this.storage.saveMessage(finalMessage);
    } else {
      this.inMemoryMessages.set(finalMessage.id, finalMessage);
    }

    if (this.transport) {
      await this.transport.send({
        type: 'message',
        payload: finalMessage as unknown as Record<string, unknown>,
        timestamp: now,
      });
    }

    const sentMessage: Message = { ...finalMessage, status: 'sent' } as Message;
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
      .sort((left, right) => left.timestamp - right.timestamp)
      .filter((message) => (query.cursor ? message.id !== query.cursor : true));

    const orderedItems = direction === 'desc' ? [...items].reverse() : items;
    const pagedItems = orderedItems.slice(0, limit);
    const hasMore = orderedItems.length > pagedItems.length;
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

    const updated: Message = { ...existing, ...update } as Message;

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

  emitStreamError(messageId: string, error: ReturnType<typeof createChatError>): void {
    this.eventBus.emit('message:stream:error', {
      type: 'message:stream:error',
      timestamp: Date.now(),
      messageId,
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

  private wireTransport(): void {
    if (!this.transport) return;

    const msgUnsub = this.transport.onMessage((transportEvent) => {
      if (transportEvent.type !== 'message') return;
      this.handleIncomingTransportMessage(transportEvent.payload).catch((err) => {
        this.emitError(
          createChatError('transport', 'Failed to handle inbound message', { cause: err }),
        );
      });
    });

    const stateUnsub = this.transport.onStateChange((state) => {
      const prev = this.connectionState.state;
      if (state === 'disconnected' && prev === 'connected') {
        this.connectionState.transition('onClose');
      }
      this.eventBus.emit('connection:state', {
        type: 'connection:state',
        timestamp: Date.now(),
        state: this.connectionState.state,
        previousState: prev,
      });
    });

    this.transportUnsubs.push(msgUnsub, stateUnsub);
  }

  private async handleIncomingTransportMessage(payload: Record<string, unknown>): Promise<void> {
    if (typeof payload['id'] !== 'string' || typeof payload['type'] !== 'string') {
      this.emitError(
        createChatError('transport', 'Received malformed message payload', {
          metadata: { payload },
        }),
      );
      return;
    }

    const messageType = payload['type'];
    if (!this.messageRegistry.has(messageType)) {
      this.emitError(
        createChatError(
          'validation',
          `Received unknown message type "${messageType}" — accepting anyway`,
          {
            metadata: { payload, messageType },
          },
        ),
      );
    }

    const message = payload as unknown as Message;
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
    this.messageRegistry.register({ type: 'file' });
    this.messageRegistry.register({ type: 'system' });
    this.messageRegistry.register({ type: 'ai' });
    this.messageRegistry.register({ type: 'tool_call' });
    this.messageRegistry.register({ type: 'tool_result' });
    this.messageRegistry.register({ type: 'custom' });
  }

  private emitError(error: ReturnType<typeof createChatError>): void {
    this.eventBus.emit('error', {
      type: 'error',
      timestamp: Date.now(),
      error,
    });
  }
}
