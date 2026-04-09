# Internal Architecture

This document describes the current repository shape and runtime boundaries as reflected by code and config.

## Monorepo structure

| Area                | Role                                                                           | Key paths                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public SDK packages | Runtime, React bindings, UI, devtools, and concrete adapters                   | `packages/chat-core`, `packages/chat-react`, `packages/chat-ui`, `packages/chat-devtools`, `packages/chat-transport-polling`, `packages/chat-provider-dit` |
| Internal demo app   | Next.js app that proxies the DIT-backed runtime for internal use               | `apps/web`                                                                                                                                                 |
| Consumer docs app   | Static-export Next.js docs site for SDK consumers                              | `apps/docs`                                                                                                                                                |
| Tooling             | Root scripts, Turbo, Syncpack, Changesets, ESLint, TS config, GitHub workflows | `package.json`, `turbo.json`, `.syncpackrc.json`, `.changeset`, `.github/workflows`, `packages/eslint-config`, `packages/typescript-config`                |
| Internal docs       | Implementation guidance, status tracking, and repo safety notes                | `docs/internal`                                                                                                                                            |

## Public SDK boundaries

Public package surfaces are defined by both:

- `packages/*/package.json` `exports`
- `packages/*/src/index.ts`

Current package roles:

| Package                         | Role                                                              | Depends on                                          |
| ------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| `@kaira/chat-core`              | Base runtime, contracts, state machines, serialization, event bus | none                                                |
| `@kaira/chat-react`             | React provider and hooks over `ChatEngine`                        | `@kaira/chat-core`                                  |
| `@kaira/chat-ui`                | Renderer registry and UI primitives                               | `@kaira/chat-core`                                  |
| `@kaira/chat-devtools`          | Runtime inspection panel for React apps                           | `@kaira/chat-core`, `@kaira/chat-react`             |
| `@kaira/chat-transport-polling` | Concrete polling transport                                        | `@kaira/chat-core`                                  |
| `@kaira/chat-provider-dit`      | DIT-specific transport adapter built on polling                   | `@kaira/chat-core`, `@kaira/chat-transport-polling` |

Important boundary: `@kaira/chat-provider-dit` is a concrete transport adapter package, not a concrete `IProvider` implementation.

## Demo app runtime split

Client-side runtime:

- `apps/web/lib/chat/engine.ts`
- `apps/web/components/chat/*`
- `apps/web/lib/chat/renderers.ts`
- `apps/web/config/demo.ts`

Server-side runtime:

- `apps/web/lib/chat/server-chat-engine.ts`
- `apps/web/lib/chat/server-config.ts`
- `apps/web/lib/chat/event-broker.ts`
- `apps/web/app/api/chat/events/route.ts`
- `apps/web/app/api/chat/messages/route.ts`
- `apps/web/app/api/chat/conversation/route.ts`

Current runtime flow:

1. The browser creates a singleton `ChatEngine` in `apps/web/lib/chat/engine.ts`.
2. That engine uses `PollingTransport` and calls Next.js API routes instead of talking to DIT directly.
3. The server creates its own singleton `ChatEngine` in `apps/web/lib/chat/server-chat-engine.ts`.
4. The server engine uses `DitTransport`, which wraps polling and talks to the DIT backend.
5. Demo UI components read client-side engine state through `@kaira/chat-react` hooks and render via `@kaira/chat-ui`.

## Runtime and data flow

Core runtime:

- `ChatEngine` wires event bus, middleware pipeline, state machines, optional transport, optional storage, and plugin lifecycle.
- Inbound transport messages are deduplicated and stored before `message:received`.
- Outbound messages are created in core, passed through middleware, optionally sent over transport, then marked `sent`.
- Stream lifecycle is helper-driven through `emitStreamStart`, `emitStreamChunk`, `emitStreamEnd`, and `emitStreamError`.

Demo runtime:

- Browser polling path: `apps/web/lib/chat/engine.ts`
- Server DIT path: `apps/web/lib/chat/server-chat-engine.ts`
- Route bridge: `apps/web/app/api/chat/*`

Important boundary: the browser demo currently polls JSON from `/api/chat/events`; SSE exists server-side but is not used by the main client runtime.

## Docs and workflow boundaries

Source-backed or source-adjacent:

- package exports and manifests
- tests under `packages/chat-core/src/**/*.test.ts`
- adapter tests in `packages/chat-transport-polling` and `packages/chat-provider-dit`
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

Inferred: `apps/web/app/api/chat/events/route.ts` exposes an SSE path, but it is currently latent in normal demo usage because the browser runtime does not use `EventSource`.

See also:

- [README.md](./README.md)
- [AGENT_GUIDE.md](./AGENT_GUIDE.md)
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- [DECISIONS_AND_CONSTRAINTS.md](./DECISIONS_AND_CONSTRAINTS.md)
