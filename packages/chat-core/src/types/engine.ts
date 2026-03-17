import type { Unsubscribe } from './common.js';
import type { Conversation, CreateConversationParams } from './conversation.js';
import type {
  ChatEventHandler,
  ChatEventType,
  ConnectionState,
  ConversationState,
} from './event.js';
import type { Message, MessageContent } from './message.js';
import type { Middleware } from './middleware.js';
import type { Participant } from './participant.js';
import type { ChatPlugin } from './plugin.js';
import type { ConversationQuery, CursorPage, IStorage, MessageQuery } from './storage.js';
import type { ITransport } from './transport.js';

/** Configuration for creating a ChatEngine instance. */
export interface ChatEngineConfig {
  readonly transport?: ITransport;
  readonly storage?: IStorage;
  readonly plugins?: ReadonlyArray<ChatPlugin>;
  readonly middleware?: ReadonlyArray<Middleware>;
  /** Default sender attached to outgoing messages when no sender is specified. */
  readonly sender?: Participant;
}

/**
 * The main chat engine interface.
 *
 * Transport and storage are both optional. When omitted the engine runs in
 * **standalone mode** — events still fire, state machines still work, but
 * messages are only held in-memory and no network I/O occurs.
 */
export interface IChatEngine {
  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Conversations
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversations(query?: ConversationQuery): Promise<CursorPage<Conversation>>;
  createConversation(params: CreateConversationParams): Promise<Conversation>;

  // Messages
  sendMessage(conversationId: string, content: MessageContent): Promise<Message>;
  getMessages(query: MessageQuery): Promise<CursorPage<Message>>;
  updateMessage(id: string, update: Partial<MessageContent>): Promise<Message>;
  deleteMessage(id: string): Promise<void>;

  // Events — core typed events
  on<E extends ChatEventType>(event: E, handler: ChatEventHandler<E>): Unsubscribe;
  off<E extends ChatEventType>(event: E, handler: ChatEventHandler<E>): void;

  // Events — custom plugin events (untyped namespace)
  on(event: `custom:${string}`, handler: (event: Record<string, unknown>) => void): Unsubscribe;
  off(event: `custom:${string}`, handler: (event: Record<string, unknown>) => void): void;

  // State
  getConnectionState(): ConnectionState;
  getConversationState(id: string): ConversationState;

  // Plugins
  use(plugin: ChatPlugin): void;
}
