import type { IncomingMessage } from 'node:http';
import type {
  DemoConversationBootstrap,
  DemoPollEventsResponse,
  DemoRouteError,
  DemoRouteSuccess,
} from '@/lib/demo/contracts';
import type { RawData } from 'ws';

import { WebSocketServer } from 'ws';
import { z } from 'zod';

import {
  DEMO_WEBSOCKET_DEMO_ID,
  DEMO_WEBSOCKET_PATH,
  DEMO_WEBSOCKET_PORT,
} from '@/lib/demo/websocket-config';

const INVALID_CONNECTION_CLOSE_CODE = 1008;
const INTERNAL_SERVER_CLOSE_CODE = 1011;
const MANUAL_RECONNECT_CLOSE_CODE = 1012;
const MANUAL_RECONNECT_CLOSE_REASON = 'manual reconnect test';
export const DEMO_WEBSOCKET_POLL_INTERVAL_MS = 200;

interface DemoWebSocketConnection {
  close(code?: number, reason?: string): void;
}

interface DemoWebSocketManagedSocket extends DemoWebSocketConnection {
  send(data: string): void;
  on(event: 'close' | 'error', listener: () => void): void;
  on(event: 'message', listener: (data: RawData) => void): void;
  off(event: 'close' | 'error', listener: () => void): void;
  off(event: 'message', listener: (data: RawData) => void): void;
}

interface DemoWebSocketConnectionRegistry {
  closeConnections(connectionKey: string, closeOptions?: DemoWebSocketCloseOptions): number;
  track(connectionKey: string, socket: DemoWebSocketConnection): () => void;
}

interface DemoWebSocketCloseOptions {
  readonly code?: number;
  readonly reason?: string;
}

interface ParsedDemoWebSocketConnection {
  readonly demoId: typeof DEMO_WEBSOCKET_DEMO_ID;
  readonly sessionId: string;
}

interface DemoWebSocketServerState {
  readonly registry: DemoWebSocketConnectionRegistry;
  server: WebSocketServer | null;
  startingPromise: Promise<WebSocketServer> | null;
}

declare global {
  var __kairaDemoWebSocketServerState: DemoWebSocketServerState | undefined;
}

const websocketConnectionSearchParamsSchema = z.object({
  demoId: z.literal(DEMO_WEBSOCKET_DEMO_ID),
  sessionId: z.string().trim().min(1),
});

const websocketTypingEventSchema = z.object({
  type: z.literal('typing'),
  payload: z.object({
    action: z.enum(['start', 'stop']),
    conversationId: z.string().trim().min(1),
  }),
});

const websocketMessageEventSchema = z.object({
  type: z.literal('message'),
  payload: z.object({
    content: z.string(),
    conversationId: z.string().trim().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
    type: z.enum(['text', 'ai', 'system']),
  }),
});

const websocketClientEventSchema = z.discriminatedUnion('type', [
  websocketTypingEventSchema,
  websocketMessageEventSchema,
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDemoRouteError(value: unknown): value is DemoRouteError {
  return isRecord(value) && value['success'] === false && typeof value['error'] === 'string';
}

function isDemoRouteSuccess<TData>(value: unknown): value is DemoRouteSuccess<TData> {
  return isRecord(value) && value['success'] === true && 'data' in value;
}

function isDemoRouteAcknowledged(value: unknown): value is { readonly success: true } {
  return isRecord(value) && value['success'] === true;
}

function isDemoConversationBootstrap(value: unknown): value is DemoConversationBootstrap {
  return (
    isRecord(value) &&
    value['demoId'] === DEMO_WEBSOCKET_DEMO_ID &&
    typeof value['conversationId'] === 'string' &&
    isRecord(value['conversation']) &&
    value['conversation']['id'] === value['conversationId']
  );
}

function isDemoPollEventsResponse(value: unknown): value is DemoPollEventsResponse {
  return (
    isRecord(value) &&
    value['success'] === true &&
    Array.isArray(value['data']) &&
    (value['nextCursor'] === undefined || typeof value['nextCursor'] === 'string')
  );
}

export function buildDemoWebSocketConnectionKey(sessionId: string): string {
  return `${DEMO_WEBSOCKET_DEMO_ID}:${sessionId}`;
}

export function createDemoWebSocketConnectionRegistry(): DemoWebSocketConnectionRegistry {
  const socketsByKey = new Map<string, Set<DemoWebSocketConnection>>();

  return {
    closeConnections(connectionKey: string, closeOptions: DemoWebSocketCloseOptions = {}): number {
      const sockets = socketsByKey.get(connectionKey);
      if (!sockets) {
        return 0;
      }

      const code = closeOptions.code ?? MANUAL_RECONNECT_CLOSE_CODE;
      const reason = closeOptions.reason ?? MANUAL_RECONNECT_CLOSE_REASON;

      for (const socket of sockets) {
        socket.close(code, reason);
      }

      return sockets.size;
    },
    track(connectionKey: string, socket: DemoWebSocketConnection): () => void {
      const sockets = socketsByKey.get(connectionKey) ?? new Set<DemoWebSocketConnection>();
      sockets.add(socket);
      socketsByKey.set(connectionKey, sockets);

      return (): void => {
        const currentSockets = socketsByKey.get(connectionKey);
        if (!currentSockets) {
          return;
        }

        currentSockets.delete(socket);
        if (currentSockets.size === 0) {
          socketsByKey.delete(connectionKey);
        }
      };
    },
  };
}

export function parseDemoWebSocketConnection(
  requestUrl: string | undefined,
): ParsedDemoWebSocketConnection {
  if (!requestUrl) {
    throw new Error('Missing WebSocket request URL.');
  }

  const url = new URL(requestUrl, `http://127.0.0.1:${String(DEMO_WEBSOCKET_PORT)}`);
  if (url.pathname !== DEMO_WEBSOCKET_PATH) {
    throw new Error('Unexpected WebSocket path.');
  }

  return websocketConnectionSearchParamsSchema.parse({
    demoId: url.searchParams.get('demoId'),
    sessionId: url.searchParams.get('sessionId'),
  });
}

export function parseDemoWebSocketFrame(data: RawData): z.infer<typeof websocketClientEventSchema> {
  const rawFrame = normalizeWebSocketRawData(data);
  return websocketClientEventSchema.parse(JSON.parse(rawFrame));
}

function normalizeWebSocketRawData(data: RawData): string {
  if (typeof data === 'string') {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(data));
  }

  if (Array.isArray(data)) {
    return new TextDecoder().decode(Buffer.concat(data));
  }

  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data);
  }

  throw new Error('Unsupported WebSocket frame payload.');
}

