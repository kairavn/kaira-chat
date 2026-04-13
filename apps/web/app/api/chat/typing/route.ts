import { NextResponse } from 'next/server';

import { getDemoRuntime } from '@/lib/demo/server/runtime-registry';

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

    await runtime.sendTyping(json.action, json.conversationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
