'use client';

import type {
  ConnectionState,
  ITransport,
  TransportCapabilities,
  TransportEvent,
  Unsubscribe,
} from '@kaira/chat-core';
import type { JSX, ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatEngine } from '@kaira/chat-core';

import { ChatProvider } from './chat-context';
import { useConnectionState } from './useConnectionState';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (reason?: unknown) => void;
}

interface ControlledTransportOptions {
  readonly blockFirstConnect: Deferred<void>;
  readonly blockFirstDisconnect: Deferred<void>;
}

class ControlledTransport implements ITransport<
  TransportEvent<'message'>,
  TransportEvent<'message'>
> {
  readonly capabilities: TransportCapabilities = {};

  private readonly stateHandlers = new Set<(state: ConnectionState) => void>();
  private readonly messageHandlers = new Set<(event: TransportEvent<'message'>) => void>();
  private readonly blockFirstConnect: Deferred<void>;
  private readonly blockFirstDisconnect: Deferred<void>;
  private state: ConnectionState = 'disconnected';

  connectCalls = 0;
  disconnectCalls = 0;

  constructor(options: ControlledTransportOptions) {
    this.blockFirstConnect = options.blockFirstConnect;
    this.blockFirstDisconnect = options.blockFirstDisconnect;
  }

  async connect(): Promise<void> {
    this.connectCalls++;
    this.setState('connecting');
    this.setState('connected');

    if (this.connectCalls === 1) {
      await this.blockFirstConnect.promise;
    }
  }

  async disconnect(): Promise<void> {
    this.disconnectCalls++;
    this.setState('disconnecting');

    if (this.disconnectCalls === 1) {
      await this.blockFirstDisconnect.promise;
    }

    this.setState('disconnected');
  }

  async send(_event: TransportEvent<'message'>): Promise<void> {
    return;
  }

  onMessage(handler: (event: TransportEvent<'message'>) => void): Unsubscribe {
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

  private setState(state: ConnectionState): void {
    this.state = state;
    for (const handler of this.stateHandlers) {
      handler(state);
    }
  }
}

function createDeferred<T>(): Deferred<T> {
  let resolveDeferred!: (value: T | PromiseLike<T>) => void;
  let rejectDeferred!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve;
    rejectDeferred = reject;
  });

  return {
    promise,
    resolve: resolveDeferred,
    reject: rejectDeferred,
  };
}

function createEngine(): ChatEngine {
  return new ChatEngine({
    sender: { id: 'self', role: 'user' },
  });
}

function createTree(
  engine: ChatEngine,
  onConnectError: (error: Error) => void,
  children: ReactNode = null,
): JSX.Element {
  return (
    <ChatProvider
      engine={engine}
      autoConnect
      onConnectError={onConnectError}
    >
      {children}
    </ChatProvider>
  );
}

function ConnectionStateProbe(): JSX.Element {
  const state = useConnectionState();

  return <span data-testid="connection-state">{state}</span>;
}

describe('ChatProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not reconnect when only the onConnectError callback identity changes', async () => {
    const engine = createEngine();
    const connectSpy = vi.spyOn(engine, 'connect');
    const disconnectSpy = vi.spyOn(engine, 'disconnect');

    const firstHandler = vi.fn<(error: Error) => void>();
    const secondHandler = vi.fn<(error: Error) => void>();

    const renderResult = render(createTree(engine, firstHandler));

    await vi.waitFor(() => {
      expect(connectSpy).toHaveBeenCalledTimes(1);
    });
    expect(disconnectSpy).not.toHaveBeenCalled();

    renderResult.rerender(createTree(engine, secondHandler));

    await vi.waitFor(() => {
      expect(connectSpy).toHaveBeenCalledTimes(1);
    });
    expect(disconnectSpy).not.toHaveBeenCalled();

    renderResult.unmount();

    await vi.waitFor(() => {
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('reconnects after StrictMode cleanup replays autoConnect', async () => {
    const firstConnectDeferred = createDeferred<void>();
    const firstDisconnectDeferred = createDeferred<void>();
    const transport = new ControlledTransport({
      blockFirstConnect: firstConnectDeferred,
      blockFirstDisconnect: firstDisconnectDeferred,
    });
    const engine = new ChatEngine({
      sender: { id: 'self', role: 'user' },
      transport,
    });
    const onConnectError = vi.fn<(error: Error) => void>();

    const renderResult = render(
      <StrictMode>
        <ChatProvider
          engine={engine}
          autoConnect
          onConnectError={onConnectError}
        >
          <ConnectionStateProbe />
        </ChatProvider>
      </StrictMode>,
    );

    await vi.waitFor(() => {
      expect(transport.connectCalls).toBe(1);
      expect(transport.disconnectCalls).toBe(1);
    });
    expect(screen.getByTestId('connection-state').textContent).toBe('disconnecting');

    await act(async () => {
      firstDisconnectDeferred.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(transport.connectCalls).toBe(2);
    });

    await act(async () => {
      firstConnectDeferred.resolve();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(engine.getConnectionState()).toBe('connected');
      expect(screen.getByTestId('connection-state').textContent).toBe('connected');
    });
    expect(onConnectError).not.toHaveBeenCalled();

    renderResult.unmount();
  });
});
