# SDK Design Guidelines

These are the foundational design tenets that guided the Kaira Chat SDK. Use them to understand why the SDK is structured this way and to guide future extensions and integrations.

## Core Tenets

### 1. Transport-First, Not Provider-First

**Principle:** Start with pluggable `ITransport` abstractions. Provider integrations layer on top, not the reverse.

**Why:**

- Transports are reusable across many providers (HTTP polling works for OpenAI, Claude, custom backends)
- Providers are project-specific (API keys, auth flows, message formats vary widely)
- Decoupling avoids vendor lock-in and reduces SDK complexity

**Implications:**

- `ITransport` is the primary extension point for developers
- `IProvider` exists as a contract but has no concrete implementation (defer to follow-on work)
- First-party transports: polling (generic HTTP) and WebSocket (generic)
- Provider-specific integrations (DIT, OpenAI, etc.) implement `ITransport` or extend it

**Evidence:**

- `packages/chat-core/src/types/transport.ts` — core abstraction
- `packages/chat-transport-polling/` and `packages/chat-transport-websocket/` — generic implementations
- `packages/chat-provider-dit/` — extends polling, not a provider implementation
- `packages/chat-core/src/types/provider.ts` — contract exists but unused

### 2. Explicit Streaming, Not Auto-Wrapped

**Principle:** Developers call stream lifecycle helpers directly. No implicit middleware that intercepts and wraps responses.

**Why:**

- Streaming is complex and varies by provider (OpenAI streaming ≠ Claude streaming ≠ custom)
- Developers need explicit control over when streams start, chunk, and end
- Easier to debug and reason about; matches developer expectations
- Enables custom stream handling (retry, aggregation, filtering)

**Implications:**

- `engine.emitStreamStart()`, `emitStreamChunk()`, `emitStreamEnd()` are explicit, not implicit
- First-party helpers do not auto-emit stream events; adapters must call helpers
- UI consumes stream events via React hooks (`useStreamingMessage`)
- No "magic" middleware or auto-wrapping in core

**Evidence:**

- `packages/chat-core/src/engine/chat-engine.ts` — explicit helper methods
- `apps/web/lib/demo/server/runtime-registry.ts` — local demos manually emit stream events
- `packages/chat-react/src/useChatHooks.tsx` — `useStreamingMessage` hook consumes events

### 3. Registry-Based Extensibility

**Principle:** Renderers, middleware, plugins are registered at runtime, not globally or statically.

**Why:**

- Easier to test (inject test doubles at registration time)
- Supports multiple engine instances with different configurations
- Explicit dependencies; no hidden global state
- Clear lifecycle (register on mount, unregister on destroy)

**Implications:**

- `RendererRegistry` for custom content types (not a global fetch-anywhere pattern)
- `engine.registerMiddleware()` and `engine.registerPlugin()` at engine creation time
- No singleton factories or global state in core
- Each `ChatEngine` instance has its own registry

**Evidence:**

- `packages/chat-core/src/engine/chat-engine.ts` — registration methods
- `packages/chat-ui/src/RendererRegistry.ts` — renderer registry pattern
- `packages/chat-react/src/ChatProvider.tsx` — provider injects engine with pre-registered plugins
- Tests create engines with test-only middleware/plugins without affecting other tests

### 4. Process-Local Events (Demo Constraint)

**Principle:** The server-side event broker is in-memory and process-local (no external queue).

**Why:**

- Simplifies demo and validation flows
- Clear ownership: one Node process = one event space
- No external dependencies (no Redis, RabbitMQ, etc.)
- Suitable for demo, internal tools, and small-scale deployments

**Constraints:**

- Multi-process or multi-instance deployments must provide external broker
- Not suitable for high-throughput production without scaling strategy
- `apps/web/lib/chat/event-broker.ts` is demo-scoped, not a production pattern

**Implications:**

- Demo runtimes in `apps/web` are single-process
- Adding multi-instance support requires external pub/sub (follow-on work)
- Documentation must clarify this is a demo pattern, not a guarantee

**Evidence:**

- `apps/web/lib/chat/event-broker.ts` — in-memory listener array, no queue
- `apps/web/lib/demo/server/runtime-registry.ts` — single registry per session, server process

### 5. Storage is Optional

**Principle:** Conversations work without persistence. Storage adapters are pluggable.

**Why:**

- Supports use cases that don't need history (single-session, ephemeral chats)
- Reduces coupling; storage is not required for core functionality
- Enables diverse backends (IndexedDB, PostgreSQL, Redis, etc.)
- Easier to test without mocking storage layer

**Implications:**

- `engine.init()` without `storage` option is valid
- `IStorage` is an injected contract, not a required dependency
- First-party adapter: `@kaira/chat-storage-indexeddb` (browser-only)
- Production deployments choose or build their own storage backend

**Evidence:**

- `packages/chat-core/src/types/storage.ts` — optional contract
- `packages/chat-core/src/engine/chat-engine.ts` — storage is optional in config
- `packages/chat-storage-indexeddb/` — first-party browser adapter
- Demo local runtimes in `apps/web` use IndexedDB; DIT proxy uses server-side persistence

### 6. React is Optional (Core is Framework-Agnostic)

**Principle:** The runtime engine does not depend on React. React bindings are a separate package.

**Why:**

- Enables use in non-React environments (Node.js servers, Vue, Svelte, etc.)
- Cleaner separation of concerns
- Core can be tested and used independently
- Smaller bundle size for consumers who don't need React

**Implications:**

- `@kaira/chat-core` has no React dependencies
- `@kaira/chat-react` depends on core and provides hooks + provider
- UI primitives in `@kaira/chat-ui` depend only on core (not React context)
- Servers can use core engine directly (no React required)

**Evidence:**

