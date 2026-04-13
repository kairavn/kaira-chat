import type { ConnectionState, TransportEvent } from '@kaira/chat-core';
import type { SendEventFn } from './polling-transport.js';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PollingTransport } from './polling-transport.js';

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

function createDeferred<TValue>(): {
  readonly promise: Promise<TValue>;
  readonly resolve: (value: TValue) => void;
  readonly reject: (reason?: unknown) => void;
} {
  let resolvePromise: ((value: TValue) => void) | undefined;
  let rejectPromise: ((reason?: unknown) => void) | undefined;

  const promise = new Promise<TValue>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  if (!resolvePromise || !rejectPromise) {
    throw new Error('Failed to create deferred promise');
  }

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

describe('PollingTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('polls immediately and then on the steady-state interval', async () => {
    const poll = vi
      .fn<() => Promise<ReadonlyArray<TransportEvent<'message'>>>>()
      .mockResolvedValue([]);
    const transport = new PollingTransport({
      intervalMs: 1000,
      poll,
    });

    await transport.connect();
    expect(poll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(poll).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it('backs off with capped exponential delay and jitter after failures', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);

    const states: ConnectionState[] = [];
    const poll = vi
      .fn<() => Promise<ReadonlyArray<TransportEvent<'message'>>>>()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockRejectedValueOnce(new Error('second failure'))
      .mockResolvedValue([]);
    const transport = new PollingTransport({
      intervalMs: 1000,
      poll,
    });

    transport.onStateChange((state) => {
      states.push(state);
    });

    await transport.connect();
    expect(states).toEqual(['connecting', 'connected', 'reconnecting']);
    expect(poll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2399);
    expect(poll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(poll).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(4799);
    expect(poll).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    expect(poll).toHaveBeenCalledTimes(3);
    expect(states).toEqual(['connecting', 'connected', 'reconnecting', 'connected']);
  });

  it('recovers from reconnecting and delivers messages after a successful retry', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const messageHandler = vi.fn();
    const poll = vi
      .fn<() => Promise<ReadonlyArray<TransportEvent<'message'>>>>()
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockResolvedValueOnce([createMessageEvent('m-recovered')]);
    const transport = new PollingTransport({
      intervalMs: 1000,
      poll,
    });

    transport.onMessage(messageHandler);

    await transport.connect();
    expect(transport.getState()).toBe('reconnecting');

    await vi.advanceTimersByTimeAsync(2000);

    expect(transport.getState()).toBe('connected');
    expect(messageHandler).toHaveBeenCalledWith(createMessageEvent('m-recovered'));
  });

  it('keeps outbound sends enabled while reconnecting', async () => {
    const send = vi.fn<SendEventFn<TransportEvent<'message'>>>().mockResolvedValue(undefined);
    const poll = vi
      .fn<() => Promise<ReadonlyArray<TransportEvent<'message'>>>>()
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockResolvedValue([]);
    const transport = new PollingTransport({
      intervalMs: 1000,
      poll,
      send,
    });
    const outboundEvent = createMessageEvent('m-outbound');

    await transport.connect();
    expect(transport.getState()).toBe('reconnecting');

    await transport.send(outboundEvent);

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(outboundEvent);
  });

  it('rejects outbound sends before the transport is ready', async () => {
    const send = vi.fn<SendEventFn<TransportEvent<'message'>>>().mockResolvedValue(undefined);
    const transport = new PollingTransport({
      poll: vi.fn<() => Promise<ReadonlyArray<TransportEvent<'message'>>>>().mockResolvedValue([]),
      send,
    });
    const outboundEvent = createMessageEvent('m-outbound');

    await expect(transport.send(outboundEvent)).rejects.toMatchObject({
      kind: 'state',
      message: 'Cannot send while the polling transport is disconnected.',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('can trigger an immediate follow-up poll after a successful send', async () => {
    const send = vi.fn<SendEventFn<TransportEvent<'message'>>>().mockResolvedValue(undefined);
    const poll = vi
      .fn<() => Promise<ReadonlyArray<TransportEvent<'message'>>>>()
      .mockResolvedValue([]);
    const transport = new PollingTransport({
      intervalMs: 1000,
      poll,
      send,
      pollAfterSend: true,
    });

    await transport.connect();
    expect(poll).toHaveBeenCalledTimes(1);

    await transport.send(createMessageEvent('m-outbound'));

    await vi.waitFor(() => {
      expect(poll).toHaveBeenCalledTimes(2);
    });
  });

  it('queues exactly one immediate follow-up poll when a send lands during an active poll', async () => {
    const send = vi.fn<SendEventFn<TransportEvent<'message'>>>().mockResolvedValue(undefined);
    const deferred = createDeferred<ReadonlyArray<TransportEvent<'message'>>>();
    const poll = vi
      .fn<() => Promise<ReadonlyArray<TransportEvent<'message'>>>>()
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => deferred.promise)
      .mockResolvedValueOnce([]);
    const transport = new PollingTransport({
      intervalMs: 1000,
      poll,
      send,
      pollAfterSend: true,
    });

    await transport.connect();
    expect(poll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(poll).toHaveBeenCalledTimes(2);

    await transport.send(createMessageEvent('m-outbound'));
    expect(send).toHaveBeenCalledOnce();
    expect(poll).toHaveBeenCalledTimes(2);

    deferred.resolve([]);

    await vi.waitFor(() => {
      expect(poll).toHaveBeenCalledTimes(3);
    });
  });

  it('stops timers and suppresses delivery after disconnect', async () => {
    const deferred = createDeferred<ReadonlyArray<TransportEvent<'message'>>>();
    const poll = vi
      .fn<() => Promise<ReadonlyArray<TransportEvent<'message'>>>>()
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => deferred.promise);
    const messageHandler = vi.fn();
    const transport = new PollingTransport({
      intervalMs: 1000,
      poll,
    });

    transport.onMessage(messageHandler);

    await transport.connect();
    await vi.advanceTimersByTimeAsync(1000);
    expect(poll).toHaveBeenCalledTimes(2);

    const disconnectPromise = transport.disconnect();
    deferred.resolve([createMessageEvent('m-late')]);
    await disconnectPromise;

    expect(transport.getState()).toBe('disconnected');
    expect(messageHandler).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);
    expect(poll).toHaveBeenCalledTimes(2);
  });
});
