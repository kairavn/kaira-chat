import type { RawData } from 'ws';

import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';

import {
  buildDemoWebSocketConnectionKey,
  createDemoWebSocketConnectionRegistry,
  parseDemoWebSocketConnection,
  parseDemoWebSocketFrame,
} from './demo-websocket-server';

describe('demo websocket server helpers', () => {
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
});
