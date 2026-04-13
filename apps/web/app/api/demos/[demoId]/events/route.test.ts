import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDemoSseResponse = vi.fn(
  async () =>
    new Response('stream', {
      headers: {
        'Content-Type': 'text/event-stream',
      },
    }),
);
const getDemoPollingResponse = vi.fn(async () => ({
  success: true,
  data: [],
  nextCursor: '7',
}));
const createDemoRuntimeRequestContext = vi.fn(() => ({
  sessionId: 'session-1',
}));
const getDemoRuntime = vi.fn(() => ({
  isAvailable: () => ({
    available: true,
    missingEnv: [],
  }),
}));

vi.mock('@/lib/demo/server/runtime-registry', () => ({
  createDemoRuntimeRequestContext,
  createDemoSseResponse,
  getDemoPollingResponse,
  getDemoRuntime,
  isDemoId: (value: string) => value === 'streaming',
}));

describe('demo events route', () => {
  beforeEach(() => {
    createDemoRuntimeRequestContext.mockClear();
    createDemoSseResponse.mockClear();
    getDemoPollingResponse.mockClear();
    getDemoRuntime.mockClear();
  });

  it('returns a polling response for a known demo id', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/demos/streaming/events?conversationId=conversation-1&sessionId=session-1',
    );

    const { GET } = await import('./route');
    const response = await GET(request, {
      params: Promise.resolve({
        demoId: 'streaming',
      }),
    });
    const json: unknown = await response.json();

    expect(getDemoRuntime).toHaveBeenCalledWith('streaming');
    expect(createDemoRuntimeRequestContext).toHaveBeenCalledWith('streaming', 'session-1');
    expect(getDemoPollingResponse).toHaveBeenCalledWith('streaming', 'conversation-1', null, {
      sessionId: 'session-1',
    });
    expect(json).toMatchObject({
      success: true,
      nextCursor: '7',
    });
  });

  it('returns 404 for an unknown demo id', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/demos/unknown/events?conversationId=conversation-1',
    );

    const { GET } = await import('./route');
    const response = await GET(request, {
      params: Promise.resolve({
        demoId: 'unknown',
      }),
    });

    expect(response.status).toBe(404);
  });

  it('uses the SSE helper when text/event-stream is requested', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/demos/streaming/events?conversationId=conversation-1&sessionId=session-1',
      {
        headers: {
          accept: 'text/event-stream',
        },
      },
    );

    const { GET } = await import('./route');
    const response = await GET(request, {
      params: Promise.resolve({
        demoId: 'streaming',
      }),
    });

    expect(createDemoSseResponse).toHaveBeenCalled();
    expect(createDemoSseResponse).toHaveBeenCalledWith(request, 'streaming', 'conversation-1', {
      sessionId: 'session-1',
    });
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('returns a server error when polling fails', async () => {
    getDemoPollingResponse.mockRejectedValueOnce(new Error('poll failed'));

    const request = new NextRequest(
      'http://localhost:3000/api/demos/streaming/events?conversationId=conversation-1&sessionId=session-1',
    );

    const { GET } = await import('./route');
    const response = await GET(request, {
      params: Promise.resolve({
        demoId: 'streaming',
      }),
    });
    const json: unknown = await response.json();

    expect(response.status).toBe(500);
    expect(json).toMatchObject({
      success: false,
      error: 'poll failed',
    });
  });
});
