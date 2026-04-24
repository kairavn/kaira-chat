import type { Message } from '@kaira/chat-core';

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDemoRuntimeRequestContext = vi.fn(() => ({
  sessionId: 'session-1',
}));
const getMessages = vi.fn(async () => []);
const getMessagesPage = vi.fn(
  async (): Promise<{
    readonly items: Message[];
    readonly hasMore: boolean;
    readonly nextCursor?: string;
  }> => ({
    items: [],
    hasMore: false,
  }),
);
const sendMessage = vi.fn(async (_conversationId: string, text: string) => ({
  id: 'message-1',
  conversationId: 'conversation-1',
  sender: { id: 'self', role: 'user' },
  timestamp: 1,
  status: 'sent',
  type: 'text',
  content: text,
}));
const getDemoRuntime = vi.fn(() => ({
  isAvailable: () => ({
    available: true,
    missingEnv: [],
  }),
  getMessages,
  getMessagesPage,
  sendMessage,
}));

vi.mock('@/lib/demo/server/runtime-registry', () => ({
  createDemoRuntimeRequestContext,
  getDemoRuntime,
  isDemoId: (value: string) => value === 'streaming',
}));

describe('demo messages route', () => {
  beforeEach(() => {
    createDemoRuntimeRequestContext.mockClear();
    getMessages.mockClear();
    getMessagesPage.mockClear();
    sendMessage.mockClear();
    getDemoRuntime.mockClear();
  });

  it('validates GET and POST inputs before delegating', async () => {
    const { GET, POST } = await import('./route');

    const getResponse = await GET(
      new NextRequest('http://localhost:3000/api/demos/streaming/messages?sessionId=session-1'),
      {
        params: Promise.resolve({
          demoId: 'streaming',
        }),
      },
    );
    expect(getResponse.status).toBe(400);

    const postResponse = await POST(
      new NextRequest('http://localhost:3000/api/demos/streaming/messages?sessionId=session-1', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'conversation-1',
          message: '   ',
        }),
      }),
      {
        params: Promise.resolve({
          demoId: 'streaming',
        }),
      },
    );
    expect(postResponse.status).toBe(400);
  });

  it('returns messages and delegates sends for valid local demo requests', async () => {
    const { GET, POST } = await import('./route');

    const getResponse = await GET(
      new NextRequest(
        'http://localhost:3000/api/demos/streaming/messages?conversationId=conversation-1&sessionId=session-1',
      ),
      {
        params: Promise.resolve({
          demoId: 'streaming',
        }),
      },
    );
    const getJson: unknown = await getResponse.json();

    expect(getMessages).toHaveBeenCalledWith('conversation-1', {
      sessionId: 'session-1',
    });
    expect(getJson).toEqual({
      success: true,
      data: [],
    });
    expect(getMessagesPage).not.toHaveBeenCalled();

    const postResponse = await POST(
      new NextRequest('http://localhost:3000/api/demos/streaming/messages?sessionId=session-1', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'conversation-1',
          message: 'hello',
          metadata: {
            demoAction: 'streaming:normal',
          },
        }),
      }),
      {
        params: Promise.resolve({
          demoId: 'streaming',
        }),
      },
    );
    const postJson: unknown = await postResponse.json();

    expect(sendMessage).toHaveBeenCalledWith(
      'conversation-1',
      'hello',
      {
        demoAction: 'streaming:normal',
      },
      {
        sessionId: 'session-1',
      },
    );
    expect(postJson).toMatchObject({
      success: true,
      data: {
        id: 'message-1',
        content: 'hello',
      },
    });
  });

  it('returns paged messages when a limit is provided', async () => {
    getMessagesPage.mockResolvedValueOnce({
      items: [
        {
          id: 'older-1',
          conversationId: 'conversation-1',
          sender: { id: 'assistant', role: 'assistant' },
          timestamp: 1,
          status: 'sent',
          type: 'text',
          content: 'older',
        },
      ],
      hasMore: true,
      nextCursor: 'older-1',
    });

    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/demos/streaming/messages?conversationId=conversation-1&sessionId=session-1&direction=before&cursor=message-9&limit=8',
      ),
      {
        params: Promise.resolve({
          demoId: 'streaming',
        }),
      },
    );
    const json: unknown = await response.json();

    expect(getMessages).not.toHaveBeenCalled();
    expect(getMessagesPage).toHaveBeenCalledWith(
      'conversation-1',
      {
        direction: 'before',
        cursor: 'message-9',
        limit: 8,
      },
      {
        sessionId: 'session-1',
      },
    );
    expect(json).toMatchObject({
      success: true,
      data: {
        hasMore: true,
        nextCursor: 'older-1',
      },
    });
  });

  it('returns 400 when session context creation fails', async () => {
    createDemoRuntimeRequestContext.mockImplementationOnce(() => {
      throw new Error('Missing sessionId for demo streaming.');
    });

    const { POST } = await import('./route');
    const response = await POST(
      new NextRequest('http://localhost:3000/api/demos/streaming/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'conversation-1',
          message: 'hello',
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
