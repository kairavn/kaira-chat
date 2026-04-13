import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMessages = vi.fn(async () => []);
const sendMessage = vi.fn(async (_conversationId: string, message: string) => ({
  id: 'message-1',
  conversationId: 'conversation-1',
  sender: { id: 'self', role: 'user' },
  timestamp: 1,
  status: 'sent',
  type: 'text',
  content: message,
}));
const getDemoRuntime = vi.fn(() => ({
  isAvailable: () => ({
    available: true,
    missingEnv: [],
  }),
  getMessages,
  sendMessage,
}));

vi.mock('@/lib/demo/server/runtime-registry', () => ({
  getDemoRuntime,
}));

describe('legacy chat messages route', () => {
  beforeEach(() => {
    getMessages.mockClear();
    sendMessage.mockClear();
    getDemoRuntime.mockClear();
  });

  it('returns validation errors for missing conversation id and invalid request bodies', async () => {
    const { GET, POST } = await import('./route');

    const getResponse = await GET(new NextRequest('http://localhost:3000/api/chat/messages'));
    expect(getResponse.status).toBe(400);

    const postResponse = await POST(
      new Request('http://localhost:3000/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'hello',
        }),
      }),
    );
    expect(postResponse.status).toBe(400);
  });

  it('returns route data for GET and POST when the runtime is available', async () => {
    const { GET, POST } = await import('./route');

    const getResponse = await GET(
      new NextRequest('http://localhost:3000/api/chat/messages?conversationId=conversation-1'),
    );
    const getJson: unknown = await getResponse.json();

    expect(getMessages).toHaveBeenCalledWith('conversation-1');
    expect(getJson).toEqual({
      success: true,
      data: [],
    });

    const postResponse = await POST(
      new Request('http://localhost:3000/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: 'conversation-1',
          message: 'hello',
          metadata: {
            source: 'test',
          },
        }),
      }),
    );
    const postJson: unknown = await postResponse.json();

    expect(sendMessage).toHaveBeenCalledWith('conversation-1', 'hello', {
      source: 'test',
    });
    expect(postJson).toMatchObject({
      success: true,
      data: {
        id: 'message-1',
        content: 'hello',
      },
    });
  });

  it('returns 503 when the runtime is unavailable', async () => {
    getDemoRuntime.mockReturnValueOnce({
      isAvailable: () => ({
        available: false,
        reason: 'Missing DIT env',
        missingEnv: [],
      }),
      getMessages,
      sendMessage,
    });

    const { GET } = await import('./route');
    const response = await GET(
      new NextRequest('http://localhost:3000/api/chat/messages?conversationId=conversation-1'),
    );
    const json: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(json).toEqual({
      success: false,
      error: 'Missing DIT env',
    });
  });
});
