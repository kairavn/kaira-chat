import type {
  ConnectionState,
  ITransport,
  TransportCapabilities,
  TransportEvent,
  Unsubscribe,
} from '@kaira/chat-core';

/**
 * Callback that returns inbound transport events from an external source.
 */
export type PollEventsFn<TInbound extends TransportEvent = TransportEvent> = () => Promise<
  ReadonlyArray<TInbound>
>;

/**
 * Optional callback used for outbound transport sends.
 */
export type SendEventFn<TOutbound extends TransportEvent = TransportEvent> = (
  event: TOutbound,
) => Promise<void>;

/**
 * Optional callback invoked when polling fails.
 */
export type PollingErrorHandler = (error: unknown) => void;

/**
 * Configuration for PollingTransport.
 */
export interface PollingTransportConfig<
  TInbound extends TransportEvent = TransportEvent,
  TOutbound extends TransportEvent = TransportEvent,
> {
  readonly capabilities?: TransportCapabilities;
  /** Poll interval in milliseconds. Defaults to 2000ms. */
  readonly intervalMs?: number;
  /** Poll function returning zero or more transport events. */
  readonly poll: PollEventsFn<TInbound>;
  /** Optional send function; defaults to no-op. */
  readonly send?: SendEventFn<TOutbound>;
  /** Optional error hook for poll failures. */
  readonly onPollError?: PollingErrorHandler;
  /** Poll immediately once after connect. Defaults to true. */
  readonly pollImmediately?: boolean;
}

/**
 * Generic polling-based ITransport implementation.
 */
export class PollingTransport<
  TInbound extends TransportEvent = TransportEvent,
  TOutbound extends TransportEvent = TransportEvent,
> implements ITransport<TInbound, TOutbound> {
  readonly capabilities: TransportCapabilities | undefined;
  private readonly config: PollingTransportConfig<TInbound, TOutbound>;
  private readonly messageHandlers = new Set<(event: TInbound) => void>();
  private readonly stateHandlers = new Set<(state: ConnectionState) => void>();
  private state: ConnectionState = 'disconnected';
  private pollTimer: ReturnType<typeof setTimeout> | undefined;
  private isPolling = false;
  private activePollPromise: Promise<void> | undefined;
  private connectionGeneration = 0;
  private consecutiveErrors = 0;

  constructor(config: PollingTransportConfig<TInbound, TOutbound>) {
    this.config = config;
    this.capabilities = config.capabilities;
  }

  /**
   * Opens transport and starts periodic polling.
   */
  async connect(): Promise<void> {
    if (this.state !== 'disconnected') {
      return;
    }

    const generation = ++this.connectionGeneration;
    this.consecutiveErrors = 0;
    this.setState('connecting');
    this.setState('connected');

    const shouldPollImmediately = this.config.pollImmediately ?? true;
    if (shouldPollImmediately) {
      await this.safePollOnce(generation);
    }

    if (!this.isCurrentGeneration(generation)) {
      return;
    }

    if (!shouldPollImmediately) {
      this.scheduleNextPoll(generation);
    }
  }

  /**
   * Stops polling and closes transport.
   */
  async disconnect(): Promise<void> {
    if (this.state === 'disconnected' || this.state === 'disconnecting') {
      return;
    }

    this.connectionGeneration++;
    this.setState('disconnecting');
    this.clearPollTimer();

    if (this.activePollPromise) {
      await this.activePollPromise;
    }

    this.consecutiveErrors = 0;
    this.setState('disconnected');
  }

  /**
   * Sends an outbound event using configured sender callback.
   */
  async send(event: TOutbound): Promise<void> {
    if (!this.canPoll() || !this.config.send) {
      return;
    }
    await this.config.send(event);
  }

  /**
   * Subscribe to inbound events.
   */
  onMessage(handler: (event: TInbound) => void): Unsubscribe {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Subscribe to connection state updates.
   */
  onStateChange(handler: (state: ConnectionState) => void): Unsubscribe {
    this.stateHandlers.add(handler);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  /**
   * Current connection state.
   */
  getState(): ConnectionState {
    return this.state;
  }

  private async safePollOnce(generation: number = this.connectionGeneration): Promise<void> {
    if (!this.isCurrentGeneration(generation) || !this.canPoll() || this.isPolling) {
      return;
    }

    this.isPolling = true;
    const pollWork = (async (): Promise<void> => {
      try {
        const events = await this.config.poll();
        if (!this.isCurrentGeneration(generation) || !this.canPoll()) {
          return;
        }

        this.consecutiveErrors = 0;
        if (this.state === 'reconnecting') {
          this.setState('connected');
        }

        for (const event of events) {
          this.emitMessage(event);
        }
      } catch (error) {
        if (!this.isCurrentGeneration(generation) || !this.canPoll()) {
          return;
        }

        this.consecutiveErrors++;
        if (this.state === 'connected') {
          this.setState('reconnecting');
        }
        this.config.onPollError?.(error);
      } finally {
        this.isPolling = false;
        this.activePollPromise = undefined;
        if (this.isCurrentGeneration(generation) && this.canPoll()) {
          this.scheduleNextPoll(generation);
        }
      }
    })();

    this.activePollPromise = pollWork;
    return pollWork;
  }

  private emitMessage(event: TInbound): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(event);
      } catch {
        // Subscriber errors should not break transport loop.
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

  private canPoll(): boolean {
    return this.state === 'connected' || this.state === 'reconnecting';
  }

  private clearPollTimer(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private scheduleNextPoll(generation: number): void {
    if (!this.isCurrentGeneration(generation) || !this.canPoll()) {
      return;
    }

    this.clearPollTimer();

    const baseDelay = this.config.intervalMs ?? 2000;
    const retryDelay =
      this.consecutiveErrors === 0
        ? baseDelay
        : Math.min(baseDelay * 2 ** this.consecutiveErrors, 30_000);
    const jitter = this.consecutiveErrors === 0 ? 0 : Math.random() * retryDelay * 0.2;
    const delay = retryDelay + jitter;

    this.pollTimer = setTimeout(() => {
      void this.safePollOnce(generation);
    }, delay);
  }

  private isCurrentGeneration(generation: number): boolean {
    return generation === this.connectionGeneration;
  }
}
