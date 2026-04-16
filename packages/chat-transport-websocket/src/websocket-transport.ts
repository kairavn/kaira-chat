import type {
  ConnectionState,
  ITransport,
  TransportCapabilities,
  TransportEvent,
  Unsubscribe,
} from '@kaira/chat-core';

import { createChatError } from '@kaira/chat-core';

const WEBSOCKET_OPEN_READY_STATE = 1;

export type WebSocketFrameData = string | ArrayBufferLike | Blob | ArrayBufferView;

export interface WebSocketMessageEventLike {
  readonly data: unknown;
}

export interface WebSocketCloseEventLike {
  readonly code?: number;
  readonly reason?: string;
  readonly wasClean?: boolean;
}

export interface WebSocketLike {
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: WebSocketMessageEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: WebSocketCloseEventLike) => void) | null;
  send(data: WebSocketFrameData): void;
  close(code?: number, reason?: string): void;
}

export type WebSocketFactory = (
  url: string,
  protocols?: string | ReadonlyArray<string>,
) => WebSocketLike;

export type WebSocketMessageDeserializer<TInbound extends TransportEvent = TransportEvent> = (
  data: unknown,
) => TInbound | ReadonlyArray<TInbound> | null;

export type WebSocketMessageSerializer<TOutbound extends TransportEvent = TransportEvent> = (
  event: TOutbound,
) => WebSocketFrameData;

export type WebSocketErrorHandler = (error: unknown) => void;

export interface WebSocketTransportConfig<
  TInbound extends TransportEvent = TransportEvent,
  TOutbound extends TransportEvent = TransportEvent,
> {
  readonly url: string;
  readonly protocols?: string | ReadonlyArray<string>;
  readonly capabilities?: TransportCapabilities;
  readonly createSocket?: WebSocketFactory;
  readonly deserialize: WebSocketMessageDeserializer<TInbound>;
  readonly serialize?: WebSocketMessageSerializer<TOutbound>;
  readonly onError?: WebSocketErrorHandler;
  readonly reconnect?: boolean;
  readonly reconnectDelayMs?: number;
  readonly maxReconnectDelayMs?: number;
  readonly backoffMultiplier?: number;
  readonly jitterRatio?: number;
}

class BrowserWebSocketAdapter implements WebSocketLike {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: WebSocketMessageEventLike) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: WebSocketCloseEventLike) => void) | null = null;

  private readonly socket: WebSocket;

  constructor(socket: WebSocket) {
    this.socket = socket;
    this.socket.onopen = (event) => {
      this.onopen?.(event);
    };
    this.socket.onmessage = (event) => {
      this.onmessage?.(event);
    };
    this.socket.onerror = (event) => {
      this.onerror?.(event);
    };
    this.socket.onclose = (event) => {
      this.onclose?.(event);
    };
  }

  get readyState(): number {
    return this.socket.readyState;
  }

  send(data: WebSocketFrameData): void {
    this.socket.send(data);
  }

  close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }
}

function createBrowserSocket(
  url: string,
  protocols?: string | ReadonlyArray<string>,
): WebSocketLike {
  if (typeof WebSocket === 'undefined') {
    throw createChatError('transport', 'WebSocket is not available in this environment.');
  }

  if (protocols === undefined) {
    return new BrowserWebSocketAdapter(new WebSocket(url));
  }

  const nextProtocols = normalizeProtocols(protocols);
  return new BrowserWebSocketAdapter(new WebSocket(url, nextProtocols));
}

function toTransportError(message: string, cause: unknown): ReturnType<typeof createChatError> {
  return createChatError('transport', message, { cause });
}

function normalizeProtocols(
  protocols?: string | ReadonlyArray<string>,
): string | string[] | undefined {
  if (protocols === undefined || typeof protocols === 'string') {
    return protocols;
  }

  return [...protocols];
}

function defaultSerialize<TOutbound extends TransportEvent>(event: TOutbound): string {
  return JSON.stringify(event);
}

export class WebSocketTransport<
  TInbound extends TransportEvent = TransportEvent,
  TOutbound extends TransportEvent = TransportEvent,
