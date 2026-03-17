import type { Unsubscribe } from './common.js';
import type { ConnectionState } from './event.js';

/** Category of a transport-level event. */
export type TransportEventType = 'message' | 'typing' | 'status' | 'presence' | 'custom';

/** Payload sent/received over a transport adapter. */
export interface TransportEvent {
  readonly type: TransportEventType;
  readonly payload: Record<string, unknown>;
  readonly timestamp: number;
}

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
