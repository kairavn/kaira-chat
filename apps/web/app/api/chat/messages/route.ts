import type { MessageMetadata } from '@kaira/chat-core';

import { NextRequest, NextResponse } from 'next/server';

import { getChatMessages, sendChatMessage } from '@/lib/chat/server-chat-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SendMessageBody {
  readonly conversationId: string;
  readonly message: string;
  readonly metadata?: MessageMetadata;
}

function isSendMessageBody(value: unknown): value is SendMessageBody {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const body = value as Record<string, unknown>;
  const metadata = body['metadata'];
  const hasValidMetadata =
    metadata === undefined || (typeof metadata === 'object' && metadata !== null);
  return (
    typeof body['conversationId'] === 'string' &&
    typeof body['message'] === 'string' &&
    hasValidMetadata
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const conversationId = request.nextUrl.searchParams.get('conversationId');
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'Missing conversationId.' },
        { status: 400 },
      );
    }

    const messages = await getChatMessages(conversationId);
    return NextResponse.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const json = (await request.json()) as unknown;
    if (!isSendMessageBody(json)) {
      return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const text = json.message.trim();
    if (!text) {
      return NextResponse.json(
        { success: false, error: 'Message must not be empty.' },
        { status: 400 },
      );
    }

    const message = await sendChatMessage(json.conversationId, text, json.metadata);
    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
