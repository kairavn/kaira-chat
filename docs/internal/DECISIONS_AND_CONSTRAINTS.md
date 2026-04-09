# Decisions and Constraints

This file records important implementation choices and limits that are visible in the current repo.

## Current runtime direction

- The public runtime is transport-first around `ITransport`, not provider-first. Evidence: `packages/chat-core/src/types/transport.ts`, `packages/chat-core/src/engine/chat-engine.ts`.
- Polling is the only first-party concrete transport in the repo. Evidence: `packages/chat-transport-polling/src/polling-transport.ts`.
- The DIT integration is routed through server-owned transport code in `apps/web`, with secrets kept server-side. Evidence: `apps/web/lib/chat/server-chat-engine.ts`, `apps/web/lib/chat/server-config.ts`, `apps/web/app/api/chat/messages/route.ts`.
- Streaming is modeled through explicit helper methods on `ChatEngine`, not through a built-in provider pipeline. Evidence: `packages/chat-core/src/engine/chat-engine.ts`.

## Extensibility constraints

- `IProvider` exists only as a type surface today. There is no concrete provider package or `ChatEngine` provider integration. Evidence: `packages/chat-core/src/types/provider.ts`.
- `IStorage` exists only as an injected contract. There is no first-party storage adapter package. Evidence: `packages/chat-core/src/types/storage.ts`, `packages/`.
- Plugin lifecycle support exists in core, but there are no first-party plugin packages. Evidence: `packages/chat-core/src/types/plugin.ts`, `packages/chat-core/src/engine/chat-engine.ts`, `packages/`.
- Middleware support exists in core, but there is no reusable middleware package in the repo. Evidence: `packages/chat-core/src/middleware/pipeline.ts`, `packages/`.

## Demo app constraints

- The browser runtime uses polling through `/api/chat/events`; it does not use SSE today. Evidence: `apps/web/lib/chat/engine.ts`, `apps/web/app/api/chat/events/route.ts`.
- The demo UI uses `demoConfig.chatroomId` directly. The conversation bootstrap route exists but is not wired into the main client flow. Evidence: `apps/web/components/chat/Chat.tsx`, `apps/web/app/api/chat/conversation/route.ts`.
- The demo UI shows "AI thinking" state, but the current DIT-backed path does not emit stream lifecycle events. Evidence: `apps/web/components/chat/Chat.tsx`, `packages/chat-react/src/useStreamingMessage.ts`, `apps/web/lib/chat/server-chat-engine.ts`.

## Docs and workflow constraints

- `apps/docs` is authored documentation, not a generated API reference from source code. Evidence: `apps/docs/app/**/*.mdx`.
- `apps/docs/lib/search-data.ts` is a committed generated artifact derived from manual docs content. Evidence: `apps/docs/lib/generate-search-data.ts`, `apps/docs/lib/search-data.ts`.
- Manual docs can drift from code. That risk applies to `apps/docs`, package READMEs, and internal docs. Code, config, and tests should stay primary.
- Release automation is configured but not currently live as checked in. Evidence: `.github/workflows/release.yml`, `.changeset/config.json`.

## Inferred constraints

Inferred: `apps/web/lib/chat/event-broker.ts` assumes a single-process server runtime because it uses an in-memory listener set without shared infrastructure.

Inferred: the SSE branch in `apps/web/app/api/chat/events/route.ts` is exploratory or future-facing because the repo contains no browser-side `EventSource` usage.

Inferred: package READMEs are drift-prone enough that future implementation work should verify examples against code before using them as a change guide.

See also:

- [ARCHITECTURE_INTERNAL.md](./ARCHITECTURE_INTERNAL.md)
- [AGENT_GUIDE.md](./AGENT_GUIDE.md)
- [ENGINEERING_WORKFLOW.md](./ENGINEERING_WORKFLOW.md)
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
