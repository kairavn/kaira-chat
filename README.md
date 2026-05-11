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

## Documentation

- [Project overview & PDR](./docs/project-overview-pdr.md) — mission, scope, packages, acceptance criteria
- [Design guidelines](./docs/design-guidelines.md) — transport-first rationale, extensibility model
- [System architecture](./docs/system-architecture.md) — runtime model, state machines, data flow
- [Code standards](./docs/code-standards.md) — conventions, safe edit boundaries, validation rules
- [Testing strategy](./docs/testing-strategy.md) — coverage expectations, validation by surface
- [Deployment guide](./docs/deployment-guide.md) — release, CI/CD, environment setup
- [Implementation status](./docs/implementation-status.md) — generated feature status view (see feature-status.json)
- [Codebase summary](./docs/codebase-summary.md) — monorepo layout and package roles

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

**Source of truth order** (use when docs and code disagree):

1. Code, package manifests, route handlers, tests, workflow config
2. Top-level docs (`docs/*.md`) and feature-status.json
3. Consumer docs in `apps/docs`
4. Package and app `README.md` files

**Documentation hierarchy:**

- **Consumer docs** (`apps/docs`): for SDK users and integrators
- **Implementation docs** (`docs/`): for engineers and agents working in the monorepo
- **Contribution & release**: [CONTRIBUTING.md](./CONTRIBUTING.md) and [deployment-guide.md](./docs/deployment-guide.md)

## License

MIT
