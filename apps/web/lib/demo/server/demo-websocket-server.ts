import type { IncomingMessage } from 'node:http';
import type { RawData, WebSocket } from 'ws';

import { WebSocketServer } from 'ws';
import { z } from 'zod';

import { subscribeChatEvents } from '@/lib/chat/event-broker';
import {
  DEMO_WEBSOCKET_DEMO_ID,
  DEMO_WEBSOCKET_PATH,
  DEMO_WEBSOCKET_PORT,
} from '@/lib/demo/websocket-config';

import {
  createDemoRuntimeRequestContext,
  getDemoPollingResponse,
  getDemoRuntime,
  toDemoTransportEvent,
} from './runtime-registry';

const INVALID_CONNECTION_CLOSE_CODE = 1008;
const MANUAL_RECONNECT_CLOSE_CODE = 1012;
const MANUAL_RECONNECT_CLOSE_REASON = 'manual reconnect test';

interface DemoWebSocketConnection {
  close(code?: number, reason?: string): void;
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

function sendSocketPayload(socket: WebSocket, payload: unknown): void {
  socket.send(JSON.stringify(payload));
}

async function handleDemoWebSocketConnection(
  socket: WebSocket,
  request: IncomingMessage,
): Promise<void> {
  const parsedConnection = parseDemoWebSocketConnection(request.url);
  const requestContext = createDemoRuntimeRequestContext(
    parsedConnection.demoId,
    parsedConnection.sessionId,
  );
  const runtime = getDemoRuntime(parsedConnection.demoId);
  const availability = runtime.isAvailable();

  if (!availability.available) {
    socket.close(INVALID_CONNECTION_CLOSE_CODE, availability.reason ?? 'Demo unavailable.');
    return;
  }

  const bootstrap = await runtime.ensureConversation(requestContext);
  const initialSnapshot = await getDemoPollingResponse(
    parsedConnection.demoId,
    bootstrap.conversationId,
    null,
    requestContext,
  );
  sendSocketPayload(socket, initialSnapshot.data);

  const unregisterSocket = getDemoWebSocketServerState().registry.track(
    buildDemoWebSocketConnectionKey(parsedConnection.sessionId),
    socket,
  );

  const namespace = runtime.getNamespace(requestContext);
  const unsubscribe = subscribeChatEvents(namespace, (entry) => {
    const transportEvent = toDemoTransportEvent(entry.event);
    if (!transportEvent) {
      return;
    }

    if (transportEvent.payload.conversationId !== bootstrap.conversationId) {
      return;
    }

    sendSocketPayload(socket, transportEvent);
  });

  const cleanup = (): void => {
    unregisterSocket();
    unsubscribe();
    socket.off('close', cleanup);
    socket.off('error', cleanup);
  };

  socket.on('close', cleanup);
  socket.on('error', cleanup);
  socket.on('message', (data) => {
    void handleDemoWebSocketClientFrame(parsedConnection.sessionId, data).catch((error) => {
      const message = error instanceof Error ? error.message : 'Invalid client frame.';
      socket.close(INVALID_CONNECTION_CLOSE_CODE, message.slice(0, 120));
    });
  });
}

async function handleDemoWebSocketClientFrame(sessionId: string, data: RawData): Promise<void> {
  const event = parseDemoWebSocketFrame(data);
  const requestContext = createDemoRuntimeRequestContext(DEMO_WEBSOCKET_DEMO_ID, sessionId);
  const runtime = getDemoRuntime(DEMO_WEBSOCKET_DEMO_ID);

  if (event.type === 'typing') {
    await runtime.sendTyping(event.payload.action, event.payload.conversationId, requestContext);
    return;
  }

  await runtime.sendMessage(
    event.payload.conversationId,
    event.payload.content,
    event.payload.metadata,
    requestContext,
  );
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
