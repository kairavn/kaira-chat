import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDemoRuntimeRequestContext = vi.fn(() => ({
  sessionId: 'session-1',
}));
const sendTyping = vi.fn(async () => undefined);
const getDemoRuntime = vi.fn(() => ({
  isAvailable: () => ({
    available: true,
    missingEnv: [],
  }),
  sendTyping,
}));

vi.mock('@/lib/demo/server/runtime-registry', () => ({
  createDemoRuntimeRequestContext,
  getDemoRuntime,
  isDemoId: (value: string) => value === 'streaming',
}));

describe('demo typing route', () => {
  beforeEach(() => {
    createDemoRuntimeRequestContext.mockClear();
    sendTyping.mockClear();
    getDemoRuntime.mockClear();
  });

  it('validates request bodies and delegates typing updates', async () => {
    const { POST } = await import('./route');

    const invalidResponse = await POST(
      new NextRequest('http://localhost:3000/api/demos/streaming/typing?sessionId=session-1', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'conversation-1',
        }),
      }),
      {
        params: Promise.resolve({
          demoId: 'streaming',
        }),
      },
    );
    expect(invalidResponse.status).toBe(400);

    const validResponse = await POST(
      new NextRequest('http://localhost:3000/api/demos/streaming/typing?sessionId=session-1', {
        method: 'POST',
        body: JSON.stringify({
          action: 'start',
          conversationId: 'conversation-1',
        }),
      }),
      {
        params: Promise.resolve({
          demoId: 'streaming',
        }),
      },
    );
    const json: unknown = await validResponse.json();

    expect(sendTyping).toHaveBeenCalledWith('start', 'conversation-1', {
      sessionId: 'session-1',
    });
    expect(json).toEqual({
      success: true,
    });
  });

  it('returns 400 when the local demo session is missing', async () => {
    createDemoRuntimeRequestContext.mockImplementationOnce(() => {
      throw new Error('Missing sessionId for demo streaming.');
    });

    const { POST } = await import('./route');
    const response = await POST(
      new NextRequest('http://localhost:3000/api/demos/streaming/typing', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stop',
          conversationId: 'conversation-1',
        }),
      }),
      {
        params: Promise.resolve({
          demoId: 'streaming',
        }),
      },
    );
    const json: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({
      success: false,
      error: 'Missing sessionId for demo streaming.',
    });
  });
});
