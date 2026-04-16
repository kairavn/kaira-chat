import type { ConnectionState, TransportEvent } from '@kaira/chat-core';
import type {
  WebSocketCloseEventLike,
  WebSocketFactory,
  WebSocketFrameData,
  WebSocketLike,
  WebSocketMessageEventLike,
} from './websocket-transport.js';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebSocketTransport } from './websocket-transport.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isParticipantRole(value: unknown): value is 'user' | 'assistant' | 'system' | 'custom' {
  return value === 'user' || value === 'assistant' || value === 'system' || value === 'custom';
}

function isMessageStatus(
  value: unknown,
): value is 'pending' | 'sent' | 'delivered' | 'read' | 'failed' {
  return (
    value === 'pending' ||
    value === 'sent' ||
    value === 'delivered' ||
    value === 'read' ||
    value === 'failed'
  );
}

function createMessageEvent(id: string): TransportEvent<'message'> {
  return {
    type: 'message',
    payload: {
      id,
      conversationId: 'c1',
      sender: { id: 'u1', role: 'user' },
      timestamp: 1000,
      status: 'sent',
      type: 'text',
      content: id,
    },
    timestamp: 1000,
  };
}

class FakeSocket implements WebSocketLike {
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: WebSocketMessageEventLike) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: WebSocketCloseEventLike) => void) | null = null;
  readonly sentFrames: WebSocketFrameData[] = [];
  closeCalls = 0;

  send(data: WebSocketFrameData): void {
    this.sentFrames.push(data);
  }

  close(): void {
    this.closeCalls += 1;
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: 'closed', wasClean: true });
  }

  emitOpen(): void {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }

  emitMessage(data: unknown): void {
    this.onmessage?.({ data });
  }

  emitError(): void {
    this.readyState = 3;
    this.onerror?.(new Event('error'));
  }

  emitClose(
    event: WebSocketCloseEventLike = { code: 1006, reason: 'unexpected', wasClean: false },
  ): void {
    this.readyState = 3;
    this.onclose?.(event);
  }
}

function parseTransportEvent(value: string): TransportEvent<'message'> {
  const parsed = JSON.parse(value);
  if (!isRecord(parsed)) {
    throw new Error('Expected object event payload');
  }

  if (parsed['type'] !== 'message' || typeof parsed['timestamp'] !== 'number') {
    throw new Error('Expected message transport event');
  }

  const payload = parsed['payload'];
  if (!isRecord(payload)) {
    throw new Error('Expected message payload');
  }

  if (
    typeof payload['id'] !== 'string' ||
    typeof payload['conversationId'] !== 'string' ||
    !isRecord(payload['sender']) ||
    typeof payload['sender']['id'] !== 'string' ||
    !isParticipantRole(payload['sender']['role']) ||
    typeof payload['timestamp'] !== 'number' ||
    !isMessageStatus(payload['status']) ||
    payload['type'] !== 'text' ||
    typeof payload['content'] !== 'string'
  ) {
    throw new Error('Expected text message payload');
  }

  return {
    type: 'message',
    timestamp: parsed['timestamp'],
    payload: {
      id: payload['id'],
      conversationId: payload['conversationId'],
      sender: {
        id: payload['sender']['id'],
        role: payload['sender']['role'],
      },
      timestamp: payload['timestamp'],
      status: payload['status'],
      type: 'text',
      content: payload['content'],
    },
  };
}

function createTransportFixture(): {
  readonly sockets: FakeSocket[];
  readonly transport: WebSocketTransport<TransportEvent<'message'>, TransportEvent<'message'>>;
} {
  const sockets: FakeSocket[] = [];
  const createSocket: WebSocketFactory = () => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  };

  const transport = new WebSocketTransport({
    url: 'ws://localhost:3000/chat',
    createSocket,
    deserialize: (value) => {
      if (typeof value !== 'string') {
        throw new Error('Expected string frame');
      }

      return parseTransportEvent(value);
    },
    reconnectDelayMs: 1000,
    maxReconnectDelayMs: 4000,
    backoffMultiplier: 2,
    jitterRatio: 0,
  });

  return { sockets, transport };
}

