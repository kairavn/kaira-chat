import type {
  ChatSerializer,
  Conversation,
  ConversationQuery,
  CursorPage,
  IStorage,
  Message,
  MessageQuery,
} from '@kaira/chat-core';

import { ChatSerializer as CoreChatSerializer } from '@kaira/chat-core';

export class MemoryStorage implements IStorage {
  private readonly messages = new Map<string, Message>();
  private readonly conversations = new Map<string, Conversation>();
  private readonly serializer: ChatSerializer;

  constructor(serializer: ChatSerializer = new CoreChatSerializer()) {
    this.serializer = serializer;
  }

  async saveMessage(message: Message): Promise<void> {
    this.messages.set(message.id, message);
  }

  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessages(query: MessageQuery): Promise<CursorPage<Message>> {
    const items = [...this.messages.values()]
      .filter((message) => message.conversationId === query.conversationId)
      .filter((message) => (query.before === undefined ? true : message.timestamp < query.before))
      .filter((message) => (query.after === undefined ? true : message.timestamp > query.after))
      .sort(compareMessagesAscending);

    const orderedItems = query.direction === 'desc' ? [...items].reverse() : items;
    return paginateItems(orderedItems, query.cursor, query.limit);
  }

  async updateMessage(id: string, update: Partial<Message>): Promise<void> {
    const existing = this.messages.get(id);
    if (!existing) {
      return;
    }

    this.messages.set(
      id,
      this.serializer.deserializeMessage(JSON.stringify({ ...existing, ...update })),
    );
  }

  async deleteMessage(id: string): Promise<void> {
    this.messages.delete(id);
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    this.conversations.set(conversation.id, conversation);
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversations(query?: ConversationQuery): Promise<CursorPage<Conversation>> {
    const items = [...this.conversations.values()]
      .filter((conversation) =>
        query?.type === undefined ? true : conversation.type === query.type,
      )
      .filter((conversation) =>
        query?.participantId === undefined
          ? true
          : conversation.participants.some((participant) => participant.id === query.participantId),
      )
      .sort(compareConversationsAscending);

    const direction = query?.direction ?? 'desc';
    const orderedItems = direction === 'desc' ? [...items].reverse() : items;
    return paginateItems(orderedItems, query?.cursor, query?.limit);
  }

  async updateConversation(id: string, update: Partial<Conversation>): Promise<void> {
    const existing = this.conversations.get(id);
    if (!existing) {
      return;
    }

    this.conversations.set(
      id,
      this.serializer.deserializeConversation(JSON.stringify({ ...existing, ...update })),
    );
  }

  async deleteConversation(id: string): Promise<void> {
    this.conversations.delete(id);
  }

  async clear(): Promise<void> {
    this.messages.clear();
    this.conversations.clear();
  }
}

function compareMessagesAscending(left: Message, right: Message): number {
  if (left.timestamp !== right.timestamp) {
    return left.timestamp - right.timestamp;
  }

  return left.id.localeCompare(right.id);
}

function compareConversationsAscending(left: Conversation, right: Conversation): number {
  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt - right.updatedAt;
  }

  return left.id.localeCompare(right.id);
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
