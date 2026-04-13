import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDemoRuntimeRequestContext = vi.fn(() => ({
  sessionId: 'session-1',
}));
const ensureConversation = vi.fn(async () => ({
  demoId: 'streaming',
  conversationId: 'conversation-1',
  conversation: {
    id: 'conversation-1',
    type: 'direct',
    participants: [],
    createdAt: 1,
    updatedAt: 1,
  },
}));
const getDemoRuntime = vi.fn(() => ({
  isAvailable: () => ({
    available: true,
    missingEnv: [],
  }),
  ensureConversation,
}));

vi.mock('@/lib/demo/server/runtime-registry', () => ({
  createDemoRuntimeRequestContext,
  getDemoRuntime,
  isDemoId: (value: string) => value === 'streaming',
}));

describe('demo conversation route', () => {
  beforeEach(() => {
    createDemoRuntimeRequestContext.mockClear();
    ensureConversation.mockClear();
    getDemoRuntime.mockClear();
  });

  it('enforces session context and returns a bootstrap payload', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/demos/streaming/conversation?sessionId=session-1',
      { method: 'POST' },
    );

    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({
        demoId: 'streaming',
      }),
    });
    const json: unknown = await response.json();

    expect(createDemoRuntimeRequestContext).toHaveBeenCalledWith('streaming', 'session-1');
    expect(ensureConversation).toHaveBeenCalledWith({
      sessionId: 'session-1',
    });
    expect(json).toMatchObject({
      success: true,
      data: {
        conversationId: 'conversation-1',
      },
    });
  });

  it('returns 400 when session context is invalid', async () => {
    createDemoRuntimeRequestContext.mockImplementationOnce(() => {
      throw new Error('Missing sessionId for demo streaming.');
    });

    const request = new NextRequest('http://localhost:3000/api/demos/streaming/conversation', {
      method: 'POST',
    });

    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({
        demoId: 'streaming',
      }),
    });
    const json: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({
      success: false,
      error: 'Missing sessionId for demo streaming.',
    });
  });

  it('returns 503 when the demo is unavailable', async () => {
    getDemoRuntime.mockReturnValueOnce({
      isAvailable: () => ({
        available: false,
        reason: 'Demo unavailable.',
        missingEnv: [],
      }),
      ensureConversation,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/demos/streaming/conversation?sessionId=session-1',
      { method: 'POST' },
    );

    const { POST } = await import('./route');
    const response = await POST(request, {
      params: Promise.resolve({
        demoId: 'streaming',
      }),
    });
    const json: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(json).toEqual({
      success: false,
      error: 'Demo unavailable.',
    });
  });
});
