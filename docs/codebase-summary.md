# Codebase Summary

## Monorepo Layout

```
kaira-chat/
├── packages/                          # Public SDK + tooling
│   ├── chat-core/                     # Engine, events, contracts (leaf pkg)
│   ├── chat-react/                    # React provider + 9 hooks
│   ├── chat-ui/                       # Renderers, primitives, composer
│   ├── chat-devtools/                 # Runtime inspection panel
│   ├── chat-storage-indexeddb/        # Browser storage adapter
│   ├── chat-transport-polling/        # HTTP polling ITransport
│   ├── chat-transport-websocket/      # WebSocket ITransport
│   ├── chat-provider-dit/             # DIT transport adapter
│   ├── eslint-config/                 # Shared ESLint rules (flat config, ESLint 9+)
│   └── typescript-config/             # Shared tsconfig.base.json
├── apps/
│   ├── web/                           # Next.js demo app + DIT proxy
│   └── docs/                          # Consumer docs site (static export)
├── docs/
│   ├── roadmaps/                      # Milestone planning
│   ├── code-standards.md              # Implementation conventions & validation rules
│   ├── system-architecture.md         # Runtime model & data flow
│   ├── design-guidelines.md           # Design tenets & rationale
│   ├── deployment-guide.md            # Release & deployment processes
│   ├── testing-strategy.md            # Test coverage expectations
│   ├── feature-status.json            # Feature & surface tracking (canonical)
│   ├── implementation-status.md       # Generated human-readable status
│   └── feature-matrix.md              # Generated quick-scan summary
├── .github/
│   └── workflows/                     # CI, docs deploy, release automation
├── .changeset/                        # Changesets config
├── turbo.json                         # Monorepo build orchestration
├── .syncpackrc.json                   # Dependency alignment rules
└── pnpm-workspace.yaml               # pnpm workspaces config
```

## Package Roles

### Core Runtime

**`packages/chat-core`** (4.7 KB, 40K lines test)

- `ChatEngine` — main orchestrator: transport wiring, storage, events, plugins, middleware
- `EventBus` — typed event dispatch + custom namespaced events
- State machines: `ConnectionStateMachine` (5 states), `ConversationStateMachine`
- `MessageRegistry` — message type resolution
- `MiddlewarePipeline` — ordered middleware execution
- `ChatSerializer` — JSON (de)serialization with fallback
- `TypingStateStore` — ephemeral conversation-scoped typing
- Contracts: `ITransport`, `IStorage`, `IProvider`, `IPlugin`, `IMiddleware`
- No dependencies on other `@kaira/*` packages

### React Bindings

**`packages/chat-react`** (depends on `chat-core`)

- `ChatProvider` — injects engine, manages lifecycle
- 9 hooks: `useMessages`, `useConnectionState`, `useSendMessage`, `useStreamingMessage`, `useOptimisticMessages`, `useTypingState`, `useTypingParticipants`, `useIsTyping`, `useTypingController`
- Tests use `@testing-library/react` + jsdom

### UI & Components

**`packages/chat-ui`** (depends on `chat-core`)

- `RendererRegistry` — pluggable content renderers
- 7 built-in renderers: Text, TextStream, Audio, Image, Video, File, Location
- `TypingIndicator` — animated participant presence
- `ThinkingIndicator` — thinking state visualization
- `MessageInput` — composer with draft/blur events
- Provider-specific payloads remain out of scope (consumer renderers)

**`packages/chat-devtools`** (depends on `chat-core`, `chat-react`)

- `ChatDevTools` — runtime inspection UI
- Ring buffer for event history
- Tabs: events, transport, middleware, plugins, streams
- `useChatDevTools` hook for integration

### Storage & Transport Adapters

**`packages/chat-storage-indexeddb`** (depends on `chat-core`, `idb`)

- `IndexedDBStorage` — browser-first adapter with lazy DB open, serializer-backed records, pagination
- `MemoryStorage` — fallback when IndexedDB unavailable
- Uses `idb` v8; `fake-indexeddb` for tests

**`packages/chat-transport-polling`** (depends on `chat-core`)

- `PollingTransport` — pluggable `PollEventsFn` / `SendEventFn`
- Reconnect + exponential backoff
- No provider-specific coupling

**`packages/chat-transport-websocket`** (depends on `chat-core`)

- `WebSocketTransport` — configurable frame parsing, serialization, lifecycle handling
- `BrowserWebSocketAdapter` — pluggable WebSocket factory
- Reconnect behavior

**`packages/chat-provider-dit`** (depends on `chat-core`, `chat-transport-polling`)

- `DitTransport` — extends `PollingTransport` for DIT backend
- History pagination, message mapping
- Server-side secrets kept in `apps/web`

### Tooling

**`packages/eslint-config`** (flat config, ESLint 9+)

- Base rules, Next.js rules, React-internal rules, React-library rules
- Prettier integration, typescript-eslint
- `eslint-plugin-only-warn` (warnings only)
- Unused vars allowed if `_`-prefixed

**`packages/typescript-config`**

- Base: strict mode, ES2020 target, ESNext modules, Bundler resolution
- Features: `noUncheckedIndexedAccess`, `isolatedModules`, declaration + source maps
- 8 `@kaira/*` path aliases

### Demo Apps

**`apps/web`** (Next.js 16.2.4, port 3000, App Router)

- Client runtime: `DemoRuntimeProvider`, per-demo polling + IndexedDB persistence
- Server runtime: `ServerChatEngine`, registry of local + DIT demos
- Routes: `/dit-modive`, `/websocket`, `/streaming`, `/next-backend`, `/persistence`, `/media`
- API routes: 20 endpoints across `/api/chat/*` and `/api/demos/[demoId]/*`
- DIT proxy: server-side engine wrapper, secrets server-only
- SSE bridge: demo events route supports polling + streaming via EventSource
- WebSocket demo: sibling-port bridge (`localhost:3021`) for transport showcase

