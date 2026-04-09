import type {
  ChatEngine,
  ChatEvent,
  TransportEvent,
  TypingParticipantState,
} from '@kaira/chat-core';

import { NextRequest, NextResponse } from 'next/server';

import {
  getChatEventsAfterSequence,
  getLatestChatEventSequence,
  subscribeChatEvents,
} from '@/lib/chat/event-broker';
import { getServerChatEngineContext } from '@/lib/chat/server-chat-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHAT_POLL_LIMIT = 200;

interface PollEventsResponse {
  readonly success: boolean;
  readonly data: ReadonlyArray<TransportEvent<'message' | 'typing'>>;
  readonly nextCursor?: string;
}

function parseSequence(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

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

function toTypingTransportEvent(
  participantState: TypingParticipantState,
): TransportEvent<'typing'> {
  return {
    type: 'typing',
    payload: {
      action: 'start',
      conversationId: participantState.conversationId,
      participant: participantState.participant,
    },
    timestamp: participantState.lastUpdatedAt,
  };
}

function isMessageReceivedEvent(event: ChatEvent): event is ChatEvent<'message:received'> {
  return event.type === 'message:received';
}

function isTypingStartEvent(event: ChatEvent): event is ChatEvent<'typing:start'> {
  return event.type === 'typing:start';
}

function isTypingStopEvent(event: ChatEvent): event is ChatEvent<'typing:stop'> {
  return event.type === 'typing:stop';
}

function toTransportEvent(event: ChatEvent): TransportEvent<'message' | 'typing'> | undefined {
  if (isMessageReceivedEvent(event)) {
    return {
      type: 'message',
      payload: event.message,
      timestamp: event.timestamp,
    };
  }

  if (isTypingStartEvent(event)) {
    return {
      type: 'typing',
      payload: {
        action: 'start',
        conversationId: event.conversationId,
        participant: event.participant,
      },
      timestamp: event.timestamp,
    };
  }

  if (isTypingStopEvent(event)) {
    return {
      type: 'typing',
      payload: {
        action: 'stop',
        conversationId: event.conversationId,
        participant: event.participant,
      },
      timestamp: event.timestamp,
    };
  }

  return undefined;
}

/**
 * GET /api/chat/events?conversationId=...&cursor=...
 *
 * When Accept includes text/event-stream, returns an SSE stream.
 * Otherwise returns message and typing transport events for polling mode.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const conversationId = request.nextUrl.searchParams.get('conversationId');
  if (!conversationId) {
    return new Response('Missing conversationId', { status: 400 });
  }

  const cursor = parseSequence(request.nextUrl.searchParams.get('cursor'));
  const { engine } = await getServerChatEngineContext();

  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/event-stream')) {
    return handleSSE(request, conversationId);
  }

  return handlePolling(engine, conversationId, cursor);
}

async function handlePolling(
  engine: ChatEngine,
  conversationId: string,
  cursor: number | undefined,
): Promise<NextResponse<PollEventsResponse>> {
  const isBootstrapRequest = cursor === undefined;

  try {
    if (isBootstrapRequest) {
      const latestSequence = getLatestChatEventSequence();
      const page = await engine.getMessages({
        conversationId,
        direction: 'desc',
        limit: CHAT_POLL_LIMIT,
      });
      const historicalMessages = [...page.items].reverse().map((message) => ({
        type: 'message',
        payload: message,
        timestamp: message.timestamp,
      })) satisfies ReadonlyArray<TransportEvent<'message'>>;
      const typingEvents = engine
        .getTypingState(conversationId)
        .participants.map((participantState) => toTypingTransportEvent(participantState));

      return NextResponse.json({
        success: true,
        data: [...historicalMessages, ...typingEvents],
        nextCursor: String(latestSequence ?? 0),
      });
    }

    const sequencedEvents = getChatEventsAfterSequence(cursor, conversationId);
    const events = sequencedEvents
      .map((entry) => toTransportEvent(entry.event))
      .filter((event): event is TransportEvent<'message' | 'typing'> => event !== undefined);
    const nextCursor = sequencedEvents.at(-1)?.sequence ?? cursor;

    return NextResponse.json({
      success: true,
      data: events,
      ...(nextCursor !== undefined ? { nextCursor: String(nextCursor) } : {}),
    });
  } catch {
    return NextResponse.json({
      success: true,
      data: [],
      ...(cursor !== undefined ? { nextCursor: String(cursor) } : {}),
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

      const unsubscribe = subscribeChatEvents((entry) => {
        if (!eventMatchesConversation(entry.event, conversationId)) {
          return;
        }

        write(entry.event.type, entry.event);
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
