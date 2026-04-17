import type { RawData } from 'ws';

import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildDemoWebSocketConnectionKey,
  createDemoWebSocketConnectionRegistry,
  DEMO_WEBSOCKET_POLL_INTERVAL_MS,
  getDemoWebSocketBridgeBaseUrl,
  handleDemoWebSocketClientFrame,
  handleDemoWebSocketConnection,
  parseDemoWebSocketConnection,
  parseDemoWebSocketFrame,
} from './demo-websocket-server';

describe('demo websocket server helpers', () => {
  const originalFetch = globalThis.fetch;
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const originalPort = process.env.PORT;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    delete process.env.PORT;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    process.env.PORT = originalPort;
  });

  it('parses the demo websocket connection request from the expected path', () => {
    expect(
      parseDemoWebSocketConnection('/demo-websocket?demoId=websocket&sessionId=session-1'),
    ).toEqual({
      demoId: 'websocket',
      sessionId: 'session-1',
    });
  });

  it('parses websocket text and typing frames from raw socket data', () => {
    const typingFrame = Buffer.from(
      JSON.stringify({
        type: 'typing',
        payload: {
          action: 'start',
          conversationId: 'conversation-1',
        },
      }),
    ) satisfies RawData;

    const messageFrame = Buffer.from(
      JSON.stringify({
        type: 'message',
        payload: {
          conversationId: 'conversation-1',
          content: 'hello',
          type: 'text',
        },
      }),
    ) satisfies RawData;

    expect(parseDemoWebSocketFrame(typingFrame)).toEqual({
      type: 'typing',
      payload: {
        action: 'start',
        conversationId: 'conversation-1',
      },
    });

    expect(parseDemoWebSocketFrame(messageFrame)).toEqual({
      type: 'message',
      payload: {
        content: 'hello',
        conversationId: 'conversation-1',
        type: 'text',
      },
    });
  });

  it('throws when parseDemoWebSocketConnection receives an undefined URL', () => {
    expect(() => parseDemoWebSocketConnection(undefined)).toThrow('Missing WebSocket request URL.');
  });

  it('throws when parseDemoWebSocketConnection receives a path other than the demo path', () => {
    expect(() =>
      parseDemoWebSocketConnection('/wrong-path?demoId=websocket&sessionId=session-1'),
    ).toThrow('Unexpected WebSocket path.');
  });

  it('parses a websocket frame delivered as a Buffer array', () => {
    const payload = JSON.stringify({
      type: 'typing',
      payload: {
        action: 'stop',
        conversationId: 'conversation-1',
      },
    });

    const chunked = [
      Buffer.from(payload.slice(0, 10)),
      Buffer.from(payload.slice(10)),
    ] satisfies RawData;

    expect(parseDemoWebSocketFrame(chunked)).toEqual({
      type: 'typing',
      payload: {
        action: 'stop',
        conversationId: 'conversation-1',
      },
    });
  });

  it('closes every tracked connection for one demo session key', () => {
    const registry = createDemoWebSocketConnectionRegistry();
    const closeA = vi.fn();
    const closeB = vi.fn();
    const detachA = registry.track(buildDemoWebSocketConnectionKey('session-1'), {
      close: closeA,
    });
    registry.track(buildDemoWebSocketConnectionKey('session-1'), {
      close: closeB,
    });

    const closedCount = registry.closeConnections(buildDemoWebSocketConnectionKey('session-1'));

    expect(closedCount).toBe(2);
    expect(closeA).toHaveBeenCalledWith(1012, 'manual reconnect test');
    expect(closeB).toHaveBeenCalledWith(1012, 'manual reconnect test');

    detachA();
    expect(registry.closeConnections(buildDemoWebSocketConnectionKey('session-1'))).toBe(1);
  });

  it('builds the websocket bridge base URL from PORT with a 3000 fallback', () => {
    expect(getDemoWebSocketBridgeBaseUrl()).toBe('http://127.0.0.1:3000');

    // eslint-disable-next-line turbo/no-undeclared-env-vars
    process.env.PORT = '4100';

    expect(getDemoWebSocketBridgeBaseUrl()).toBe('http://127.0.0.1:4100');
  });

  it('bootstraps a websocket connection through the canonical HTTP routes and polls for updates', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    globalThis.fetch = fetchMock;

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            demoId: 'websocket',
            conversationId: 'conversation-1',
            conversation: {
              id: 'conversation-1',
            },
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              type: 'message',
              payload: {
                id: 'assistant-1',
                conversationId: 'conversation-1',
                sender: {
                  id: 'assistant-1',
                  role: 'assistant',
                },
                timestamp: 1,
                status: 'sent',
                type: 'system',
                eventKind: 'custom',
                content: 'bootstrapped',
              },
              timestamp: 1,
            },
          ],
          nextCursor: 'cursor-1',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              type: 'typing',
              payload: {
                action: 'start',
                conversationId: 'conversation-1',
                participant: {
                  id: 'assistant-1',
                  role: 'assistant',
                },
              },
              timestamp: 2,
            },
          ],
          nextCursor: 'cursor-2',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const socket = new FakeManagedSocket();

    await handleDemoWebSocketConnection(socket, {
      url: '/demo-websocket?demoId=websocket&sessionId=session-1',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3000/api/demos/websocket/conversation?sessionId=session-1',
      {
        method: 'POST',
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:3000/api/demos/websocket/events?conversationId=conversation-1&sessionId=session-1',
      undefined,
    );
    expect(socket.sentPayloads).toEqual([
      [
        {
          type: 'message',
          payload: {
            id: 'assistant-1',
            conversationId: 'conversation-1',
            sender: {
              id: 'assistant-1',
              role: 'assistant',
            },
            timestamp: 1,
            status: 'sent',
            type: 'system',
            eventKind: 'custom',
            content: 'bootstrapped',
          },
          timestamp: 1,
        },
      ],
    ]);

    await vi.advanceTimersByTimeAsync(DEMO_WEBSOCKET_POLL_INTERVAL_MS);

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:3000/api/demos/websocket/events?conversationId=conversation-1&sessionId=session-1&cursor=cursor-1',
      undefined,
    );
    expect(socket.sentPayloads.at(-1)).toEqual([
      {
        type: 'typing',
        payload: {
          action: 'start',
          conversationId: 'conversation-1',
          participant: {
            id: 'assistant-1',
            role: 'assistant',
          },
        },
        timestamp: 2,
      },
    ]);
  });

  it('proxies websocket message frames through the canonical messages route', async () => {
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: { id: 'message-1' } }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );
    globalThis.fetch = fetchMock;

    await handleDemoWebSocketClientFrame(
      'session-1',
      'conversation-1',
      Buffer.from(
        JSON.stringify({
          type: 'message',
          payload: {
            conversationId: 'wrong-conversation',
            content: 'hello',
            metadata: {
              clientNonce: 'nonce-1',
            },
            type: 'text',
          },
        }),
      ) satisfies RawData,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/demos/websocket/messages?sessionId=session-1',
      {
        body: JSON.stringify({
          conversationId: 'conversation-1',
          message: 'hello',
          metadata: {
            clientNonce: 'nonce-1',
          },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('proxies websocket typing frames through the canonical typing route', async () => {
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );
    globalThis.fetch = fetchMock;

    await handleDemoWebSocketClientFrame(
      'session-1',
      'conversation-1',
      Buffer.from(
        JSON.stringify({
          type: 'typing',
          payload: {
            action: 'stop',
            conversationId: 'wrong-conversation',
          },
        }),
      ) satisfies RawData,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/demos/websocket/typing?sessionId=session-1',
      {
        body: JSON.stringify({
          action: 'stop',
          conversationId: 'conversation-1',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('stops polling after the websocket closes', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    globalThis.fetch = fetchMock;

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            demoId: 'websocket',
            conversationId: 'conversation-1',
            conversation: {
              id: 'conversation-1',
            },
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: [],
          nextCursor: 'cursor-1',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const socket = new FakeManagedSocket();

    await handleDemoWebSocketConnection(socket, {
      url: '/demo-websocket?demoId=websocket&sessionId=session-1',
    });

    socket.emitClose();
    await vi.advanceTimersByTimeAsync(DEMO_WEBSOCKET_POLL_INTERVAL_MS * 3);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

type ManagedSocketListenerMap = {
  close: Set<() => void>;
  error: Set<() => void>;
  message: Set<(data: RawData) => void>;
};

class FakeManagedSocket {
  readonly sentPayloads: unknown[] = [];
  readonly closeCalls: Array<{ code?: number; reason?: string }> = [];
  private readonly listeners: ManagedSocketListenerMap = {
    close: new Set(),
    error: new Set(),
    message: new Set(),
  };

  send(data: string): void {
    this.sentPayloads.push(JSON.parse(data));
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
  }

  on(event: 'close' | 'error', listener: () => void): void;
  on(event: 'message', listener: (data: RawData) => void): void;
  on(
    event: keyof ManagedSocketListenerMap,
    listener: (() => void) | ((data: RawData) => void),
  ): void {
    this.listeners[event].add(listener as never);
  }

  off(event: 'close' | 'error', listener: () => void): void;
  off(event: 'message', listener: (data: RawData) => void): void;
  off(
    event: keyof ManagedSocketListenerMap,
    listener: (() => void) | ((data: RawData) => void),
  ): void {
    this.listeners[event].delete(listener as never);
  }

  emitMessage(data: RawData): void {
    for (const listener of this.listeners.message) {
      listener(data);
    }
  }

  emitClose(): void {
    for (const listener of this.listeners.close) {
      listener();
    }
  }
}
