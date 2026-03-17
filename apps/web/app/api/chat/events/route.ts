import type { ChatEngine, ChatEvent } from '@kaira/chat-core';

import { NextRequest, NextResponse } from 'next/server';

import { subscribeChatEvents } from '@/lib/chat/event-broker';
import { getServerChatEngineContext } from '@/lib/chat/server-chat-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHAT_POLL_LIMIT = 200;

function eventConversationId(event: ChatEvent): string | undefined {
  if ('conversationId' in event && typeof event.conversationId === 'string') {
    return event.conversationId;
  }

  if ('message' in event && typeof event.message.conversationId === 'string') {
    return event.message.conversationId;
  }

  return undefined;
}

function eventMatchesConversation(event: ChatEvent, conversationId: string): boolean {
  return eventConversationId(event) === conversationId;
}

/**
 * GET /api/chat/events?conversationId=...&cursor=...
 *
 * When Accept includes text/event-stream, returns an SSE stream.
 * Otherwise returns a JSON array of incremental messages (polling mode).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const conversationId = request.nextUrl.searchParams.get('conversationId');
  if (!conversationId) {
    return new Response('Missing conversationId', { status: 400 });
  }

  const { engine } = await getServerChatEngineContext();
  const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;

  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/event-stream')) {
    return handleSSE(request, conversationId);
  }

  return handlePolling(engine, conversationId, cursor);
}

async function handlePolling(
  engine: ChatEngine,
  conversationId: string,
  cursor: string | undefined,
): Promise<NextResponse> {
  try {
    const isBootstrapRequest = cursor === undefined;
    const page = await engine.getMessages({
      conversationId,
      cursor,
      direction: isBootstrapRequest ? 'desc' : 'asc',
      limit: CHAT_POLL_LIMIT,
    });
    const items = isBootstrapRequest ? [...page.items].reverse() : page.items;
    const nextCursor = items.at(-1)?.id ?? cursor;

    return NextResponse.json({
      success: true,
      data: items,
      ...(nextCursor !== undefined ? { nextCursor } : {}),
    });
  } catch {
    return NextResponse.json({
      success: true,
      data: [],
      ...(cursor !== undefined ? { nextCursor: cursor } : {}),
    });
  }
}

function handleSSE(request: NextRequest, conversationId: string): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false;

      const write = (eventName: string, payload: unknown): void => {
        controller.enqueue(encoder.encode(`event: ${eventName}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const cleanup = (
        unsubscribe: () => void,
        keepAlive: ReturnType<typeof setInterval>,
      ): void => {
        if (isClosed) {
          return;
        }

        isClosed = true;
        clearInterval(keepAlive);
        unsubscribe();
        request.signal.removeEventListener('abort', abortHandler);
        controller.close();
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

      const abortHandler = (): void => {
        cleanup(unsubscribe, keepAlive);
      };

      request.signal.addEventListener('abort', abortHandler);
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
