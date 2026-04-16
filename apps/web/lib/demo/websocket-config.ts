import type { DemoId } from '@/config/demo-registry';

const DEFAULT_DEMO_WEBSOCKET_PORT = 3021;

export const DEMO_WEBSOCKET_DEMO_ID = 'websocket' as const satisfies Extract<DemoId, 'websocket'>;
export const DEMO_WEBSOCKET_PATH = '/demo-websocket';
export const DEMO_WEBSOCKET_PORT = DEFAULT_DEMO_WEBSOCKET_PORT;

interface BuildDemoWebSocketUrlInput {
  readonly demoId: Extract<DemoId, 'websocket'>;
  readonly hostname: string;
  readonly protocol: string;
  readonly sessionId: string;
}

export function buildDemoWebSocketUrl(input: BuildDemoWebSocketUrlInput): string {
  const websocketProtocol = input.protocol === 'https:' ? 'wss:' : 'ws:';
  const searchParams = new URLSearchParams({
    demoId: input.demoId,
    sessionId: input.sessionId,
  });

  return `${websocketProtocol}//${input.hostname}:${String(DEMO_WEBSOCKET_PORT)}${DEMO_WEBSOCKET_PATH}?${searchParams.toString()}`;
}