- `packages/chat-core/package.json` — no React dependency
- `packages/chat-react/package.json` — React as peerDependency
- `apps/web/lib/chat/server-chat-engine.ts` — server uses core without React

### 7. First-Party Adapters, Extensible

**Principle:** Ship essential transports and storage as first-party packages. Providers extend, not replace.

**Why:**

- Reduces cognitive load (developers don't implement basic HTTP polling)
- Ensures baseline quality and compatibility
- Enables internal use without external dependencies
- Clear extension point for provider-specific adapters

**Implications:**

- First-party shipping: polling (HTTP), WebSocket, IndexedDB
- Providers (DIT, OpenAI, etc.) layer on top via `ITransport` or extend existing adapters
- No need for concrete `IProvider` implementation; transport abstraction is sufficient

**Evidence:**

- `packages/chat-transport-polling/` — generic HTTP
- `packages/chat-transport-websocket/` — generic WebSocket
- `packages/chat-storage-indexeddb/` — browser storage
- `packages/chat-provider-dit/` — extends polling for DIT-specific needs

## Architectural Invariants

These must hold true for the SDK to function correctly:

1. **Transport is optional.** Engine works without it (local-only mode).
2. **Storage is optional.** All state remains in memory if not configured.
3. **Streaming is explicit.** No auto-wrapping of AI responses.
4. **Extensibility is registry-based.** Renderers, middleware, plugins registered at runtime.
5. **Process-local events (demo).** No external broker in `apps/web`.
6. **React is optional.** Core engine is framework-agnostic.
7. **First-party adapters.** Polling + WebSocket + IndexedDB ship in core packages.

## Extension Patterns

### Implementing a Custom Transport

Extend or implement `ITransport`:

```ts
import { CoreEvent, ITransport } from '@kaira/chat-core';

class CustomTransport implements ITransport {
  async connect() {
    /* ... */
  }
  async disconnect() {
    /* ... */
  }
  isConnected() {
    /* ... */
  }
  async sendEvent(event: CoreEvent) {
    /* ... */
  }
  onEvent(callback: (event: CoreEvent) => void) {
    /* ... */
  }
}

// Use it:
const engine = new ChatEngine({
  transport: new CustomTransport(),
});
```

**Guidance:** Start from polling or WebSocket transport if reusing HTTP or WebSocket concepts.

### Implementing Custom Storage

Extend or implement `IStorage`:

```ts
import { Conversation, IStorage, Message } from '@kaira/chat-core';

class PostgresStorage implements IStorage {
  async getConversation(id: string) {
    /* ... */
  }
  async saveConversation(conv: Conversation) {
    /* ... */
  }
  // ... etc
}

// Use it:
const engine = new ChatEngine({
  storage: new PostgresStorage(),
});
```

### Custom Middleware

Register middleware at engine creation:

```ts
engine.registerMiddleware('validation', (event) => {
  // Validate, transform, or reject events
  if (!event.conversationId) throw new Error('Missing conversation');
  return event;
});
```

Middleware runs on outbound and inbound events (order matters).

### Custom Plugins

Register plugins at engine creation:

```ts
engine.registerPlugin({
  onStart: () => console.log('Started'),
  onDestroy: () => console.log('Destroyed'),
  onMessage: (msg) => console.log('New message', msg),
});
```

Plugins have lifecycle hooks and can listen to events.

### Custom Renderers

Register renderers in UI layer:

```ts
import { RendererRegistry } from '@kaira/chat-ui';

const renderers = new RendererRegistry();
renderers.register('custom:survey', SurveyRenderer);
renderers.register('custom:form', FormRenderer);

// Use in React:
<MessageRenderer contentType={msg.contentType} renderers={renderers} />
```

## Anti-Patterns to Avoid

1. **Auto-wrapping streams in middleware** — Breaks explicit streaming model. Let adapters call helpers.
2. **Global singleton registries** — Use per-engine registration. Harder to test, harder to isolate.
3. **Provider-first design** — Avoid tying SDK to one provider's API shape. Use transports instead.
4. **Implicit magic** — Avoid middleware or plugins that do unexpected work. Be explicit.
5. **Persistent typing state** — Typing is ephemeral and TTL-gated. Don't persist it.
6. **External broker dependency in core** — Core should work without Redis, RabbitMQ, etc.
7. **Exporting internal implementation** — Public API should be stable; internal refactoring shouldn't break consumers.

## Related Documentation

**Architecture & structure:**

- [`./system-architecture.md`](./system-architecture.md) — runtime model, state machines, data flow
- [`./codebase-summary.md`](./codebase-summary.md) — monorepo layout, package roles, directory structure

**Implementation guidance:**

- [`./code-standards.md`](./code-standards.md) — coding conventions, safe edit boundaries, validation standards
- [`./testing-strategy.md`](./testing-strategy.md) — coverage expectations, validation per change type

**Consumer reference:**

- `apps/docs` — SDK API reference and examples for developers

## Future Extensions (Post-Productization)

Design guidelines for future work:

**Middleware packages:**

- Follow registry pattern (register at engine creation)
- No global state
- Well-tested, focused scope
- Document interaction with other middleware

**Plugin packages:**

- Lightweight lifecycle hooks
- Can listen to events without coupling to engine internals
- Self-contained; easy to remove

**Provider implementations:**

- Implement `ITransport` (not `IProvider` at this time)
- Document provider-specific message formats
- Handle auth, rate limiting, pagination as transport concerns

**Storage backends:**

- Implement `IStorage` contract
- Document pagination behavior
- Handle connection/reconnection gracefully

**Streaming utilities:**

- Build on explicit helper methods (don't replace them)
- Examples: stream collectors, retry logic, parsing
- Test with real-world provider responses
