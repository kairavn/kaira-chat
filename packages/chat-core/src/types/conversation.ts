import type { Participant } from './participant.js';

/** The shape of a conversation (1:1, group, or channel). */
export type ConversationType = 'direct' | 'group' | 'channel';

/** A conversation containing messages between participants. */
export interface Conversation {
  readonly id: string;
  readonly type: ConversationType;
  readonly participants: ReadonlyArray<Participant>;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Parameters for creating a new conversation. */
export interface CreateConversationParams {
  readonly type: ConversationType;
  readonly participants: ReadonlyArray<Participant>;
  readonly metadata?: Record<string, unknown>;
}
