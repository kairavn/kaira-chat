# Project Overview & Requirements (PDR)

## Mission

Build an SDK and developer platform for AI chat with pluggable transports, extensible storage, and React bindings. Focus: transport-first architecture, explicit streaming, and registry-based extensibility.

## Problem & Scope

**Problem:** Developers need a flexible, opinionated chat SDK that decouples from specific providers and transport layers.

**Scope for this release:**

- Core `ChatEngine` with event bus, state machines, and plugin lifecycle
- First-party transports (polling, WebSocket) and storage adapter (IndexedDB)
- React bindings and UI primitives
- Developer tooling (devtools panel, streaming helpers)
- Release automation and docs foundation

**Out of scope this milestone:**

- Concrete `IProvider` implementation (contract exists; integration deferred)
- First-party middleware/plugin packages (interfaces exist, first packages following this release)
- Server-side deployment patterns (apps/web is demo-only)

## Target Consumers

1. **SDK Users:** React/TypeScript developers integrating chat into web applications
2. **Transport Implementers:** Teams extending with custom HTTP, GraphQL, or domain-specific transports
3. **Internal Teams:** Kaira's DIT integration and internal demo apps

## Package Summary

### Public SDK Packages (8)

| Package                           | Role                              | Key exports                                                                      |
| --------------------------------- | --------------------------------- | -------------------------------------------------------------------------------- |
| `@kaira/chat-core`                | Runtime engine, events, contracts | ChatEngine, EventBus, ITransport, IStorage, IProvider                            |
| `@kaira/chat-react`               | React provider and hooks          | ChatProvider, useMessages, useConnectionState, useStreamingMessage, 6 more hooks |
| `@kaira/chat-ui`                  | Renderer registry and primitives  | RendererRegistry, 7 content renderers, TypingIndicator, MessageInput             |
| `@kaira/chat-devtools`            | Runtime inspection panel          | ChatDevTools, useChatDevTools                                                    |
| `@kaira/chat-storage-indexeddb`   | Browser storage adapter           | IndexedDBStorage, MemoryStorage                                                  |
| `@kaira/chat-transport-polling`   | HTTP polling transport            | PollingTransport                                                                 |
| `@kaira/chat-transport-websocket` | WebSocket transport               | WebSocketTransport, BrowserWebSocketAdapter                                      |
| `@kaira/chat-provider-dit`        | DIT-specific transport adapter    | DitTransport (extends PollingTransport)                                          |

### Demo & Docs Apps

- **apps/web** — Next.js demo app, DIT proxy layer, 6 demo routes (local + DIT-backed), SSE + polling support
- **apps/docs** — Consumer-facing SDK documentation, static-export, MDX-based, sections for API, React, transports, storage, streaming, devtools, UI

## Key Design Tenets

1. **Transport-First:** Start with pluggable `ITransport`, not provider-specific implementation. Providers layer on top.
2. **Explicit Streaming:** Developers call `emitStreamStart/Chunk/End` directly; no auto-wrapping.
3. **Registry-Based Extensibility:** Renderers, middleware, plugins registered at runtime, not global.
4. **Process-Local Events:** In-memory event broker, no external pub/sub required.
5. **Storage is Optional:** Conversations work without persistence; storage adapters are pluggable.

## Implementation Status Summary

- **Core:** engine, events, state machines, serialization — all implemented
- **React:** provider, 9 hooks (including streaming + typing) — all implemented
- **UI:** 7 content renderers, typing indicator, composer primitives — all implemented
- **Transports:** polling (generic), WebSocket (generic), DIT adapter — all implemented
- **Storage:** IndexedDB adapter with lazy open and fallback — implemented
- **Devtools:** runtime inspection panel with event ring buffer — implemented
- **Tests:** unit + integration coverage on core, adapters, React, UI, devtools, routes
- **Release:** Changesets automation active, npm publishing pipeline ready
- **Docs:** consumer site live, internal status system active, search integrity gated

See [`docs/feature-matrix.md`](./feature-matrix.md) for full 47-feature breakdown (generated from feature-status.json).

## Related Documentation

**Architecture & design** (understand the why):

- [`./design-guidelines.md`](./design-guidelines.md) — transport-first rationale and extensibility tenets
- [`./system-architecture.md`](./system-architecture.md) — runtime model, state machines, data flow, demo split

**Implementation guidance** (how to work in the repo):

- [`./code-standards.md`](./code-standards.md) — coding conventions, safe edit boundaries, validation standards
- [`./testing-strategy.md`](./testing-strategy.md) — coverage expectations by surface
- [`./codebase-summary.md`](./codebase-summary.md) — monorepo layout and package roles
- [`./deployment-guide.md`](./deployment-guide.md) — release, deployment, and CI/CD workflows

**Feature tracking:**

- [`docs/feature-status.json`](./feature-status.json) — canonical status inventory
- [`docs/implementation-status.md`](./implementation-status.md) — generated human-readable status view

**Roadmap & planning:**

- [`./roadmaps/sdk-productization.md`](./roadmaps/sdk-productization.md) — 4-phase productization plan and acceptance criteria

**Consumer docs** (different audience — SDK users, not implementers):

- [`apps/docs`](../apps/docs) — MDX-based quick-start, API reference, examples, guides

## Acceptance Criteria (Release)

- All 8 public packages publish via Changesets to npm
- Consumer docs deploy to GitHub Pages
- Release workflow runs without manual intervention
- All tests pass, no security alerts, no license conflicts
- ENGINEERING_WORKFLOW.md matches actual commands and behavior
- ARCHITECTURE_INTERNAL.md reflects current code boundaries