> implements ITransport<TInbound, TOutbound> {
  readonly capabilities: TransportCapabilities | undefined;

  private readonly config: WebSocketTransportConfig<TInbound, TOutbound>;
  private readonly messageHandlers = new Set<(event: TInbound) => void>();
  private readonly stateHandlers = new Set<(state: ConnectionState) => void>();
  private state: ConnectionState = 'disconnected';
  private socket: WebSocketLike | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private connectionGeneration = 0;
  private reconnectAttemptCount = 0;
  private manualDisconnect = false;

  constructor(config: WebSocketTransportConfig<TInbound, TOutbound>) {
    this.config = config;
    this.capabilities = config.capabilities;
  }

  async connect(): Promise<void> {
    if (this.state !== 'disconnected') {
      return;
    }

    this.manualDisconnect = false;
    this.reconnectAttemptCount = 0;
    this.clearReconnectTimer();

    const generation = ++this.connectionGeneration;
    this.setState('connecting');

    try {
      await this.openSocket(generation);
    } catch (error) {
      if (this.isCurrentGeneration(generation)) {
        this.setState('disconnected');
      }

      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.state === 'disconnected' || this.state === 'disconnecting') {
      return;
    }

    this.manualDisconnect = true;
    this.clearReconnectTimer();
    this.reconnectAttemptCount = 0;
    this.connectionGeneration++;

    const socket = this.socket;
    this.socket = undefined;

    this.setState('disconnecting');

    if (socket) {
      try {
        socket.close();
      } catch (error) {
        this.reportError(toTransportError('WebSocket close failed.', error));
      }
      this.detachSocket(socket);
    }

    this.setState('disconnected');
  }

  async send(event: TOutbound): Promise<void> {
    const socket = this.socket;
    if (
      this.state !== 'connected' ||
      socket === undefined ||
      socket.readyState !== WEBSOCKET_OPEN_READY_STATE
    ) {
      throw createChatError('state', `Cannot send while the WebSocket transport is ${this.state}.`);
    }

    try {
      const serialize = this.config.serialize ?? defaultSerialize<TOutbound>;
      socket.send(serialize(event));
    } catch (error) {
      const transportError = toTransportError('WebSocket send failed.', error);
      this.reportError(transportError);
      throw transportError;
    }
  }

  onMessage(handler: (event: TInbound) => void): Unsubscribe {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onStateChange(handler: (state: ConnectionState) => void): Unsubscribe {
    this.stateHandlers.add(handler);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  getState(): ConnectionState {
    return this.state;
  }

  private async openSocket(generation: number): Promise<void> {
    const createSocket = this.config.createSocket ?? createBrowserSocket;
    const socket = createSocket(this.config.url, this.config.protocols);
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      let opened = false;
      let settled = false;

      const resolveOnce = (): void => {
        if (settled) {
          return;
        }

        settled = true;
        opened = true;
        this.reconnectAttemptCount = 0;

        if (this.isCurrentSocket(socket, generation)) {
          this.setState('connected');
        }

        resolve();
      };

      const rejectOnce = (error: unknown): void => {
        if (settled) {
          return;
        }

        settled = true;
        if (this.socket === socket) {
          this.socket = undefined;
        }

        reject(error);
      };

      socket.onopen = () => {
        if (!this.isCurrentGeneration(generation)) {
          rejectOnce(createChatError('state', 'WebSocket connect attempt was interrupted.'));
          try {
            socket.close();
          } catch {
            // Ignore cleanup failures for stale sockets.
          }
          this.detachSocket(socket);
          return;
        }

        resolveOnce();
      };

      socket.onmessage = (event) => {
        if (!this.isCurrentSocket(socket, generation)) {
          return;
        }

        try {
          const parsed = this.config.deserialize(event.data);
          if (parsed === null) {
            return;
          }

          const events = Array.isArray(parsed) ? parsed : [parsed];
          for (const inboundEvent of events) {
            this.emitMessage(inboundEvent);
          }
        } catch (error) {
          this.reportError(toTransportError('Failed to deserialize WebSocket message.', error));
        }
      };

      socket.onerror = (event) => {
        const transportError = toTransportError('WebSocket connection failed.', event);
        this.reportError(transportError);

        if (!opened) {
          rejectOnce(transportError);
        }
      };

      socket.onclose = (event) => {
        if (!opened) {
          rejectOnce(toTransportError('WebSocket connection closed before it was ready.', event));
          return;
        }

        if (!this.isCurrentSocket(socket, generation)) {
          return;
        }

        this.socket = undefined;
        this.detachSocket(socket);

        if (this.manualDisconnect || this.state === 'disconnecting') {
          return;
        }

        if (this.config.reconnect === false) {
          this.setState('disconnected');
          this.reportError(toTransportError('WebSocket connection closed unexpectedly.', event));
          return;
        }

        this.setState('reconnecting');
        this.scheduleReconnect(
          generation,
          toTransportError('WebSocket connection closed unexpectedly.', event),
        );
      };
    });
  }

  private scheduleReconnect(generation: number, error: unknown): void {
    if (!this.isCurrentGeneration(generation) || this.manualDisconnect) {
      return;
    }

    this.reportError(error);

    const delayMs = this.computeReconnectDelayMs();
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;

      if (!this.isCurrentGeneration(generation) || this.manualDisconnect) {
        return;
      }

      void this.openSocket(generation).catch((reconnectError) => {
        if (!this.isCurrentGeneration(generation) || this.manualDisconnect) {
          return;
        }

        this.setState('reconnecting');
        this.scheduleReconnect(generation, reconnectError);
      });
    }, delayMs);
  }

  private computeReconnectDelayMs(): number {
    const reconnectDelayMs = this.config.reconnectDelayMs ?? 1000;
    const maxReconnectDelayMs = this.config.maxReconnectDelayMs ?? 30_000;
    const backoffMultiplier = this.config.backoffMultiplier ?? 2;
    const jitterRatio = this.config.jitterRatio ?? 0.2;

    const exponentialDelay = Math.min(
      reconnectDelayMs * backoffMultiplier ** this.reconnectAttemptCount,
      maxReconnectDelayMs,
    );
    this.reconnectAttemptCount += 1;

    const jitter = exponentialDelay * jitterRatio * Math.random();
    return Math.min(Math.round(exponentialDelay + jitter), maxReconnectDelayMs);
  }

  private emitMessage(event: TInbound): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(event);
      } catch {
        // Subscriber errors should not break transport delivery.
      }
    }
  }

  private setState(nextState: ConnectionState): void {
    this.state = nextState;
    for (const handler of this.stateHandlers) {
      try {
        handler(nextState);
      } catch {
        // Subscriber errors should not break state transitions.
      }
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private detachSocket(socket: WebSocketLike): void {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
  }

  private isCurrentGeneration(generation: number): boolean {
    return this.connectionGeneration === generation;
  }

  private isCurrentSocket(socket: WebSocketLike, generation: number): boolean {
    return this.socket === socket && this.isCurrentGeneration(generation);
  }

  private reportError(error: unknown): void {
    this.config.onError?.(error);
  }
}
