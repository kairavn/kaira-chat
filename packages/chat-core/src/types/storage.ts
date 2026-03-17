import type { SortDirection } from './common.js';
import type { Conversation } from './conversation.js';
import type { Message } from './message.js';

/** A page of results from a cursor-based query. */
export interface CursorPage<T> {
  readonly items: ReadonlyArray<T>;
  readonly nextCursor?: string;
  readonly hasMore: boolean;
}

/** Query parameters for fetching messages with cursor-based pagination. */
export interface MessageQuery {
  readonly conversationId: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly direction?: SortDirection;
  /** Only return messages before this timestamp. */
  readonly before?: number;
  /** Only return messages after this timestamp. */
  readonly after?: number;
}

/** Query parameters for fetching conversations with cursor-based pagination. */
export interface ConversationQuery {
  readonly cursor?: string;
  readonly limit?: number;
  readonly direction?: SortDirection;
  readonly participantId?: string;
  readonly type?: Conversation['type'];
}

/**
 * Interface contract for message and conversation persistence.
 *
 * Consumers implement this to back the chat core with IndexedDB,
 * a REST API, SQLite, or any other storage mechanism.
 */
export interface IStorage {
  // Messages
  saveMessage(message: Message): Promise<void>;
  getMessage(id: string): Promise<Message | undefined>;
  getMessages(query: MessageQuery): Promise<CursorPage<Message>>;
  updateMessage(id: string, update: Partial<Message>): Promise<void>;
  deleteMessage(id: string): Promise<void>;

  // Conversations
  saveConversation(conversation: Conversation): Promise<void>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversations(query?: ConversationQuery): Promise<CursorPage<Conversation>>;
  updateConversation(id: string, update: Partial<Conversation>): Promise<void>;
  deleteConversation(id: string): Promise<void>;

  /** Remove all stored data. */
  clear(): Promise<void>;
}