function getDemoWebSocketServerState(): DemoWebSocketServerState {
  if (globalThis.__kairaDemoWebSocketServerState) {
    return globalThis.__kairaDemoWebSocketServerState;
  }

  const nextState: DemoWebSocketServerState = {
    registry: createDemoWebSocketConnectionRegistry(),
    server: null,
    startingPromise: null,
  };
  globalThis.__kairaDemoWebSocketServerState = nextState;
  return nextState;
}

function sendSocketPayload(socket: DemoWebSocketManagedSocket, payload: unknown): void {
  socket.send(JSON.stringify(payload));
}

export function getDemoWebSocketBridgeBaseUrl(): string {
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  return `http://127.0.0.1:${process.env.PORT ?? '3000'}`;
}

function buildDemoWebSocketBridgeUrl(path: string, searchParams?: URLSearchParams): string {
  const query = searchParams?.toString() ?? '';
  return `${getDemoWebSocketBridgeBaseUrl()}${path}${query.length > 0 ? `?${query}` : ''}`;
}

async function fetchDemoWebSocketBridgeJson(
  path: string,
  init?: RequestInit,
  searchParams?: URLSearchParams,
): Promise<unknown> {
  const response = await fetch(buildDemoWebSocketBridgeUrl(path, searchParams), init);

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error(`The demo websocket bridge received a non-JSON response from ${path}.`);
  }

  if (response.ok && !isDemoRouteError(json)) {
    return json;
  }

  if (isDemoRouteError(json)) {
    throw new Error(json.error);
  }

  throw new Error(`The demo websocket bridge request to ${path} failed with ${response.status}.`);
}

async function fetchDemoWebSocketConversation(
  sessionId: string,
): Promise<DemoConversationBootstrap> {
  const json = await fetchDemoWebSocketBridgeJson(
    `/api/demos/${DEMO_WEBSOCKET_DEMO_ID}/conversation`,
    {
      method: 'POST',
    },
    new URLSearchParams({
      sessionId,
    }),
  );

  if (
    !isDemoRouteSuccess<DemoConversationBootstrap>(json) ||
    !isDemoConversationBootstrap(json.data)
  ) {
    throw new Error('The demo websocket bridge received an invalid conversation bootstrap.');
  }

  return json.data;
}

async function fetchDemoWebSocketEvents(
  sessionId: string,
  conversationId: string,
  cursor?: string,
): Promise<DemoPollEventsResponse> {
  const searchParams = new URLSearchParams({
    conversationId,
    sessionId,
  });

  if (cursor) {
    searchParams.set('cursor', cursor);
  }

  const json = await fetchDemoWebSocketBridgeJson(
    `/api/demos/${DEMO_WEBSOCKET_DEMO_ID}/events`,
    undefined,
    searchParams,
  );

  if (!isDemoPollEventsResponse(json)) {
    throw new Error('The demo websocket bridge received an invalid events payload.');
  }

  return json;
}

async function proxyDemoWebSocketTyping(
  sessionId: string,
  conversationId: string,
  action: 'start' | 'stop',
): Promise<void> {
  const json = await fetchDemoWebSocketBridgeJson(
    `/api/demos/${DEMO_WEBSOCKET_DEMO_ID}/typing`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        conversationId,
      }),
    },
    new URLSearchParams({
      sessionId,
    }),
  );

  if (!isDemoRouteAcknowledged(json)) {
    throw new Error('The demo websocket bridge received an invalid typing response.');
  }
}

