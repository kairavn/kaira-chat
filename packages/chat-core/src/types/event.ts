import type { Conversation } from './conversation.js';
import type { ChatError } from './error.js';
import type { AIMessage, Message, MessageStatus } from './message.js';
import type { Participant } from './participant.js';
import type { TypingParticipantState, TypingStopReason } from './typing.js';

/** Connection lifecycle state. */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnecting';

/** Conversation lifecycle state. */
export type ConversationState = 'active' | 'archived' | 'closed';

/** All built-in chat event types. */
export type ChatEventType =
  | 'message:sent'
  | 'message:received'
  | 'message:updated'
  | 'message:deleted'
  | 'message:status'
  | 'message:stream:start'
  | 'message:stream:chunk'
  | 'message:stream:end'
  | 'message:stream:error'
  | 'typing:start'
  | 'typing:stop'
  | 'conversation:created'
  | 'conversation:updated'
  | 'conversation:deleted'
  | 'connection:state'
  | 'error';

/** Maps each event type to its payload shape. */
export interface ChatEventMap {
  'message:sent': { readonly message: Message };
  'message:received': { readonly message: Message };
  'message:updated': { readonly message: Message; readonly previous: Message };
  'message:deleted': { readonly messageId: string; readonly conversationId: string };
  'message:status': { readonly messageId: string; readonly status: MessageStatus };
  'message:stream:start': { readonly messageId: string; readonly conversationId: string };
  'message:stream:chunk': {
    readonly messageId: string;
    readonly chunk: string;
    readonly accumulated: string;
  };
  'message:stream:end': { readonly message: AIMessage };
  'message:stream:error': {
    readonly messageId: string;
    readonly conversationId: string;
    readonly error: ChatError;
  };
  'typing:start': {
    readonly conversationId: string;
    readonly participant: Participant;
    readonly typing: TypingParticipantState;
  };
  'typing:stop': {
    readonly conversationId: string;
    readonly participant: Participant;
    readonly typing: TypingParticipantState;
    readonly reason: TypingStopReason;
  };
  'conversation:created': { readonly conversation: Conversation };
  'conversation:updated': { readonly conversation: Conversation; readonly previous: Conversation };
  'conversation:deleted': { readonly conversationId: string };
  'connection:state': { readonly state: ConnectionState; readonly previousState: ConnectionState };
  error: { readonly error: ChatError };
}

/** A fully-typed chat event including its type discriminator and timestamp. */
export type ChatEvent<E extends ChatEventType = ChatEventType> = {
  readonly type: E;
  readonly timestamp: number;
} & ChatEventMap[E];

/** Type-safe handler for a specific chat event. */
export type ChatEventHandler<E extends ChatEventType> = (event: ChatEvent<E>) => void;
