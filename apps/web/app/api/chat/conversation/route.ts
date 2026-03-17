import { NextResponse } from 'next/server';

import {
  ensureDemoConversationCreated,
  getServerChatEngineContext,
} from '@/lib/chat/server-chat-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  try {
    await ensureDemoConversationCreated();
    const context = await getServerChatEngineContext();
    return NextResponse.json({
      success: true,
      conversationId: context.conversationId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
