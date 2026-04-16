# Internal Architecture

This document describes the current repository shape and runtime boundaries as reflected by code and config.

## Monorepo structure

| Area                | Role                                                                           | Key paths                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public SDK packages | Runtime, React bindings, UI, devtools, and concrete adapters                   | `packages/chat-core`, `packages/chat-react`, `packages/chat-ui`, `packages/chat-devtools`, `packages/chat-storage-indexeddb`, `packages/chat-transport-polling`, `packages/chat-transport-websocket`, `packages/chat-provider-dit` |
| Internal demo app   | Next.js showcase app with DIT-backed and local server-owned demo runtimes      | `apps/web`                                                                                                                                                                                                                         |
| Consumer docs app   | Static-export Next.js docs site for SDK consumers                              | `apps/docs`                                                                                                                                                                                                                        |
| Tooling             | Root scripts, Turbo, Syncpack, Changesets, ESLint, TS config, GitHub workflows | `package.json`, `turbo.json`, `.syncpackrc.json`, `.changeset`, `.github/workflows`, `packages/eslint-config`, `packages/typescript-config`                                                                                        |
| Internal docs       | Implementation guidance, status tracking, and repo safety notes                | `docs/internal`                                                                                                                                                                                                                    |

## Public SDK boundaries

Public package surfaces are defined by both:

- `packages/*/package.json` `exports`
- `packages/*/src/index.ts`

Current package roles:

| Package                           | Role                                                              | Depends on                                          |
| --------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| `@kaira/chat-core`                | Base runtime, contracts, state machines, serialization, event bus | none                                                |
| `@kaira/chat-react`               | React provider and hooks over `ChatEngine`                        | `@kaira/chat-core`                                  |
| `@kaira/chat-ui`                  | Renderer registry and UI primitives                               | `@kaira/chat-core`                                  |
| `@kaira/chat-devtools`            | Runtime inspection panel for React apps                           | `@kaira/chat-core`, `@kaira/chat-react`             |
| `@kaira/chat-storage-indexeddb`   | Browser-first IndexedDB storage adapter                           | `@kaira/chat-core`, `idb`                           |
| `@kaira/chat-transport-polling`   | Concrete polling transport                                        | `@kaira/chat-core`                                  |
| `@kaira/chat-transport-websocket` | Concrete WebSocket transport                                      | `@kaira/chat-core`                                  |
| `@kaira/chat-provider-dit`        | DIT-specific transport adapter built on polling                   | `@kaira/chat-core`, `@kaira/chat-transport-polling` |

Important boundary: `@kaira/chat-provider-dit` is a concrete transport adapter package, not a concrete `IProvider` implementation.

## Demo app runtime split

Client-side runtime:

- `apps/web/lib/demo/client-runtime.ts`
- `apps/web/components/demo/DemoRuntimeProvider.tsx`
- `apps/web/components/chat/*`
- `apps/web/lib/chat/renderers.ts`
- `apps/web/config/demo-registry.ts`
- `apps/web/config/dit-demo.ts`

Server-side runtime:

- `apps/web/lib/chat/server-chat-engine.ts`
- `apps/web/lib/chat/server-config.ts`
- `apps/web/lib/chat/event-broker.ts`
- `apps/web/lib/demo/server/runtime-registry.ts`
- `apps/web/app/api/demos/[demoId]/*`
- `apps/web/app/api/chat/*`

Current runtime flow:

1. The catalog and route metadata come from `apps/web/config/demo-registry.ts`.
2. Each demo route creates its own browser runtime through `apps/web/lib/demo/client-runtime.ts`.
3. Browser runtimes use `PollingTransport` against `app/api/demos/[demoId]/*` and persist locally with `IndexedDBStorage`. Exception: the `websocket` demo uses `WebSocketTransport` against a sibling-port bridge (`localhost:3021`) instead of polling for message and typing traffic.
4. Local demos use a server-owned `ChatEngine` plus a local in-memory transport to emit assistant messages, typing, and stream lifecycle events.
5. The DIT demo keeps its existing server-owned `DitTransport` path in `apps/web/lib/chat/server-chat-engine.ts`.
6. Stream-capable demos use the SSE branch of the events route to bridge `message:stream:*` events into the browser runtime, while final assistant messages still arrive over the normal polling path.
7. The `websocket` demo WebSocket bridge is started at server boot via `apps/web/instrumentation.ts` and lives in `apps/web/lib/demo/server/demo-websocket-server.ts`.

## Runtime and data flow

Core runtime:

- `ChatEngine` wires event bus, middleware pipeline, state machines, optional transport, optional storage, and plugin lifecycle.
- Inbound transport messages are deduplicated and stored before `message:received`.
- Outbound messages are created in core, passed through middleware, optionally sent over transport, then marked `sent`.
- Stream lifecycle is helper-driven through `emitStreamStart`, `emitStreamChunk`, `emitStreamEnd`, and `emitStreamError`.

Demo runtime:

- Browser demo runtime: `apps/web/lib/demo/client-runtime.ts`
- Server DIT runtime: `apps/web/lib/chat/server-chat-engine.ts`
- Server local runtime registry: `apps/web/lib/demo/server/runtime-registry.ts`
- Route bridge: `apps/web/app/api/demos/[demoId]/*`

Important boundary: the public SDK now includes first-party polling and WebSocket transports, but the demo browser runtime in `apps/web` remains polling-first for messages and typing. SSE is used only as a side channel for streamed AI lifecycle events in the local streaming demos, and correctness no longer depends on SSE completion delivery.

## Docs and workflow boundaries

Source-backed or source-adjacent:

- package exports and manifests
- tests under `packages/chat-core/src/**/*.test.ts`
- adapter tests in `packages/chat-transport-polling`, `packages/chat-transport-websocket`, and `packages/chat-provider-dit`
- workflow files in `.github/workflows`
- internal status inventory in `docs/internal/feature-status.json`

Manual or authored:

- `apps/docs/app/**/*.mdx`
- package and app `README.md` files
- manual internal docs under `docs/internal/*.md`

Generated from authored content, not runtime code:

- `apps/docs/lib/search-data.ts` from `apps/docs/lib/generate-search-data.ts`
- `docs/internal/IMPLEMENTATION_STATUS.md` from `docs/internal/feature-status.json`
- `docs/internal/FEATURE_MATRIX.md` from `docs/internal/feature-status.json`

## Inferred boundaries

Inferred: `apps/web/lib/chat/event-broker.ts` is an in-memory fan-out layer for one server process. There is no shared broker, queue, or external pub/sub in the repo.

Inferred: the showcase assumes a single Node process. The SSE bridge improves
local stream demos but does not change the process-local event broker boundary.

See also:

- [README.md](./README.md)
- [AGENT_GUIDE.md](./AGENT_GUIDE.md)
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- [DECISIONS_AND_CONSTRAINTS.md](./DECISIONS_AND_CONSTRAINTS.md)
