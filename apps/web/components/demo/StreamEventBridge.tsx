'use client';

import type { JSX } from 'react';

import { useEffect } from 'react';

import { useChatEngine } from '@kaira/chat-react';

import {
  buildDemoRouteUrl,
  parseStreamChunkEvent,
  parseStreamEndEvent,
  parseStreamErrorEvent,
  parseStreamStartEvent,
} from '@/lib/demo/client-runtime';

import { useDemoRuntime } from './DemoRuntimeProvider';

interface StreamEventBridgeProps {
  readonly conversationId: string;
}

export function StreamEventBridge({ conversationId }: StreamEventBridgeProps): JSX.Element | null {
  const runtime = useDemoRuntime();
  const engine = useChatEngine();

  useEffect(() => {
    if (!runtime.supportsStreamingBridge) {
      return;
    }

    const source = new EventSource(
      buildDemoRouteUrl(
        runtime.apiBasePath,
        'events',
        runtime.sessionId,
        new URLSearchParams({
          conversationId,
        }),
      ),
    );

    const handleStreamStart = (event: Event): void => {
      if (!(event instanceof MessageEvent)) {
        return;
      }

      try {
        const payload = parseStreamStartEvent(JSON.parse(event.data));
        engine.emitStreamStart(payload.messageId, payload.conversationId);
      } catch {
        return;
      }
    };

    const handleStreamChunk = (event: Event): void => {
      if (!(event instanceof MessageEvent)) {
        return;
      }

      try {
        const payload = parseStreamChunkEvent(JSON.parse(event.data));
        engine.emitStreamChunk(payload.messageId, payload.chunk, payload.accumulated);
      } catch {
        return;
      }
    };

    const handleStreamEnd = (event: Event): void => {
      if (!(event instanceof MessageEvent)) {
        return;
      }

      try {
        const payload = parseStreamEndEvent(JSON.parse(event.data));
        if (payload.message.type !== 'ai') {
          return;
        }

        void engine.emitStreamEnd(payload.message);
      } catch {
        return;
      }
    };

    const handleStreamError = (event: Event): void => {
      if (!(event instanceof MessageEvent)) {
        return;
      }

      try {
        const payload = parseStreamErrorEvent(JSON.parse(event.data));
        engine.emitStreamError(
          payload.messageId,
          payload.conversationId,
          payload.error ?? { kind: 'transport', message: 'Unknown stream error' },
        );
      } catch {
        return;
      }
    };

    source.addEventListener('message:stream:start', handleStreamStart);
    source.addEventListener('message:stream:chunk', handleStreamChunk);
    source.addEventListener('message:stream:end', handleStreamEnd);
    source.addEventListener('message:stream:error', handleStreamError);

    return () => {
      source.removeEventListener('message:stream:start', handleStreamStart);
      source.removeEventListener('message:stream:chunk', handleStreamChunk);
      source.removeEventListener('message:stream:end', handleStreamEnd);
      source.removeEventListener('message:stream:error', handleStreamError);
      source.close();
    };
  }, [conversationId, engine, runtime]);

  return null;
}
