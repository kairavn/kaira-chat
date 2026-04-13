# Decisions and Constraints

This file records important implementation choices and limits that are visible in the current repo.

## Current runtime direction

- The public runtime is transport-first around `ITransport`, not provider-first. Evidence: `packages/chat-core/src/types/transport.ts`, `packages/chat-core/src/engine/chat-engine.ts`.
- Polling is the only first-party concrete transport in the repo. Evidence: `packages/chat-transport-polling/src/polling-transport.ts`.
- The DIT integration is routed through server-owned transport code in `apps/web`, with secrets kept server-side. Evidence: `apps/web/lib/chat/server-chat-engine.ts`, `apps/web/lib/chat/server-config.ts`, `apps/web/app/api/chat/messages/route.ts`.
- Streaming is modeled through explicit helper methods on `ChatEngine`, not through a built-in provider pipeline. Evidence: `packages/chat-core/src/engine/chat-engine.ts`.

## Extensibility constraints

- `IProvider` exists only as a type surface today. There is no concrete provider package or `ChatEngine` provider integration. Evidence: `packages/chat-core/src/types/provider.ts`.
- `IStorage` remains an injected contract in core, and the repo now includes a first-party browser adapter in `@kaira/chat-storage-indexeddb`. Evidence: `packages/chat-core/src/types/storage.ts`, `packages/chat-storage-indexeddb/src/IndexedDBStorage.ts`.
- Plugin lifecycle support exists in core, but there are no first-party plugin packages. Evidence: `packages/chat-core/src/types/plugin.ts`, `packages/chat-core/src/engine/chat-engine.ts`, `packages/`.
- Middleware support exists in core, but there is no reusable middleware package in the repo. Evidence: `packages/chat-core/src/middleware/pipeline.ts`, `packages/`.

## Demo app constraints

- The browser runtime is demo-scoped and route-handler-backed. Polling remains the primary transport, while stream lifecycle updates can also be consumed through demo SSE endpoints. Evidence: `apps/web/lib/demo/client-runtime.ts`, `apps/web/app/api/demos/[demoId]/events/route.ts`, `apps/web/components/demo/StreamEventBridge.tsx`.
- Demo routing is registry-driven so the showcase can expose multiple isolated runtimes without one global engine in the root layout. Evidence: `apps/web/config/demo-registry.ts`, `apps/web/components/demo/DemoRuntimeProvider.tsx`, `apps/web/app/page.tsx`.
- The DIT demo remains env-gated, but missing DIT config no longer prevents the rest of `apps/web` from booting. Evidence: `apps/web/config/dit-demo.ts`, `apps/web/lib/chat/server-config.ts`, `apps/web/app/dit-modive/page.tsx`.
- Local demos exercise stream lifecycle events, typing indicators, seeded media content, and persistence flows without depending on DIT. Evidence: `apps/web/lib/demo/server/runtime-registry.ts`, `apps/web/components/chat/ChatSurface.tsx`, `apps/web/components/demo/PersistenceDemo.tsx`.

## Docs and workflow constraints

- `apps/docs` is authored documentation, not a generated API reference from source code. Evidence: `apps/docs/app/**/*.mdx`.
- `apps/docs/lib/search-data.ts` is a committed generated artifact derived from manual docs content. Evidence: `apps/docs/lib/generate-search-data.ts`, `apps/docs/lib/search-data.ts`.
- Manual docs can drift from code. That risk applies to `apps/docs`, package READMEs, and internal docs. Code, config, and tests should stay primary.
- Release automation is configured but not currently live as checked in. Evidence: `.github/workflows/release.yml`, `.changeset/config.json`.

## Inferred constraints

Inferred: `apps/web/lib/chat/event-broker.ts` assumes a single-process server runtime because it uses an in-memory listener set without shared infrastructure.

Inferred: `apps/web/lib/chat/event-broker.ts` still assumes a single-process server runtime for both polling and SSE fan-out because it remains in-memory and process-local.

Inferred: package READMEs are drift-prone enough that future implementation work should verify examples against code before using them as a change guide.

See also:

- [ARCHITECTURE_INTERNAL.md](./ARCHITECTURE_INTERNAL.md)
- [AGENT_GUIDE.md](./AGENT_GUIDE.md)
- [ENGINEERING_WORKFLOW.md](./ENGINEERING_WORKFLOW.md)
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
