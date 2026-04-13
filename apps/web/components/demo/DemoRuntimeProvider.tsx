'use client';

import type { Participant } from '@kaira/chat-core';
import type { DemoId } from '@/config/demo-registry';
import type { DemoClientRuntime } from '@/lib/demo/client-runtime';
import type { JSX, ReactNode } from 'react';

import dynamic from 'next/dynamic';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

import { ChatProvider } from '@kaira/chat-react';

import { getOrCreateDemoClientRuntime } from '@/lib/demo/client-runtime';

const ChatDevTools = dynamic(
  async () => (await import('@/components/demo/ChatDevToolsClient')).ChatDevToolsClient,
  {
    ssr: false,
  },
);
const SHOULD_RENDER_CHAT_DEVTOOLS = process.env.NEXT_PUBLIC_ENABLE_CHAT_DEVTOOLS === 'true';

interface DemoRuntimeProviderProps {
  readonly demoId: DemoId;
  readonly apiBasePath: string;
  readonly storageName: string;
  readonly sender: Participant;
  readonly enableStreamingBridge?: boolean;
  readonly children: ReactNode;
}

interface DemoRuntimeReady {
  readonly status: 'ready';
}

interface DemoRuntimeConnecting {
  readonly status: 'connecting';
}

interface DemoRuntimeError {
  readonly status: 'error';
  readonly message: string;
}

type DemoRuntimeReadiness = DemoRuntimeReady | DemoRuntimeConnecting | DemoRuntimeError;

interface DemoRuntimeContextValue {
  readonly readiness: DemoRuntimeReadiness;
  readonly reconnect: () => void;
  readonly runtime: DemoClientRuntime;
}

interface DemoRuntimeState {
  readonly key: string;
  readonly runtime: DemoClientRuntime;
}

const CONNECTING_RUNTIME_STATUS = {
  status: 'connecting',
} as const satisfies DemoRuntimeConnecting;

const READY_RUNTIME_STATUS = {
  status: 'ready',
} as const satisfies DemoRuntimeReady;

const DemoRuntimeContext = createContext<DemoRuntimeContextValue | null>(null);

