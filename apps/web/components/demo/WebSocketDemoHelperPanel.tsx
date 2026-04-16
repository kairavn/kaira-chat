'use client';

import type { JSX } from 'react';

import { useState } from 'react';

import { useConnectionState } from '@kaira/chat-react';

import { buildDemoWebSocketUrl, DEMO_WEBSOCKET_DEMO_ID } from '@/lib/demo/websocket-config';

import { useDemoRuntime } from './DemoRuntimeProvider';

interface DemoWebSocketControlResponse {
  readonly success: boolean;
  readonly data?: {
    readonly closedConnections: number;
  };
  readonly error?: string;
}

function isDemoWebSocketControlResponse(value: unknown): value is DemoWebSocketControlResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'success') === 'boolean'
  );
}

function getWebSocketUrl(sessionId: string): string {
  if (typeof window === 'undefined') {
    return 'Available in the browser only';
  }

  return buildDemoWebSocketUrl({
    demoId: DEMO_WEBSOCKET_DEMO_ID,
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    sessionId,
  });
}

export function WebSocketDemoHelperPanel(): JSX.Element {
  const runtime = useDemoRuntime();
  const connectionState = useConnectionState();
  const [isDroppingConnection, setIsDroppingConnection] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function dropConnection(): Promise<void> {
    setIsDroppingConnection(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/demos/websocket/control?sessionId=${runtime.sessionId}`, {
        body: JSON.stringify({
          action: 'drop-connections',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      const json: unknown = await response.json();

      if (!isDemoWebSocketControlResponse(json)) {
        throw new Error('Unexpected control response payload.');
      }

      if (!response.ok || json.success !== true) {
        throw new Error(json.error ?? `Control request failed with status ${response.status}`);
      }

      setStatusMessage(
        `Closed ${String(json.data?.closedConnections ?? 0)} tracked connection(s). The client should reconnect automatically.`,
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to drop the demo socket.');
    } finally {
      setIsDroppingConnection(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ fontSize: 16 }}>Checks</h2>
      <ul
        style={{
          color: '#cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          paddingLeft: 18,
        }}
      >
        <li>
          Send a prompt or use a quick action to verify user send plus assistant receive over
          WebSocket.
        </li>
        <li>
          Watch the status bar switch through `connected` and `reconnecting` when you drop the
          socket.
        </li>
        <li>
          Confirm typing appears before the final assistant reply after the reconnect completes.
        </li>
      </ul>
      <div
        style={{
          borderRadius: 12,
          border: '1px solid #1e293b',
          background: 'rgba(15, 23, 42, 0.75)',
          color: '#cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 12,
        }}
      >
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Transport state</div>
        <div style={{ fontSize: 14 }}>{connectionState}</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Socket URL</div>
        <code
          style={{
            color: '#dbeafe',
            fontSize: 12,
            overflowWrap: 'anywhere',
          }}
        >
          {getWebSocketUrl(runtime.sessionId)}
        </code>
        <button
          type="button"
          onClick={() => {
            void dropConnection();
          }}
          disabled={isDroppingConnection}
          style={{
            alignSelf: 'flex-start',
            background: '#1d4ed8',
            border: 'none',
            borderRadius: 10,
            color: '#eff6ff',
            cursor: isDroppingConnection ? 'wait' : 'pointer',
            opacity: isDroppingConnection ? 0.7 : 1,
            padding: '10px 14px',
          }}
        >
          {isDroppingConnection ? 'Dropping connection...' : 'Drop Connection'}
        </button>
        {statusMessage ? <p style={{ color: '#bfdbfe', fontSize: 12 }}>{statusMessage}</p> : null}
      </div>
    </div>
  );
}
