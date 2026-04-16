# @kaira/chat-transport-websocket

`@kaira/chat-transport-websocket` is the first-party WebSocket `ITransport`
adapter for the Kaira Chat SDK. It keeps the SDK transport-first: you provide
the WebSocket endpoint and frame parsing rules, while `ChatEngine` continues to
own message state, events, and middleware.

## Installation

```bash
pnpm add @kaira/chat-core @kaira/chat-transport-websocket
```

## When To Use It

Use this package when your backend already exposes a persistent WebSocket
channel for chat traffic, typing, or lightweight realtime status updates.

Prefer polling when:

- your backend only exposes plain HTTP endpoints
- you want the smallest operational footprint
- reconnect latency is not critical

## Usage

```ts
import type { TransportEvent, TypingTransportPayload } from '@kaira/chat-core';

import { ChatEngine, ChatSerializer } from '@kaira/chat-core';
import { WebSocketTransport } from '@kaira/chat-transport-websocket';

type DemoTransportEvent = TransportEvent<'message' | 'typing'>;
const serializer = new ChatSerializer();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTypingPayload(value: unknown): value is TypingTransportPayload {
  return (
    isRecord(value) &&
    (value['action'] === 'start' || value['action'] === 'stop') &&
    typeof value['conversationId'] === 'string' &&
    isRecord(value['participant']) &&
    typeof value['participant']['id'] === 'string'
  );
}

function parseTransportEvent(value: unknown): DemoTransportEvent {
  if (
    !isRecord(value) ||
    typeof value['type'] !== 'string' ||
    typeof value['timestamp'] !== 'number'
  ) {
    throw new Error('Invalid transport event frame.');
  }

  if (value['type'] === 'message') {
    return {
      type: 'message',
      payload: serializer.deserializeMessage(JSON.stringify(value['payload'])),
      timestamp: value['timestamp'],
    };
  }

  if (value['type'] === 'typing' && isTypingPayload(value['payload'])) {
    return {
      type: 'typing',
      payload: value['payload'],
      timestamp: value['timestamp'],
    };
  }

  throw new Error('Unsupported transport event type.');
}

const transport = new WebSocketTransport<DemoTransportEvent, DemoTransportEvent>({
  url: 'wss://example.com/chat?conversationId=demo',
  capabilities: {
    typing: true,
  },
  reconnectDelayMs: 1_000,
  maxReconnectDelayMs: 30_000,
  backoffMultiplier: 2,
  jitterRatio: 0.2,
  deserialize: (frame) => {
    if (typeof frame !== 'string') {
      return null;
    }

    const parsed: unknown = JSON.parse(frame);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => parseTransportEvent(item));
    }

    return parseTransportEvent(parsed);
  },
});

export const engine = new ChatEngine({
  transport,
  sender: {
    id: 'sdk-user',
    role: 'user',
    displayName: 'SDK Explorer',
  },
});
```

## Lifecycle Notes

- `connect()` opens one socket and transitions through `connecting` to
  `connected`.
- Unexpected closes transition the transport to `reconnecting` and retry with
  backoff unless `reconnect: false` is configured.
- `send()` rejects while the socket is not connected.
- `deserialize` may return one event, an array of events, or `null`. Returning
  an array is useful for initial-sync frames that deliver seeded history plus
  typing state in one payload.
- `serialize` defaults to `JSON.stringify(event)`. Override it only if your
  backend requires a different outbound frame shape.

## Caveats

- This adapter is intentionally generic. It does not prescribe auth, protocol
  negotiation, or provider-specific message envelopes.
- The package does not synthesize stream lifecycle events on its own. If your
  backend supports streamed AI responses, publish the corresponding
  `ChatEngine.emitStream*` events from your app/runtime layer.
- Server-side Node usage needs a WebSocket implementation injected through
  `createSocket`; the built-in browser factory is browser-only.

## Demo Mapping

The monorepo demo app includes a local-only `/websocket` showcase in
`apps/web`. It bootstraps the conversation over HTTP, then uses this package
for message and typing traffic over a demo-only sibling-port WebSocket bridge.

## Documentation

- [Transport docs](https://github.com/Kaira/chat-core/tree/main/apps/docs/app/transport/page.mdx)
- [Examples](https://github.com/Kaira/chat-core/tree/main/apps/docs/app/examples/page.mdx)