function normalizeError(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

function createRuntimeSender(sender: Participant): Participant {
  return {
    id: sender.id,
    role: sender.role,
    ...(sender.displayName ? { displayName: sender.displayName } : {}),
    ...(sender.avatarUrl ? { avatarUrl: sender.avatarUrl } : {}),
  };
}

function createRuntimeKey(
  demoId: DemoId,
  apiBasePath: string,
  storageName: string,
  sender: Participant,
  enableStreamingBridge: boolean,
): string {
  return [
    demoId,
    apiBasePath,
    storageName,
    sender.id,
    sender.role,
    sender.displayName ?? '',
    sender.avatarUrl ?? '',
    enableStreamingBridge ? 'streaming' : 'standard',
  ].join(':');
}

function createDemoRuntimeState(
  demoId: DemoId,
  apiBasePath: string,
  storageName: string,
  sender: Participant,
  enableStreamingBridge: boolean,
): DemoRuntimeState {
  return {
    key: createRuntimeKey(demoId, apiBasePath, storageName, sender, enableStreamingBridge),
    runtime: getOrCreateDemoClientRuntime({
      demoId,
      apiBasePath,
      storageName,
      sender,
      enableStreamingBridge,
    }),
  };
}

export function DemoRuntimeProvider({
  demoId,
  apiBasePath,
  storageName,
  sender,
  enableStreamingBridge = false,
  children,
}: DemoRuntimeProviderProps): JSX.Element {
  const runtimeSender = createRuntimeSender(sender);
  const runtimeKey = createRuntimeKey(
    demoId,
    apiBasePath,
    storageName,
    runtimeSender,
    enableStreamingBridge,
  );
  const [runtimeState, setRuntimeState] = useState<DemoRuntimeState>(() =>
    createDemoRuntimeState(demoId, apiBasePath, storageName, runtimeSender, enableStreamingBridge),
  );
  const [readiness, setReadiness] = useState<DemoRuntimeReadiness>(CONNECTING_RUNTIME_STATUS);
  const [connectRevision, setConnectRevision] = useState(0);
  const connectAttemptRef = useRef(0);
  const disconnectPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (runtimeState.key === runtimeKey) {
      return;
    }

    setRuntimeState(
      createDemoRuntimeState(
        demoId,
        apiBasePath,
        storageName,
        runtimeSender,
        enableStreamingBridge,
      ),
    );
    setReadiness(CONNECTING_RUNTIME_STATUS);
    setConnectRevision((current) => current + 1);
  }, [
    apiBasePath,
    demoId,
    enableStreamingBridge,
    runtimeKey,
    runtimeSender,
    runtimeState.key,
    storageName,
  ]);

  useEffect(() => {
    let isActive = true;
    const attemptId = connectAttemptRef.current + 1;
    connectAttemptRef.current = attemptId;
    setReadiness(CONNECTING_RUNTIME_STATUS);

    const unsubscribe = runtimeState.runtime.engine.on('connection:state', (event) => {
      if (!isActive || connectAttemptRef.current !== attemptId) {
        return;
      }

      if (event.state === 'connected' || event.state === 'reconnecting') {
        setReadiness(READY_RUNTIME_STATUS);
      }
    });

    const connectRuntime = async (): Promise<void> => {
      try {
        const pendingDisconnect = disconnectPromiseRef.current;
        if (pendingDisconnect) {
          await pendingDisconnect;
        }

        if (!isActive || connectAttemptRef.current !== attemptId) {
          return;
        }

        await runtimeState.runtime.engine.connect();

        if (!isActive || connectAttemptRef.current !== attemptId) {
          return;
        }

        setReadiness(READY_RUNTIME_STATUS);
      } catch (error) {
        if (!isActive || connectAttemptRef.current !== attemptId) {
          return;
        }

        setReadiness({
          status: 'error',
          message: normalizeError(error, 'Failed to connect the demo runtime.'),
        });
      }
    };

    void connectRuntime();

    return () => {
      isActive = false;
      connectAttemptRef.current++;
      unsubscribe();

      const disconnectPromise = runtimeState.runtime.engine.disconnect().catch(() => undefined);
      void disconnectPromise.finally(() => {
        if (disconnectPromiseRef.current === disconnectPromise) {
          disconnectPromiseRef.current = null;
        }
      });

      disconnectPromiseRef.current = disconnectPromise;
    };
  }, [connectRevision, runtimeState.runtime]);

  const runtimeContextValue: DemoRuntimeContextValue = {
    readiness,
    reconnect() {
      setReadiness(CONNECTING_RUNTIME_STATUS);
      setConnectRevision((current) => current + 1);
    },
    runtime: runtimeState.runtime,
  };

  return (
    <DemoRuntimeContext.Provider value={runtimeContextValue}>
      <ChatProvider engine={runtimeState.runtime.engine}>
        {readiness.status === 'error' ? (
          <div
            style={{
              borderRadius: 12,
              border: '1px solid #7f1d1d',
              background: '#450a0a',
              color: '#fecaca',
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span>Connection error: {readiness.message}</span>
            <button
              type="button"
              onClick={runtimeContextValue.reconnect}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : null}
        {children}
        {SHOULD_RENDER_CHAT_DEVTOOLS ? <ChatDevTools engine={runtimeState.runtime.engine} /> : null}
      </ChatProvider>
    </DemoRuntimeContext.Provider>
  );
}

export function useDemoRuntime(): DemoClientRuntime {
  const context = useContext(DemoRuntimeContext);
  if (!context) {
    throw new Error('useDemoRuntime must be used within DemoRuntimeProvider.');
  }

  return context.runtime;
}

export function useDemoRuntimeReadiness(): DemoRuntimeReadiness {
  const context = useContext(DemoRuntimeContext);
  if (!context) {
    throw new Error('useDemoRuntimeReadiness must be used within DemoRuntimeProvider.');
  }

  return context.readiness;
}

export function useDemoRuntimeReconnect(): () => void {
  const context = useContext(DemoRuntimeContext);
  if (!context) {
    throw new Error('useDemoRuntimeReconnect must be used within DemoRuntimeProvider.');
  }

  return context.reconnect;
}
