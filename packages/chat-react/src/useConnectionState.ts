'use client';

import type { ConnectionState } from '@kaira/chat-core';

import { useEffect, useState } from 'react';

import { useChatEngine } from './chat-context';

/**
 * Subscribes to ChatEngine connection state updates.
 */
export function useConnectionState(): ConnectionState {
  const engine = useChatEngine();
  const [state, setState] = useState<ConnectionState>(() => engine.getConnectionState());

  useEffect(() => {
    return engine.on('connection:state', (event) => {
      setState((current) => (current === event.state ? current : event.state));
    });
  }, [engine]);

  return state;
}
