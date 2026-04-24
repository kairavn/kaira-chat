import type { DemoMessagePageQuery, DemoSendMessageBody } from '@/lib/demo/contracts';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSendMessageBody(value: unknown): value is DemoSendMessageBody {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value['conversationId'] === 'string' &&
    typeof value['message'] === 'string' &&
    (value['metadata'] === undefined ||
      (typeof value['metadata'] === 'object' && value['metadata'] !== null))
  );
}

function parseMessagePageQuery(searchParams: URLSearchParams): DemoMessagePageQuery | null {
  const limitValue = searchParams.get('limit');
  if (limitValue === null) {
    return null;
  }

  const limit = Number(limitValue);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('limit must be a positive integer.');
  }

  const direction = searchParams.get('direction');
  if (direction !== 'before' && direction !== 'after') {
    throw new Error('direction must be "before" or "after" when limit is provided.');
  }

  const cursor = searchParams.get('cursor');
  return {
    direction,
    limit,
    ...(cursor ? { cursor } : {}),
  };
}

export async function GET(request: NextRequest, context: DemoRouteContext): Promise<NextResponse> {
  const { demoId } = await context.params;
  if (!isDemoId(demoId)) {
    return NextResponse.json({ success: false, error: 'Unknown demo id.' }, { status: 404 });
  }

  let requestContext: ReturnType<typeof createDemoRuntimeRequestContext>;
  try {
    requestContext = createDemoRuntimeRequestContext(
      demoId,
      request.nextUrl.searchParams.get('sessionId'),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid demo session context.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  const conversationId = request.nextUrl.searchParams.get('conversationId');
  if (!conversationId) {
    return NextResponse.json({ success: false, error: 'Missing conversationId.' }, { status: 400 });
  }

  try {
    const pageQuery = parseMessagePageQuery(request.nextUrl.searchParams);
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

    return NextResponse.json({
      success: true,
      data: pageQuery
        ? await runtime.getMessagesPage(conversationId, pageQuery, requestContext)
        : await runtime.getMessages(conversationId, requestContext),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    const status = message.includes('limit must') || message.includes('direction must') ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
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

    return NextResponse.json({
      success: true,
      data: await runtime.sendMessage(json.conversationId, text, json.metadata, requestContext),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    const status = message.startsWith('Missing sessionId') ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
