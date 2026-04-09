import { NextResponse } from 'next/server';

import { notifyChatTyping, stopChatTyping } from '@/lib/chat/server-chat-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TypingBody {
  readonly action: 'start' | 'stop';
  readonly conversationId: string;
}

function isTypingBody(value: unknown): value is TypingBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'action' in value &&
    (value.action === 'start' || value.action === 'stop') &&
    'conversationId' in value &&
    typeof value.conversationId === 'string'
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const json: unknown = await request.json();
    if (!isTypingBody(json)) {
      return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    if (json.action === 'start') {
      await notifyChatTyping(json.conversationId);
    } else {
      await stopChatTyping(json.conversationId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
