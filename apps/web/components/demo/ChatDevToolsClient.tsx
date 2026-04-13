'use client';

import type { ChatEngine } from '@kaira/chat-core';
import type { JSX } from 'react';

import { ChatDevTools } from '@kaira/chat-devtools';

interface ChatDevToolsClientProps {
  readonly engine: ChatEngine;
}

export function ChatDevToolsClient({ engine }: ChatDevToolsClientProps): JSX.Element {
  return <ChatDevTools engine={engine} />;
}
