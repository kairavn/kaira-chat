import type {
  ChatEvent,
  ChatEventType,
  ConnectionState,
  Conversation,
  IChatEngine,
  ITransport,
  Message,
} from '@kaira/chat-core';
import type { JSX } from 'react';

/**
 * Number of events retained in memory by default.
 */
export const DEFAULT_EVENT_RING_BUFFER_SIZE = 500;

/**
 * List of core event types supported by ChatEngine.
 */
export const CORE_EVENT_TYPES: ReadonlyArray<ChatEventType> = [
  'message:sent',
  'message:received',
  'message:updated',
  'message:deleted',
  'message:status',
  'message:stream:start',
  'message:stream:chunk',
  'message:stream:end',
  'message:stream:error',
  'typing:start',
  'typing:stop',
  'conversation:created',
  'conversation:updated',
  'conversation:deleted',
  'connection:state',
  'error',
] as const;

/**
 * A single timeline entry in the event inspector.
 */
export interface DevToolsEventEntry {
  readonly id: number;
  readonly type: ChatEventType | `custom:${string}`;
  readonly timestamp: number;
  readonly summary: string;
  readonly payload: ChatEvent | Record<string, unknown>;
}

/**
 * Captured streaming state for one message id.
 */
export interface StreamSnapshot {
  readonly messageId: string;
  readonly conversationId?: string;
  readonly startedAt: number;
  readonly lastUpdatedAt: number;
  readonly chunks: number;
  readonly accumulated: string;
  readonly status: 'streaming' | 'ended' | 'error';
  readonly error?: string;
}

/**
 * Captured transport diagnostics.
 */
export interface TransportSnapshot {
  readonly state: ConnectionState;
  readonly pollingStatus: string;
  readonly lastNetworkEvent?: string;
}

/**
 * Captured middleware flow for one sendMessage lifecycle.
 */
export interface MiddlewareFlowEntry {
  readonly id: number;
  readonly timestamp: number;
  readonly messageId: string;
  readonly conversationId: string;
  readonly steps: ReadonlyArray<string>;
}

/**
 * Captured plugin lifecycle information.
 */
export interface PluginSnapshot {
  readonly name: string;
  readonly version: string;
  readonly status: 'registered' | 'installed' | 'destroyed';
  readonly installTime?: number;
  readonly destroyTime?: number;
}

/**
 * Devtools state exposed to the UI.
 */
export interface ChatDevToolsState {
  readonly connectionState: ConnectionState;
  readonly events: ReadonlyArray<DevToolsEventEntry>;
  readonly messages: ReadonlyArray<Message>;
  readonly conversations: ReadonlyArray<Conversation>;
  readonly streams: ReadonlyArray<StreamSnapshot>;
  readonly transport: TransportSnapshot;
  readonly plugins: ReadonlyArray<PluginSnapshot>;
  readonly middlewareFlows: ReadonlyArray<MiddlewareFlowEntry>;
}

/**
 * Props for the development tools panel.
 */
export interface ChatDevToolsProps {
  readonly engine: IChatEngine;
  readonly maxEvents?: number;
  readonly initiallyOpen?: boolean;
}

/**
 * Optional presentation override for panel container.
 */
export interface ChatDevToolsPanelStyle {
  readonly zIndex?: number;
  readonly width?: number;
  readonly height?: number;
}

/**
 * Props for context-based devtools component.
 */
export interface ChatDevToolsFromContextProps {
  readonly maxEvents?: number;
  readonly initiallyOpen?: boolean;
}

/**
 * Tab identifiers available in the panel.
 */
export type DevToolsTab =
  | 'events'
  | 'messages'
  | 'conversations'
  | 'streaming'
  | 'transport'
  | 'plugins'
  | 'middleware';

/**
 * Render contract for a tab pane.
 */
export interface TabRenderer {
  readonly id: DevToolsTab;
  readonly title: string;
  render(state: ChatDevToolsState): JSX.Element;
}

/**
 * Internal shape for optional engine internals used read-only by devtools.
 */
export interface EngineInternals {
  readonly pipeline?: {
    readonly stack?: ReadonlyArray<unknown>;
  };
  readonly plugins?: ReadonlyArray<{
    readonly name: string;
    readonly version: string;
  }>;
  readonly transport?: ITransport;
}