describe('WebSocketTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('connects and disconnects cleanly', async () => {
    const { sockets, transport } = createTransportFixture();
    const states: ConnectionState[] = [];
    transport.onStateChange((state) => {
      states.push(state);
    });

    const connectPromise = transport.connect();
    sockets[0]!.emitOpen();
    await connectPromise;

    expect(transport.getState()).toBe('connected');

    await transport.disconnect();

    expect(transport.getState()).toBe('disconnected');
    expect(states).toEqual(['connecting', 'connected', 'disconnecting', 'disconnected']);
    expect(sockets[0]!.closeCalls).toBe(1);
  });

  it('sends outbound events once connected', async () => {
    const { sockets, transport } = createTransportFixture();
    const outboundEvent = createMessageEvent('m-outbound');

    const connectPromise = transport.connect();
    sockets[0]!.emitOpen();
    await connectPromise;

    await transport.send(outboundEvent);

    expect(sockets[0]!.sentFrames).toEqual([JSON.stringify(outboundEvent)]);
  });

  it('delivers inbound events from socket frames', async () => {
    const { sockets, transport } = createTransportFixture();
    const handler = vi.fn();
    transport.onMessage(handler);

    const connectPromise = transport.connect();
    sockets[0]!.emitOpen();
    await connectPromise;

    const inboundEvent = createMessageEvent('m-inbound');
    sockets[0]!.emitMessage(JSON.stringify(inboundEvent));

    expect(handler).toHaveBeenCalledWith(inboundEvent);
  });

  it('delivers every event from one frame when deserialize returns an array', async () => {
    const sockets: FakeSocket[] = [];
    const handler = vi.fn();
    const transport = new WebSocketTransport<TransportEvent<'message'>, TransportEvent<'message'>>({
      url: 'ws://localhost:3000/chat',
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      deserialize: (value) => {
        if (typeof value !== 'string') {
          throw new Error('Expected string frame');
        }

        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          throw new Error('Expected array frame');
        }

        return parsed.map((item) => parseTransportEvent(JSON.stringify(item)));
      },
      reconnectDelayMs: 1000,
      jitterRatio: 0,
    });
    transport.onMessage(handler);

    const connectPromise = transport.connect();
    sockets[0]!.emitOpen();
    await connectPromise;

    const inboundEvents = [createMessageEvent('m-1'), createMessageEvent('m-2')];
    sockets[0]!.emitMessage(JSON.stringify(inboundEvents));

    expect(handler).toHaveBeenNthCalledWith(1, inboundEvents[0]);
    expect(handler).toHaveBeenNthCalledWith(2, inboundEvents[1]);
  });

  it('reconnects after an unexpected close and ignores stale socket events', async () => {
    const { sockets, transport } = createTransportFixture();
    const states: ConnectionState[] = [];
    const handler = vi.fn();
    transport.onStateChange((state) => {
      states.push(state);
    });
    transport.onMessage(handler);

    const connectPromise = transport.connect();
    sockets[0]!.emitOpen();
    await connectPromise;

    sockets[0]!.emitClose();
    expect(transport.getState()).toBe('reconnecting');

    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(2);

    sockets[0]!.emitMessage(JSON.stringify(createMessageEvent('m-stale')));
    expect(handler).not.toHaveBeenCalled();

    sockets[1]!.emitOpen();
    await vi.runAllTicks();

    sockets[1]!.emitMessage(JSON.stringify(createMessageEvent('m-reconnected')));

    expect(transport.getState()).toBe('connected');
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(createMessageEvent('m-reconnected'));
    expect(states).toEqual(['connecting', 'connected', 'reconnecting', 'connected']);
  });

  it('rejects the initial connect attempt on socket failure and cleans up state', async () => {
    const { sockets, transport } = createTransportFixture();

    const connectPromise = transport.connect();
    sockets[0]!.emitError();
    sockets[0]!.emitClose();

    await expect(connectPromise).rejects.toMatchObject({
      kind: 'transport',
      message: 'WebSocket connection failed.',
    });
    expect(transport.getState()).toBe('disconnected');
  });

  it('reports deserialize failures without tearing down the connection', async () => {
    const sockets: FakeSocket[] = [];
    const onError = vi.fn();
    const transport = new WebSocketTransport<TransportEvent<'message'>, TransportEvent<'message'>>({
      url: 'ws://localhost:3000/chat',
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      deserialize: () => {
        throw new Error('bad payload');
      },
      onError,
      reconnectDelayMs: 1000,
      jitterRatio: 0,
    });

    const connectPromise = transport.connect();
    sockets[0]!.emitOpen();
    await connectPromise;

    sockets[0]!.emitMessage('broken');

    expect(transport.getState()).toBe('connected');
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'transport',
        message: 'Failed to deserialize WebSocket message.',
      }),
    );
  });

  it('stops reconnect timers and detaches listeners on disconnect', async () => {
    const { sockets, transport } = createTransportFixture();

    const connectPromise = transport.connect();
    sockets[0]!.emitOpen();
    await connectPromise;

    sockets[0]!.emitClose();
    expect(transport.getState()).toBe('reconnecting');

    await transport.disconnect();
    await vi.advanceTimersByTimeAsync(5000);

    expect(sockets).toHaveLength(1);
    expect(transport.getState()).toBe('disconnected');
    expect(sockets[0]!.onmessage).toBeNull();
    expect(sockets[0]!.onclose).toBeNull();
  });

  it('rejects sends while disconnected', async () => {
    const { transport } = createTransportFixture();

    await expect(transport.send(createMessageEvent('m-outbound'))).rejects.toMatchObject({
      kind: 'state',
      message: 'Cannot send while the WebSocket transport is disconnected.',
    });
  });
});
