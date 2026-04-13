import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendTyping = vi.fn(async () => undefined);
const getDemoRuntime = vi.fn(() => ({
  isAvailable: () => ({
    available: true,
    missingEnv: [],
  }),
  sendTyping,
}));

vi.mock('@/lib/demo/server/runtime-registry', () => ({
  getDemoRuntime,
}));

describe('legacy chat typing route', () => {
  beforeEach(() => {
    getDemoRuntime.mockClear();
    sendTyping.mockClear();
  });

  it('rejects invalid request bodies', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost:3000/api/chat/typing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: 'conversation-1',
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it('delegates typing updates when the runtime is available', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost:3000/api/chat/typing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start',
          conversationId: 'conversation-1',
        }),
      }),
    );
    const json: unknown = await response.json();

    expect(sendTyping).toHaveBeenCalledWith('start', 'conversation-1');
    expect(json).toEqual({
      success: true,
    });
  });

  it('returns 503 when the runtime is unavailable', async () => {
    getDemoRuntime.mockReturnValueOnce({
      isAvailable: () => ({
        available: false,
        reason: 'DIT disabled',
        missingEnv: [],
      }),
      sendTyping,
    });

    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost:3000/api/chat/typing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'stop',
          conversationId: 'conversation-1',
        }),
      }),
    );
    const json: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(json).toEqual({
      success: false,
      error: 'DIT disabled',
    });
  });
});
