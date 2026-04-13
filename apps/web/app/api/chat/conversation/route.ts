import { NextResponse } from 'next/server';

import { getDemoRuntime } from '@/lib/demo/server/runtime-registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
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

  try {
    const bootstrap = await runtime.ensureConversation();
    return NextResponse.json({
      success: true,
      conversationId: bootstrap.conversationId,
      data: bootstrap,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
