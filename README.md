# Kaira Chat SDK Monorepo

TypeScript and React monorepo for the Kaira chat SDK, an internal demo app, and a consumer-facing docs app.

## Public SDK packages

- `@kaira/chat-core` - core engine, event system, state machines, serialization, and public contracts.
- `@kaira/chat-react` - React context and hooks over `ChatEngine`.
- `@kaira/chat-ui` - renderer registry and basic chat UI primitives.
- `@kaira/chat-devtools` - runtime inspection panel for React integrations.
- `@kaira/chat-storage-indexeddb` - browser-first IndexedDB `IStorage` adapter with in-memory fallback.
- `@kaira/chat-transport-polling` - concrete polling-based `ITransport`.
- `@kaira/chat-transport-websocket` - concrete WebSocket-based `ITransport`.
- `@kaira/chat-provider-dit` - DIT-specific transport adapter built on polling.

## Workspace apps

- `apps/docs` - consumer-facing SDK documentation site.
- `apps/web` - internal demo app and Next.js proxy layer for the DIT-backed runtime.

## Internal docs

- [Internal docs index](./docs/internal/README.md)
- [Agent guide](./docs/internal/AGENT_GUIDE.md)
- [Implementation status](./docs/internal/IMPLEMENTATION_STATUS.md)

## Quick start

```sh
pnpm install
pnpm dev
```

Common commands:

```sh
pnpm dev:web
pnpm dev:docs
pnpm lint
pnpm check-types
pnpm test
pnpm build
pnpm validate
```

## Workflow notes

- Source of truth order: code/config/tests/workflows first, then `docs/internal`, then `apps/docs`, then README files.
- Consumer documentation lives in `apps/docs`. Do not use it as the source of truth for internal implementation status.
- Internal implementation guidance, status tracking, and repo safety notes live in `docs/internal/`.
- Contribution, dependency, and release process notes live in [CONTRIBUTING.md](./CONTRIBUTING.md) and [docs/internal/ENGINEERING_WORKFLOW.md](./docs/internal/ENGINEERING_WORKFLOW.md).

## License

MIT
