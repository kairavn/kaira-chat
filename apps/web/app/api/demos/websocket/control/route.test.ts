import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const closeDemoWebSocketConnections = vi.fn(() => 1);
const createDemoRuntimeRequestContext = vi.fn(() => ({
  sessionId: 'session-1',
}));

vi.mock('@/lib/demo/server/demo-websocket-server', () => ({
  closeDemoWebSocketConnections,
}));

vi.mock('@/lib/demo/server/runtime-registry', () => ({
  createDemoRuntimeRequestContext,
}));

describe('websocket demo control route', () => {
  beforeEach(() => {
    closeDemoWebSocketConnections.mockClear();
    createDemoRuntimeRequestContext.mockClear();
  });

  it('returns 400 when the body action is invalid', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/demos/websocket/control?sessionId=session-1',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'not-a-valid-action' }),
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const { POST } = await import('./route');
    const response = await POST(request);
    const json: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(json).toMatchObject({ success: false });
  });

  it('returns 400 when the sessionId query param is missing', async () => {
    createDemoRuntimeRequestContext.mockImplementationOnce(() => {
      throw new Error('Missing sessionId for demo websocket.');
    });

    const request = new NextRequest('http://localhost:3000/api/demos/websocket/control', {
      method: 'POST',
      body: JSON.stringify({ action: 'drop-connections' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const { POST } = await import('./route');
    const response = await POST(request);
    const json: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(json).toMatchObject({
      success: false,
      error: 'Missing sessionId for demo websocket.',
    });
  });

  it('drops tracked websocket connections for the requested session', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/demos/websocket/control?sessionId=session-1',
      {
        method: 'POST',
        body: JSON.stringify({
          action: 'drop-connections',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const { POST } = await import('./route');
    const response = await POST(request);
    const json: unknown = await response.json();

    expect(createDemoRuntimeRequestContext).toHaveBeenCalledWith('websocket', 'session-1');
    expect(closeDemoWebSocketConnections).toHaveBeenCalledWith('session-1');
    expect(json).toEqual({
      success: true,
      data: {
        action: 'drop-connections',
        closedConnections: 1,
      },
    });
  });
});
