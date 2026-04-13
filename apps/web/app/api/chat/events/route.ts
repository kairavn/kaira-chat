import { NextRequest, NextResponse } from 'next/server';

import { createDemoSseResponse, getDemoPollingResponse } from '@/lib/demo/server/runtime-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/event-stream')) {
    return createDemoSseResponse(request, 'dit-modive', conversationId);
  }

  try {
    return NextResponse.json(
      await getDemoPollingResponse(
        'dit-modive',
        conversationId,
        request.nextUrl.searchParams.get('cursor'),
      ),
    );
  } catch {
    const cursor = request.nextUrl.searchParams.get('cursor');
    return NextResponse.json({
      success: true,
      data: [],
      ...(cursor ? { nextCursor: cursor } : {}),
    });
  }
}
