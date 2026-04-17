'use client';

import type { ChatSurfaceHistoryWindow } from '@/components/chat/ChatSurface';
import type { DemoQuickAction } from '@/lib/demo/contracts';
import type { JSX, ReactNode } from 'react';

import { useEffect, useState } from 'react';

import { ChatSurface } from '@/components/chat/ChatSurface';

import { DemoClearLocalStorageCta } from './DemoClearLocalStorageCta';
import { useDemoRuntime } from './DemoRuntimeProvider';
import { StreamEventBridge } from './StreamEventBridge';

interface SingleConversationDemoProps {
  readonly title: string;
  readonly description: string;
  readonly quickActions?: ReadonlyArray<DemoQuickAction>;
  readonly helperPanel?: ReactNode;
  readonly historyWindow?: ChatSurfaceHistoryWindow;
}

export function SingleConversationDemo({
  title,
  description,
  quickActions,
  helperPanel,
  historyWindow,
}: SingleConversationDemoProps): JSX.Element {
  const runtime = useDemoRuntime();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap(): Promise<void> {
      try {
        const bootstrap = await runtime.bootstrapConversation();
        if (!isMounted) {
          return;
        }

        runtime.setActiveConversationId(bootstrap.conversationId);
        setConversationId(bootstrap.conversationId);
      } catch (bootstrapError) {
        if (!isMounted) {
          return;
        }

        setError(
          bootstrapError instanceof Error
            ? bootstrapError.message
            : 'Unable to bootstrap the demo conversation.',
        );
      }
    }

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, [runtime]);

  if (error) {
    return (
      <section
        style={{
          borderRadius: 18,
          border: '1px solid #7f1d1d',
          background: '#450a0a',
          color: '#fecaca',
          padding: 20,
        }}
      >
        {error}
      </section>
    );
  }

  if (!conversationId) {
    return (
      <section
        style={{
          borderRadius: 18,
          border: '1px solid #1e293b',
          background: '#0f172a',
          color: '#cbd5e1',
          padding: 20,
        }}
      >
        Preparing the demo runtime…
      </section>
    );
  }

  return (
    <>
      {runtime.supportsStreamingBridge ? (
        <StreamEventBridge conversationId={conversationId} />
      ) : null}
      <DemoClearLocalStorageCta onClearError={setError} />
      <ChatSurface
        title={title}
        description={description}
        conversationId={conversationId}
        quickActions={quickActions}
        helperPanel={helperPanel}
        historyWindow={historyWindow}
      />
    </>
  );
}
