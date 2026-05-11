# System Architecture

## Runtime Model

The Kaira Chat SDK runtime consists of pluggable, independently testable layers that coordinate through a central `ChatEngine`.

### Core Components

```
ChatEngine (orchestrator)
├── EventBus (typed event dispatch)
├── MiddlewarePipeline (ordered execution)
├── MessageRegistry (type resolution)
├── ConnectionStateMachine (5 states: disconnected, connecting, connected, reconnecting, error)
├── ConversationStateMachine (scope for typing, local state)
├── TypingStateStore (ephemeral, conversation-scoped)
├── ITransport (pluggable, optional)
├── IStorage (pluggable, optional)
├── IPlugin lifecycle (register/teardown)
└── ChatSerializer (JSON encode/decode with fallback)
```

### Event Flow

```
User Action (send message)
  ↓
ChatEngine.sendMessage()
  ↓
MiddlewarePipeline (outbound)
  ↓
ITransport.sendEvent() [optional]
  ↓
Message marked `sent`
  ↓
Application receives `message:sent` event

Inbound (from transport or plugins):
  ↓
ITransport polls/receives event
  ↓
ChatEngine deduplicates & validates
  ↓
IStorage.saveMessage() [optional]
  ↓
MiddlewarePipeline (inbound)
  ↓
EventBus dispatches typed event
  ↓
React hooks and application listeners react
```

### State Machines

**ConnectionStateMachine (5 states):**

```
disconnected → connecting → connected → [error] → reconnecting → connected
     ↑                           ↓
     └───────────────────────────┘
```

Managed by `ChatEngine.connect()`, `disconnect()`, and transport lifecycle.

**ConversationStateMachine:**

- Tracks active conversation scope
- Supports conversation switching
- Typing state isolated per conversation

**TypingStateStore:**

- Per-conversation ephemeral participant typing state
- TTL-based expiry (default 3s)
- Throttled outbound emits (avoid spam)
- No persistence to storage

### Streaming Lifecycle

Explicit helper methods (not auto-wrapped):

```ts
engine.emitStreamStart(conversationId, messageId);
// Application calls in loop:
engine.emitStreamChunk(conversationId, messageId, { text: '...' });
// When done:
engine.emitStreamEnd(conversationId, messageId);
// On error:
engine.emitStreamError(conversationId, messageId, error);
```

Helpers emit typed events (`message:stream:*`) that React hooks and UI consume.

## Transport Layer

### ITransport Contract

```ts
interface ITransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  sendEvent(event: CoreEvent): Promise<void>;
  onEvent(callback: (event: CoreEvent) => void): void;
}
```

**Responsibility:** Move events between client and server. Transport is optional; engine works without it (local-only mode).

### First-Party Transports

**PollingTransport** (`@kaira/chat-transport-polling`)

- Generic HTTP-based polling
- Pluggable `PollEventsFn` and `SendEventFn`
- Exponential backoff on connection failure
- No provider coupling

**WebSocketTransport** (`@kaira/chat-transport-websocket`)

- Configurable frame parsing and serialization
- Pluggable `WebSocketFactory`
- Automatic reconnection
- Connection state tracking

**DitTransport** (`@kaira/chat-provider-dit`)

- Extends `PollingTransport` for DIT-specific integration
- Server-side message mapping
- History pagination (optional load-more)
- Secrets remain server-only

### Transport in Apps

**Browser (demo):**

- Default: `PollingTransport` → `/api/demos/[demoId]/events`
- WebSocket demo: `WebSocketTransport` → localhost:3021 bridge
- Storage: `IndexedDBStorage`
- Handles outbound/inbound independently

**Server (DIT proxy):**

- Secrets in environment (`API_URL`, `X_API_KEY`, `X_API_ID`)
- Server-owned `ChatEngine` + `DitTransport`
- API route bridges to browser via polling
- Events persisted in memory (process-local, no external queue)

## Storage Layer

### IStorage Contract

```ts
interface IStorage {
  getConversation(id: string): Promise<Conversation | undefined>;
  saveConversation(conversation: Conversation): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  getMessages(conversationId: string, pagination?: Pagination): Promise<Message[]>;
  saveMessage(conversationId: string, message: Message): Promise<void>;
  deleteMessage(conversationId: string, messageId: string): Promise<void>;
  // ... etc
}
```

