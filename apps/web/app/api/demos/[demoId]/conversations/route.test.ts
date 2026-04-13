import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDemoRuntimeRequestContext = vi.fn(() => ({
  sessionId: 'session-1',
}));
const listConversations = vi.fn(async () => [
  {
    id: 'conversation-1',
    type: 'direct',
    participants: [],
    createdAt: 1,
    updatedAt: 1,
  },
]);
const getDemoRuntime = vi.fn(() => ({
  isAvailable: () => ({
    available: true,
    missingEnv: [],
  }),
  listConversations,
}));

vi.mock('@/lib/demo/server/runtime-registry', () => ({
  createDemoRuntimeRequestContext,
  getDemoRuntime,
  isDemoId: (value: string) => value === 'streaming',
}));

describe('demo conversations route', () => {
  beforeEach(() => {
    createDemoRuntimeRequestContext.mockClear();
    listConversations.mockClear();
    getDemoRuntime.mockClear();
  });

  it('lists conversations for a valid demo session', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/demos/streaming/conversations?sessionId=session-1',
      ),
      {
        params: Promise.resolve({
          demoId: 'streaming',
        }),
      },
    );
    const json: unknown = await response.json();

    expect(listConversations).toHaveBeenCalledWith({
      sessionId: 'session-1',
    });
    expect(json).toEqual({
      success: true,
      data: [
        {
          id: 'conversation-1',
          type: 'direct',
          participants: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
  });

  it('returns 400 when local demo session context is missing', async () => {
    createDemoRuntimeRequestContext.mockImplementationOnce(() => {
      throw new Error('Missing sessionId for demo streaming.');
    });

    const { GET } = await import('./route');
    const response = await GET(
      new NextRequest('http://localhost:3000/api/demos/streaming/conversations'),
      {
        params: Promise.resolve({
          demoId: 'streaming',
        }),
      },
    );

    expect(response.status).toBe(400);
  });
});
