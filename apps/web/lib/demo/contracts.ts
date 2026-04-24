import type {
  Conversation,
  CursorPage,
  Message,
  MessageMetadata,
  TransportEvent,
} from '@kaira/chat-core';
import type { DemoId } from '@/config/demo-registry';

export interface DemoRouteSuccess<TData> {
  readonly success: true;
  readonly data: TData;
}

export interface DemoRouteError {
  readonly success: false;
  readonly error: string;
}

export interface DemoConversationBootstrap {
  readonly demoId: DemoId;
  readonly conversationId: string;
  readonly conversation: Conversation;
}

export type DemoActionId =
  | 'next-backend:transport'
  | 'next-backend:persistence'
  | 'next-backend:checklist'
  | 'streaming:normal'
  | 'streaming:long'
  | 'streaming:error'
  | 'media:image'
  | 'media:audio'
  | 'media:video'
  | 'media:file'
  | 'media:location'
  | 'media:fallback';

export interface DemoActionMetadata extends MessageMetadata {
  readonly demoAction?: DemoActionId;
}

export interface DemoQuickAction {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly prompt: string;
  readonly metadata?: DemoActionMetadata;
}

export interface DemoSendMessageBody {
  readonly conversationId: string;
  readonly message: string;
  readonly metadata?: MessageMetadata;
}

export interface DemoMessagePageQuery {
  readonly direction: 'before' | 'after';
  readonly cursor?: string;
  readonly limit: number;
}

export type DemoMessagesPage = CursorPage<Message>;

export interface DemoTypingBody {
  readonly action: 'start' | 'stop';
  readonly conversationId: string;
}

export interface DemoPollEventsResponse {
  readonly success: true;
  readonly data: ReadonlyArray<TransportEvent<'message' | 'typing'>>;
  readonly nextCursor?: string;
}
