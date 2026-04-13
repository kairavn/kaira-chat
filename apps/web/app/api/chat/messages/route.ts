import type { MessageMetadata } from '@kaira/chat-core';

import { NextRequest, NextResponse } from 'next/server';

import { getDemoRuntime } from '@/lib/demo/server/runtime-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SendMessageBody {
  readonly conversationId: string;
  readonly message: string;
  readonly metadata?: MessageMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSendMessageBody(value: unknown): value is SendMessageBody {
  if (!isRecord(value)) {
    return false;
  }

  const metadata = value['metadata'];
  const hasValidMetadata =
    metadata === undefined || (typeof metadata === 'object' && metadata !== null);
  return (
    typeof value['conversationId'] === 'string' &&
    typeof value['message'] === 'string' &&
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

    const runtime = getDemoRuntime('dit-modive');
    const availability = runtime.isAvailable();
    if (!availability.available) {
      return NextResponse.json(
        {
          success: false,
          error: availability.reason ?? 'Demo unavailable.',
        },
        { status: 503 },
      );
    }

    const messages = await runtime.getMessages(conversationId);
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
    const json: unknown = await request.json();
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

    const runtime = getDemoRuntime('dit-modive');
    const availability = runtime.isAvailable();
    if (!availability.available) {
      return NextResponse.json(
        {
          success: false,
          error: availability.reason ?? 'Demo unavailable.',
        },
        { status: 503 },
      );
    }

    const message = await runtime.sendMessage(json.conversationId, text, json.metadata);
    return NextResponse.json({
      success: true,
      data: message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