**`apps/docs`** (Next.js 16.2.4, port 3001, static export)

- MDX-based consumer documentation
- Tailwind 4.2, geist, lucide-react, rehype-pretty-code + Shiki
- 13 sections: quick-start, architecture, core-api, React, transport, storage, plugins, middleware, events, structure, UI, streaming, devtools, components, examples
- No `@kaira/*` dependencies
- Output: `out/` directory
- Configurable `basePath` via `NEXT_PUBLIC_BASE_PATH` or derived from `NEXT_PUBLIC_DOCS_BASE_URL`
- Search index: `search-data.ts` (committed generated artifact, tested)

## Key Tooling & Conventions

| Tool                 | Role                                                                  | Config                                                                         |
| -------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **TypeScript**       | strict + ES2020, declaration + source maps                            | `tsconfig.base.json`, `packages/typescript-config`                             |
| **ESLint**           | flat config (v9+), typescript-eslint, Prettier                        | `packages/eslint-config`                                                       |
| **Prettier**         | 100 cols, 2-space, single quotes, semicolons, trailing commas         | `.prettierrc.js`, sort-imports order: node → @kaira → @/ → relative            |
| **Turbo**            | build orchestration, 20 env vars exposed                              | `turbo.json` (build depends on ^build, lint, check-types, dev/test persistent) |
| **pnpm**             | workspaces, v9.0.0, Node >=18, React ^19.2.5 override                 | `pnpm-workspace.yaml`, `.pnpmrc`                                               |
| **Changesets**       | release mechanism, public access, ignores docs + web                  | `.changeset/config.json`                                                       |
| **Syncpack**         | dependency alignment (local packages: `workspace:*`, React peer >=19) | `.syncpackrc.json`                                                             |
| **Vitest**           | test runner, Turbo cached, no `--runInBand` (Vitest 4)                | per-package `vitest.config.ts`                                                 |
| **simple-git-hooks** | pre-commit: prettier via lint-staged; pre-push: `pnpm validate`       | `package.json`                                                                 |

## Build & Release

**Per-package build:** `tsup` (ESM + CJS, dts, sourcemap, treeshake, es2020, externals)

**Publish:** Changesets via `.github/workflows/release.yml`

- Trigger: push to `main`
- Requires: `NPM_TOKEN` + `GITHUB_TOKEN` repo secrets
- Flow: validate → changesets/action → npm publish

**Docs deploy:** GitHub Pages via `.github/workflows/deploy-docs-pages.yml`

**Validation gate:** `pnpm validate` = deps:check + docs:status:check + lint + check-types + build + test

## Data Flow & Runtime

**Browser runtime:**

1. Demo route loads `DemoRuntimeProvider`
2. Creates per-demo `ChatEngine` with `PollingTransport` + `IndexedDBStorage`
3. Polls `/api/demos/[demoId]/events` for messages/typing
4. Stream-capable demos consume SSE side-channel from same endpoint
5. WebSocket demo uses `WebSocketTransport` to sibling-port bridge instead

**Server runtime (demo mode):**

1. `RuntimeRegistry` (singleton, 1-hour TTL per session)
2. Route handler boots conversation, streams to `/api/demos/[demoId]/events`
3. Local demos use in-memory `ChatEngine`; DIT demo uses `DitTransport`
4. Polling client bridges events; SSE handles stream lifecycle

**DIT integration (proxy mode):**

1. Server owns `API_URL`, `X_API_KEY`, `X_API_ID`
2. `DitTransport` extends `PollingTransport`
3. Secrets never exposed to browser
4. Client connects via Next.js API route

## Public Boundaries & Scope Rules

Public package surfaces are defined by **both**:

- `packages/*/package.json` `exports` field (entry points)
- `packages/*/src/index.ts` (actual exports)

Change both intentionally when modifying public API.

**Scope rules:**

- Public SDK surfaces: 8 packages with npm `@kaira/*` scope, published via Changesets
- `apps/web` is an **internal demo app and proxy layer only** — do not treat demo behavior as SDK guarantees
- `apps/docs` is **consumer documentation only** — do not use as implementation status source
- Generated artifacts (`dist/`, `.next/`, `out/`) are not authoritative implementation sources
- `apps/docs/lib/search-data.ts` is a committed generated artifact derived from MDX content

**Source of truth order** (use when docs and code disagree):

1. Code, package manifests, route handlers, tests, workflow config
2. `docs/feature-status.json` and generated top-level docs
3. `apps/docs` consumer documentation
4. Package and app `README.md` files

## Related Detailed Documentation

For deeper understanding of design decisions and runtime mechanics:

- [`./design-guidelines.md`](./design-guidelines.md) — transport-first rationale and extensibility tenets
- [`./system-architecture.md`](./system-architecture.md) — runtime model, state machines, data flow, demo split
- [`./code-standards.md`](./code-standards.md) — implementation conventions, validation rules, safe edit boundaries
- [`./deployment-guide.md`](./deployment-guide.md) — release & deployment workflows
- [`./testing-strategy.md`](./testing-strategy.md) — coverage expectations by surface
- [`./roadmaps/sdk-productization.md`](./roadmaps/sdk-productization.md) — 4-phase productization plan

## Quick Facts

- **Node:** >=18
- **pnpm:** 9.0.0
- **React:** ^19.2.5 (enforced via override)
- **TypeScript:** 5.9.3 (strict)
- **Public packages:** 8 (all npm `@kaira/*`)
- **Features tracked:** 47 (9 categories, status system in JSON)
- **Tests:** Vitest 4, per-surface unit + integration suites
- **Release:** Changesets-only, npm token required
