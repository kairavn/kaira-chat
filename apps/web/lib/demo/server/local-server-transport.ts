import type {
  ConnectionState,
  ITransport,
  TransportCapabilities,
  TransportEvent,
  Unsubscribe,
} from '@kaira/chat-core';

type DemoTransportEvent = TransportEvent<'message' | 'typing'>;

export class LocalServerTransport implements ITransport<DemoTransportEvent, DemoTransportEvent> {
  readonly capabilities: TransportCapabilities = {
    typing: true,
  };

  private readonly messageHandlers = new Set<(event: DemoTransportEvent) => void>();
  private readonly stateHandlers = new Set<(state: ConnectionState) => void>();
  private state: ConnectionState = 'disconnected';

  async connect(): Promise<void> {
    this.setState('connecting');
    this.setState('connected');
  }

  async disconnect(): Promise<void> {
    this.setState('disconnecting');
    this.setState('disconnected');
  }

  async send(): Promise<void> {
    return;
  }

  onMessage(handler: (event: DemoTransportEvent) => void): Unsubscribe {
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

  emitInbound(event: DemoTransportEvent): void {
    for (const handler of this.messageHandlers) {
      handler(event);
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    for (const handler of this.stateHandlers) {
      handler(state);
    }
  }
}
