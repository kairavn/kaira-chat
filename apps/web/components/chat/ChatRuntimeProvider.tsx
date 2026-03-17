'use client';

import type { JSX, ReactNode } from 'react';

import dynamic from 'next/dynamic';
import { useState } from 'react';

import { ChatProvider } from '@kaira/chat-react';

import { getChatEngine } from '@/lib/chat/engine';

const ChatDevTools = dynamic(async () => (await import('@kaira/chat-devtools')).ChatDevTools, {
  ssr: false,
});

interface ChatRuntimeProviderProps {
  readonly children: ReactNode;
}

/**
 * Binds ChatEngine lifecycle to app mount/unmount and provides it to React.
 * Surfaces connection errors to consumers.
 */
export function ChatRuntimeProvider({ children }: ChatRuntimeProviderProps): JSX.Element {
  const engine = getChatEngine();
  const [connectError, setConnectError] = useState<string | null>(null);

  return (
    <ChatProvider
      engine={engine}
      autoConnect
      onConnectError={(error) => {
        setConnectError(error.message);
      }}
    >
      {connectError ? (
        <div
          style={{
            borderRadius: 10,
            border: '1px solid #7f1d1d',
            background: '#450a0a',
            color: '#fecaca',
            padding: '10px 12px',
            margin: '16px auto',
            maxWidth: 900,
          }}
        >
          Connection error: {connectError}
        </div>
      ) : null}
      {children}
      {process.env.NODE_ENV !== 'production' ? <ChatDevTools engine={engine} /> : null}
    </ChatProvider>
  );
}