async function proxyDemoWebSocketMessage(
  sessionId: string,
  conversationId: string,
  content: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const json = await fetchDemoWebSocketBridgeJson(
    `/api/demos/${DEMO_WEBSOCKET_DEMO_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId,
        message: content,
        ...(metadata ? { metadata } : {}),
      }),
    },
    new URLSearchParams({
      sessionId,
    }),
  );

  if (!isDemoRouteSuccess<unknown>(json)) {
    throw new Error('The demo websocket bridge received an invalid message response.');
  }
}

export async function handleDemoWebSocketClientFrame(
  sessionId: string,
  conversationId: string,
  data: RawData,
): Promise<void> {
  const event = parseDemoWebSocketFrame(data);

  if (event.type === 'typing') {
    await proxyDemoWebSocketTyping(sessionId, conversationId, event.payload.action);
    return;
  }

  await proxyDemoWebSocketMessage(
    sessionId,
    conversationId,
    event.payload.content,
    event.payload.metadata,
  );
}

export async function handleDemoWebSocketConnection(
  socket: DemoWebSocketManagedSocket,
  request: Pick<IncomingMessage, 'url'>,
): Promise<void> {
  const parsedConnection = parseDemoWebSocketConnection(request.url);
  const bootstrap = await fetchDemoWebSocketConversation(parsedConnection.sessionId);
  const initialSnapshot = await fetchDemoWebSocketEvents(
    parsedConnection.sessionId,
    bootstrap.conversationId,
  );

  sendSocketPayload(socket, initialSnapshot.data);

  const unregisterSocket = getDemoWebSocketServerState().registry.track(
    buildDemoWebSocketConnectionKey(parsedConnection.sessionId),
    socket,
  );

  let nextCursor = initialSnapshot.nextCursor;
  let closed = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = (): void => {
    if (closed) {
      return;
    }

    closed = true;
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }

    unregisterSocket();
    socket.off('close', cleanup);
    socket.off('error', cleanup);
    socket.off('message', onMessage);
  };

  const schedulePoll = (): void => {
    if (closed) {
      return;
    }

    pollTimer = setTimeout(() => {
      void pollForEvents();
    }, DEMO_WEBSOCKET_POLL_INTERVAL_MS);
  };

  const pollForEvents = async (): Promise<void> => {
    try {
      const response = await fetchDemoWebSocketEvents(
        parsedConnection.sessionId,
        bootstrap.conversationId,
        nextCursor,
      );

      if (closed) {
        return;
      }

      nextCursor = response.nextCursor ?? nextCursor;
      if (response.data.length > 0) {
        sendSocketPayload(socket, response.data);
      }

      schedulePoll();
    } catch (error) {
      if (closed) {
        return;
      }

      const message =
        error instanceof Error ? error.message : 'Unable to poll the demo websocket events.';
      socket.close(INTERNAL_SERVER_CLOSE_CODE, message.slice(0, 120));
    }
  };

  const onMessage = (data: RawData): void => {
    void handleDemoWebSocketClientFrame(
      parsedConnection.sessionId,
      bootstrap.conversationId,
      data,
    ).catch((error) => {
      const message = error instanceof Error ? error.message : 'Invalid client frame.';
      socket.close(INVALID_CONNECTION_CLOSE_CODE, message.slice(0, 120));
    });
  };

  socket.on('close', cleanup);
  socket.on('error', cleanup);
  socket.on('message', onMessage);
  schedulePoll();
}

export async function ensureDemoWebSocketServer(): Promise<void> {
  const state = getDemoWebSocketServerState();
  if (state.server) {
    return;
  }

  if (state.startingPromise) {
    await state.startingPromise;
    return;
  }

  state.startingPromise = new Promise<WebSocketServer>((resolve, reject) => {
    const server = new WebSocketServer({
      path: DEMO_WEBSOCKET_PATH,
      port: DEMO_WEBSOCKET_PORT,
    });

    server.once('listening', () => {
      state.server = server;
      resolve(server);
    });

    server.once('error', (error) => {
      reject(error);
    });

    server.on('connection', (socket, request) => {
      void handleDemoWebSocketConnection(socket, request).catch((error) => {
        const message =
          error instanceof Error ? error.message : 'Unable to initialize the WebSocket demo.';
        socket.close(INVALID_CONNECTION_CLOSE_CODE, message.slice(0, 120));
      });
    });
  });

  try {
    await state.startingPromise;
  } finally {
    state.startingPromise = null;
  }
}

export function closeDemoWebSocketConnections(
  sessionId: string,
  closeOptions?: DemoWebSocketCloseOptions,
): number {
  return getDemoWebSocketServerState().registry.closeConnections(
    buildDemoWebSocketConnectionKey(sessionId),
    closeOptions,
  );
}
