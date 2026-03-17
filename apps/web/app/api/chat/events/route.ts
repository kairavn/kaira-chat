import type { ChatEngine, ChatEvent } from '@kaira/chat-core';

import { NextRequest, NextResponse } from 'next/server';

import { subscribeChatEvents } from '@/lib/chat/event-broker';
import { getServerChatEngineContext } from '@/lib/chat/server-chat-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const CHAT_HISTORY_LIMIT = 2000;

function eventMatchesConversation(event: ChatEvent, conversationId: string): boolean {
  if ('message' in event && typeof event.message === 'object' && event.message !== null) {
    const messageWithConversation = event.message as { conversationId?: unknown };
    return messageWithConversation.conversationId === conversationId;
  }
  if ('conversationId' in event) {
    return event.conversationId === conversationId;
  }
  return false;
}

/**
 * GET /api/chat/events?conversationId=...
 *
 * When Accept includes text/event-stream, returns an SSE stream.
 * Otherwise returns a JSON array of buffered messages (polling mode).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const conversationId = request.nextUrl.searchParams.get('conversationId');
  if (!conversationId) {
    return new Response('Missing conversationId', { status: 400 });
  }

  const { engine } = await getServerChatEngineContext();

  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/event-stream')) {
    return handleSSE(request, conversationId);
  }

  return handlePolling(engine, conversationId);
}

async function handlePolling(engine: ChatEngine, conversationId: string): Promise<NextResponse> {
  try {
    const page = await engine.getMessages({
      conversationId,
      direction: 'asc',
      limit: CHAT_HISTORY_LIMIT,
    });
    const data = page.items.map((msg) => msg as unknown as Record<string, unknown>);
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}

function handleSSE(request: NextRequest, conversationId: string): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (eventName: string, payload: unknown): void => {
        controller.enqueue(encoder.encode(`event: ${eventName}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      write('connected', { ok: true, conversationId });

      const unsubscribe = subscribeChatEvents((event) => {
        if (!eventMatchesConversation(event, conversationId)) {
          return;
        }
        write(event.type, event);
      });

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(': keepalive\n\n'));
      }, 15000);

      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