**Optional:** Engine works without storage (all state in memory).

### First-Party Storage

**IndexedDBStorage** (`@kaira/chat-storage-indexeddb`)

- Browser-first IndexedDB adapter
- Lazy database initialization (on first save)
- Serializer-backed records (JSON fallback)
- Message + conversation pagination
- `MemoryStorage` fallback when IndexedDB unavailable (quota exceeded, private mode)

## React Integration

### ChatProvider

Wraps the application with a `ChatEngine` instance:

```tsx
<ChatProvider
  engine={engine}
  autoConnect={true}
  onConnectionStateChange={(state) => { ... }}
>
  <App />
</ChatProvider>
```

**Lifecycle:**

- Mounts: connect (if `autoConnect`)
- Unmounts: disconnect and cleanup

### Hooks (9 total)

| Hook                                         | Purpose                                                   |
| -------------------------------------------- | --------------------------------------------------------- |
| `useMessages(conversationId)`                | Subscribe to messages in a conversation                   |
| `useConnectionState()`                       | Current connection state (disconnected, connecting, etc.) |
| `useSendMessage(conversationId)`             | Send a user message                                       |
| `useStreamingMessage(conversationId)`        | Subscribe to active stream events                         |
| `useOptimisticMessages(conversationId)`      | Merge optimistic + confirmed messages                     |
| `useTypingState(conversationId)`             | Typing participants + state                               |
| `useTypingParticipants(conversationId)`      | Participant list only                                     |
| `useIsTyping(conversationId, participantId)` | Boolean for specific participant                          |
| `useTypingController()`                      | Emit typing start/stop                                    |

### React Strict Mode

Hooks handle double-mount in Strict Mode (dev only):

- `autoConnect: true` in second mount replays without duplicate connects
- Subscription cleanup is idempotent

## UI Layer

### RendererRegistry

Pluggable renderers for message content types:

```ts
const renderers = new RendererRegistry();
renderers.register('text', TextRenderer);
renderers.register('custom:survey', SurveyRenderer);
// Fallback for unknown types: renders JSON or error
```

### Built-in Renderers

- **Text** — plain text messages
- **TextStream** — streaming AI responses
- **Image** — images with alt text
- **Audio** — audio playback
- **Video** — video embeds
- **File** — file downloads
- **Location** — map embeds or coordinates

Provider-specific transcript payloads remain out of scope (consumers implement custom renderers).

### UI Primitives

**TypingIndicator**

- Animated participant presence
- Configurable animation (dots, pulse)
- Decoupled from engine state (prop-based)

**ThinkingIndicator**

- Shows when stream is active
- Separate from typing

**MessageInput**

- Composer with draft/blur callbacks
- No engine coupling (consumers manage send)
- Accessible (ARIA labels)

## Devtools

### ChatDevTools

Runtime inspection panel for React apps (development only).

**Features:**

- **Event ring buffer** — last 100 events (configurable)
- **Event tab** — browse events, inspect payloads, timestamps
- **Transport tab** — inspect outbound/inbound messages
- **Middleware tab** — trace middleware execution order
- **Plugins tab** — list registered plugins, lifecycle events
- **Streams tab** — snapshot active stream state

### useChatDevTools Hook

```ts
const devtools = useChatDevTools();
// Access buffers, inspect state, trigger actions
```

Automatically resets on engine swap (re-render with different engine instance).

## Middleware & Plugins

### Middleware

**MiddlewarePipeline:** Ordered execution on outbound/inbound events.

```ts
engine.registerMiddleware('transform-payload', (event) => {
  return { ...event, customField: value };
});
```

No first-party middleware packages yet (interfaces exist, follow-on work).

### Plugins

**Plugin lifecycle:** register (on engine creation), use (during runtime), teardown (on engine destroy).

```ts
engine.registerPlugin({
  onStart: () => {
    /* ... */
  },
  onDestroy: () => {
    /* ... */
  },
  onMessage: (msg) => {
    /* ... */
  },
});
```

No first-party plugin packages yet (interfaces exist, follow-on work).

