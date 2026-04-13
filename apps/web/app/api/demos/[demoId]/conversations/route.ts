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

  try {
    return NextResponse.json({
      success: true,
      data: await runtime.listConversations(requestContext),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
