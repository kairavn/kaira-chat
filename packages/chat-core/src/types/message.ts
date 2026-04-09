import type { ImageDimensions } from './common.js';
import type { Participant } from './participant.js';

/** Discriminator for the message union. */
export type MessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'file'
  | 'location'
  | 'system'
  | 'ai'
  | 'tool_call'
  | 'tool_result'
  | 'custom';

/** Delivery status of a message. */
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/** Streaming lifecycle state for AI messages. */
export type AIStreamState = 'idle' | 'streaming' | 'complete' | 'error';

/** Shared message metadata used for client-side reconciliation and extensions. */
export interface MessageMetadata extends Record<string, unknown> {
  readonly clientNonce?: string;
}

/** Kind of system event (join, leave, rename, etc.). */
export type SystemEventKind =
  | 'participant_joined'
  | 'participant_left'
  | 'conversation_renamed'
  | 'custom';

/** Token-usage and model metadata attached to AI messages. */
export interface AIMetadata {
  readonly model?: string;
  readonly provider?: string;
  readonly tokensUsed?: {
    readonly prompt: number;
    readonly completion: number;
    readonly total: number;
  };
  readonly latencyMs?: number;
  readonly finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
  readonly metadata?: Record<string, unknown>;
}

/** A single tool invocation requested by an AI model. */
export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Base fields shared by every message variant
// ---------------------------------------------------------------------------

interface BaseMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly sender: Participant;
  readonly timestamp: number;
  readonly status: MessageStatus;
  readonly metadata?: MessageMetadata;
}

interface BaseAttachmentMessage extends BaseMessage {
  readonly url: string;
}

interface BaseTimedMediaMessage extends BaseAttachmentMessage {
  readonly mimeType?: string;
  readonly title?: string;
  readonly durationSeconds?: number;
  readonly size?: number;
}

// ---------------------------------------------------------------------------
// Message variants (discriminated on `type`)
// ---------------------------------------------------------------------------

export interface TextMessage extends BaseMessage {
  readonly type: 'text';
  readonly content: string;
}

export interface ImageMessage extends BaseMessage {
  readonly type: 'image';
  readonly url: string;
  readonly alt?: string;
  readonly dimensions?: ImageDimensions;
}

export interface AudioMessage extends BaseTimedMediaMessage {
  readonly type: 'audio';
}

export interface VideoMessage extends BaseTimedMediaMessage {
  readonly type: 'video';
  readonly posterUrl?: string;
  readonly dimensions?: ImageDimensions;
}

export interface FileMessage extends BaseMessage {
  readonly type: 'file';
  readonly url: string;
  readonly name: string;
  readonly mimeType: string;
  readonly size: number;
}

export interface LocationMessage extends BaseMessage {
  readonly type: 'location';
  readonly latitude: number;
  readonly longitude: number;
  readonly label?: string;
  readonly address?: string;
  readonly url?: string;
}

export interface SystemMessage extends BaseMessage {
  readonly type: 'system';
  readonly eventKind: SystemEventKind;
  readonly content: string;
}

export interface AIMessage extends BaseMessage {
  readonly type: 'ai';
  readonly content: string;
  readonly streamState: AIStreamState;
  readonly aiMetadata?: AIMetadata;
}

export interface ToolCallMessage extends BaseMessage {
  readonly type: 'tool_call';
  readonly toolCalls: ReadonlyArray<ToolCall>;
}

export interface ToolResultMessage extends BaseMessage {
  readonly type: 'tool_result';
  readonly toolCallId: string;
  readonly result: unknown;
  readonly isError: boolean;
}

export interface CustomMessage extends BaseMessage {
  readonly type: 'custom';
  readonly customType: string;
  readonly payload: unknown;
}

/** Union of all message types — discriminated on `type`. */
export type Message =
  | TextMessage
  | ImageMessage
  | AudioMessage
  | VideoMessage
  | FileMessage
  | LocationMessage
  | SystemMessage
  | AIMessage
  | ToolCallMessage
  | ToolResultMessage
  | CustomMessage;

// ---------------------------------------------------------------------------
// Input type for creating messages (no id/timestamp/status — engine assigns)
// ---------------------------------------------------------------------------

/** Content payload used when sending a new message via ChatEngine. */
interface BaseMessageContent {
  readonly metadata?: MessageMetadata;
}

export type MessageContent =
  | ({ readonly type: 'text'; readonly content: string } & BaseMessageContent)
  | ({
      readonly type: 'image';
      readonly url: string;
      readonly alt?: string;
      readonly dimensions?: ImageDimensions;
    } & BaseMessageContent)
  | ({
      readonly type: 'audio';
      readonly url: string;
      readonly mimeType?: string;
      readonly title?: string;
      readonly durationSeconds?: number;
      readonly size?: number;
    } & BaseMessageContent)
  | ({
      readonly type: 'video';
      readonly url: string;
      readonly mimeType?: string;
      readonly title?: string;
      readonly posterUrl?: string;
      readonly dimensions?: ImageDimensions;
      readonly durationSeconds?: number;
      readonly size?: number;
    } & BaseMessageContent)
  | ({
      readonly type: 'file';
      readonly url: string;
      readonly name: string;
      readonly mimeType: string;
      readonly size: number;
    } & BaseMessageContent)
  | ({
      readonly type: 'location';
      readonly latitude: number;
      readonly longitude: number;
      readonly label?: string;
      readonly address?: string;
      readonly url?: string;
    } & BaseMessageContent)
  | ({
      readonly type: 'system';
      readonly eventKind: SystemEventKind;
      readonly content: string;
    } & BaseMessageContent)
  | ({
      readonly type: 'ai';
      readonly content: string;
      readonly aiMetadata?: AIMetadata;
    } & BaseMessageContent)
  | ({
      readonly type: 'tool_call';
      readonly toolCalls: ReadonlyArray<ToolCall>;
    } & BaseMessageContent)
  | ({
      readonly type: 'tool_result';
      readonly toolCallId: string;
      readonly result: unknown;
      readonly isError: boolean;
    } & BaseMessageContent)
  | ({
      readonly type: 'custom';
      readonly customType: string;
      readonly payload: unknown;
    } & BaseMessageContent);