## Process-Local Event Broker

**Constraint (inferred from code):**

The server-side event broker in `apps/web/lib/chat/event-broker.ts` is **process-local**:

- In-memory listener set (no external pub/sub)
- Single Node process assumed
- No shared state across server instances
- SSE and polling clients both read from same in-memory listeners

**Implication:** Multi-process deployments would need external broker (not in scope for this release).

## Data Flow: Browser + Server Demo

```
Browser:
  DemoRuntimeProvider creates per-demo ChatEngine
    + PollingTransport (→ /api/demos/[demoId]/events)
    + IndexedDBStorage
  Polls for messages/typing every 500ms
  SSE bridge (optional, for stream events)

Server:
  RuntimeRegistry (singleton, keyed by demo ID)
  For each demo:
    - Server-owned ChatEngine instance
    - Local AI simulator or DIT transport
    - Event broker fans out to all connected clients
  Route /api/demos/[demoId]/events:
    - Returns: messages, typing, stream events (JSON or SSE)
    - Polls every 500ms
    - SSE: stream:start, stream:chunk, stream:end events

Sequence (local streaming demo):
  1. Browser: GET /api/demos/streaming/bootstrap → conversation state
  2. Browser: Create ChatEngine, load state from response
  3. Browser: User sends message via useMessages hook
  4. Browser: PollingTransport calls /api/demos/streaming/send → route
  5. Server: Route receives, calls engine.sendMessage()
  6. Server: Middleware/plugin processes, AI responds
  7. Server: engine.emitStreamStart() → event-broker listener
  8. Server: Calls emitStreamChunk() in loop → broker
  9. Browser: SSE listener receives stream:chunk events, updates UI
 10. Server: Completes with emitStreamEnd()
 11. Browser: Final assistant message arrives via polling
```

## Demo App Runtime Split

The server runtime and browser runtime are split to isolate concerns:

**Client-side demo runtime** (`apps/web/lib/demo/client-runtime.ts`, `apps/web/components/demo/`):

- Per-demo `ChatEngine` with `PollingTransport` + `IndexedDBStorage`
- Polls `/api/demos/[demoId]/events` every 500ms
- SSE bridge for stream lifecycle updates (separate from polling channel)
- WebSocket demo exception: uses `WebSocketTransport` to localhost:3021 sibling bridge

**Server-side demo runtime** (`apps/web/lib/chat/`, `apps/web/lib/demo/server/`):

- `RuntimeRegistry` singleton keyed by demo ID (1-hour TTL per session)
- Each demo has its own `ChatEngine` (local or DIT-backed)
- In-memory event broker fans out to all connected clients
- Route `/api/demos/[demoId]/events` handles polling + SSE

**DIT-specific paths:**

- Secrets (`API_URL`, `X_API_KEY`, `X_API_ID`) kept server-side only
- Server-owned `ChatEngine` + `DitTransport` in `apps/web/lib/chat/server-chat-engine.ts`
- Browser connects via Next.js API route, never sees credentials
- Message history and mapping handled by transport adapter

## Related Deep-Dive Documentation

For design decisions, implementation constraints, and safe edit practices:

- [`./design-guidelines.md`](./design-guidelines.md) — why transport-first, not provider-first; extensibility constraints
- [`./code-standards.md`](./code-standards.md) — safe edit boundaries, validation rules per surface, extra-caution areas
- [`./codebase-summary.md`](./codebase-summary.md) — package roles, directory structure, key tooling
- [`./testing-strategy.md`](./testing-strategy.md) — coverage expectations by surface

## Key Architectural Invariants

1. **Transport is optional.** Engine works in local-only mode without it.
2. **Storage is optional.** All state can remain in memory.
3. **Explicit streaming.** No auto-wrapping of AI responses; helpers make stream lifecycle explicit.
4. **Registry-based extensibility.** Renderers, middleware, plugins registered at runtime, not globally.
5. **Process-local events.** Single Node process, in-memory broker (no external queue required).
6. **React-optional.** Core engine is framework-agnostic; React bindings are separate.
7. **First-party adapters.** Polling + WebSocket transports and IndexedDB storage ship in core; providers layer on top via transport.
