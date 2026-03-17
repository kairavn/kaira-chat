import type { ConnectionState, ITransport, TransportEvent, Unsubscribe } from '@kaira/chat-core';

interface InternalPollingTransportConfig<
  TInbound extends TransportEvent = TransportEvent,
  TOutbound extends TransportEvent = TransportEvent,
> {
  readonly intervalMs?: number;
  readonly poll: () => Promise<ReadonlyArray<TInbound>>;
  readonly send?: (event: TOutbound) => Promise<void>;
  readonly onPollError?: (error: unknown) => void;
  readonly pollImmediately?: boolean;
}

/**
 * Internal polling transport used by DitTransport to avoid cross-package coupling.
 */
export class InternalPollingTransport<
  TInbound extends TransportEvent = TransportEvent,
  TOutbound extends TransportEvent = TransportEvent,
> implements ITransport<TInbound, TOutbound> {
  private readonly config: InternalPollingTransportConfig<TInbound, TOutbound>;
  private readonly messageHandlers = new Set<(event: TInbound) => void>();
  private readonly stateHandlers = new Set<(state: ConnectionState) => void>();
  private state: ConnectionState = 'disconnected';
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private isPolling = false;
  private activePollPromise: Promise<void> | undefined;
  private connectionGeneration = 0;

  constructor(config: InternalPollingTransportConfig<TInbound, TOutbound>) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.state !== 'disconnected') return;

    const generation = ++this.connectionGeneration;
    this.setState('connecting');
    this.setState('connected');

    if (this.config.pollImmediately ?? true) {
      await this.safePollOnce();
    }

    if (this.getState() !== 'connected' || generation !== this.connectionGeneration) return;

    this.pollTimer = setInterval(() => {
      this.safePollOnce().catch(() => {});
    }, this.config.intervalMs ?? 2000);
  }

  async disconnect(): Promise<void> {
    if (this.state === 'disconnected' || this.state === 'disconnecting') return;

    this.connectionGeneration++;
    this.setState('disconnecting');
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    if (this.activePollPromise) {
      await this.activePollPromise;
    }

    this.setState('disconnected');
  }

  async send(event: TOutbound): Promise<void> {
    if (this.state !== 'connected' || !this.config.send) return;
    await this.config.send(event);
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

  private async safePollOnce(): Promise<void> {
    if (this.state !== 'connected' || this.isPolling) return;

    this.isPolling = true;
    const pollWork = (async (): Promise<void> => {
      try {
        const events = await this.config.poll();
        if (this.state !== 'connected') return;
        events.forEach((event) => {
          this.emitMessage(event);
        });
      } catch (error) {
        this.config.onPollError?.(error);
      } finally {
        this.isPolling = false;
        this.activePollPromise = undefined;
      }
    })();

    this.activePollPromise = pollWork;
    return pollWork;
  }

  private emitMessage(event: TInbound): void {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch {
        // Subscriber errors should not break transport loop.
      }
    });
  }

  private setState(nextState: ConnectionState): void {
    this.state = nextState;
    this.stateHandlers.forEach((handler) => {
      try {
        handler(nextState);
      } catch {
        // Subscriber errors should not break state transitions.
      }
    });
  }
}
