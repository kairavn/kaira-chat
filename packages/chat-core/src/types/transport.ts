import type { Unsubscribe } from './common.js';
import type { ConnectionState } from './event.js';
import type { Message } from './message.js';
import type { TypingTransportPayload } from './typing.js';

/** Optional capability declaration for transport adapters. */
export interface TransportCapabilities {
  readonly typing?: boolean;
}

/** Category of a transport-level event. */
export interface TransportEventMap {
  readonly message: Message;
  readonly typing: TypingTransportPayload;
  readonly status: {
    readonly state: ConnectionState;
  };
  readonly presence: Record<string, unknown>;
  readonly custom: Record<string, unknown>;
}

/** Category of a transport-level event. */
export type TransportEventType = keyof TransportEventMap;

/** Payload sent/received over a transport adapter. */
export type TransportEvent<TType extends TransportEventType = TransportEventType> = {
  readonly [Type in TType]: {
    readonly type: Type;
    readonly payload: TransportEventMap[Type];
    readonly timestamp: number;
  };
}[TType];

/**
 * Interface contract for real-time communication adapters.
 *
 * Consumers implement this to connect the chat core to WebSocket, SSE,
 * polling, or any other transport mechanism.
 */
export interface ITransport<
  TInbound extends TransportEvent = TransportEvent,
  TOutbound extends TransportEvent = TransportEvent,
> {
  readonly capabilities?: TransportCapabilities;
  /** Open the transport connection. */
  connect(): Promise<void>;

  /** Gracefully close the transport connection. */
  disconnect(): Promise<void>;

  /** Send an event over the wire. */
  send(event: TOutbound): Promise<void>;

  /** Subscribe to incoming transport events. */
  onMessage(handler: (event: TInbound) => void): Unsubscribe;

  /** Subscribe to connection state changes. */
  onStateChange(handler: (state: ConnectionState) => void): Unsubscribe;

  /** Current connection state of the transport. */
  getState(): ConnectionState;
}
