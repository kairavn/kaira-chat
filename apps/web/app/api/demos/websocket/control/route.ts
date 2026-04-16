import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { closeDemoWebSocketConnections } from '@/lib/demo/server/demo-websocket-server';
import { createDemoRuntimeRequestContext } from '@/lib/demo/server/runtime-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const demoWebSocketControlSchema = z.object({
  action: z.literal('drop-connections'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const requestContext = createDemoRuntimeRequestContext(
      'websocket',
      request.nextUrl.searchParams.get('sessionId'),
    );
    const body = demoWebSocketControlSchema.parse(await request.json());
    const sessionId = requestContext.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing sessionId for demo websocket.' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        action: body.action,
        closedConnections: closeDemoWebSocketConnections(sessionId),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid control request.';
    const status =
      message.startsWith('Missing sessionId') ||
      error instanceof SyntaxError ||
      error instanceof z.ZodError
        ? 400
        : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
