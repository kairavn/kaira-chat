import type { DemoTypingBody } from '@/lib/demo/contracts';

import { NextRequest, NextResponse } from 'next/server';

import {
  createDemoRuntimeRequestContext,
  getDemoRuntime,
  isDemoId,
} from '@/lib/demo/server/runtime-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DemoRouteContext {
  readonly params: Promise<{
    readonly demoId: string;
  }>;
}

function isTypingBody(value: unknown): value is DemoTypingBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'action' in value &&
    (value.action === 'start' || value.action === 'stop') &&
    'conversationId' in value &&
    typeof value.conversationId === 'string'
  );
}

export async function POST(request: NextRequest, context: DemoRouteContext): Promise<NextResponse> {
  const { demoId } = await context.params;
  if (!isDemoId(demoId)) {
    return NextResponse.json({ success: false, error: 'Unknown demo id.' }, { status: 404 });
  }

  try {
    const requestContext = createDemoRuntimeRequestContext(
      demoId,
      request.nextUrl.searchParams.get('sessionId'),
    );
    const json: unknown = await request.json();
    if (!isTypingBody(json)) {
      return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const runtime = getDemoRuntime(demoId);
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

    await runtime.sendTyping(json.action, json.conversationId, requestContext);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    const status = message.startsWith('Missing sessionId') ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
