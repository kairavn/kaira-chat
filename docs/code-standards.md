# Code Standards & Conventions

This document defines how code is written, tested, and organized across the monorepo.

## TypeScript & Type Safety

### Compiler Settings

- **Target:** ES2020
- **Module:** ESNext (Bundler resolution)
- **Strict mode:** enabled
- **Key flags:**
  - `noUncheckedIndexedAccess: true` — index access must be guarded
  - `isolatedModules: true` — each file is valid in isolation
  - `declaration: true` — generate `.d.ts` files
  - `declarationMap: true` — source map for declarations

Source: `tsconfig.base.json` (shared via `packages/typescript-config`)

### Public API Boundaries

Every package must define its public surface explicitly via **both**:

1. `package.json` `exports` field (entry points)
2. `src/index.ts` (what is actually exported)

Change both intentionally when modifying the public API.

**Example:**

```json
"exports": {
  ".": "./dist/index.js",
  "./types": "./dist/types/index.js"
}
```

## Code Organization

### File Naming

- **TypeScript/JavaScript:** kebab-case with descriptive purpose
  - `chat-engine.ts`, `connection-state-machine.ts`, `middleware-pipeline.test.ts`
  - Avoid: abbreviations, generic names like `utils.ts`
- **React components:** PascalCase (file name matches export)
  - `ChatProvider.tsx`, `MessageInput.tsx`
- **Test files:** same name + `.test.ts` or `.test.tsx`
  - `chat-engine.test.ts`, `ChatProvider.test.tsx`

### File Size

Keep individual code files under **200 lines**:

- Split large components into smaller focused units
- Extract utility functions into separate modules
- Use composition over inheritance for complex widgets
- Create dedicated service classes for business logic

**Exceptions:** configuration files, migration files, markdown/text files.

### Directory Structure

Organize by feature or domain, not by type:

```
packages/chat-core/src/
├── engine/
│   ├── chat-engine.ts
│   ├── chat-engine.test.ts
│   └── ...
├── event-bus/
│   ├── event-bus.ts
│   └── event-bus.test.ts
├── types/
│   ├── transport.ts
│   ├── storage.ts
│   └── ...
├── middleware/
│   ├── pipeline.ts
│   └── pipeline.test.ts
└── index.ts
```

## Linting & Formatting

### ESLint

- **Config:** Flat config (ESLint 9+) in `packages/eslint-config`
- **Rules:** Base + framework-specific (Next.js, React)
- **Plugins:** `typescript-eslint`, `eslint-plugin-only-warn` (warnings only)
- **Enforcement:** Pre-push hook via `pnpm validate`

Unused variables allowed if prefixed with `_`:

```ts
const _unused = value; // OK
const unused = value; // ESLint warning
```

### Prettier

- **Width:** 100 columns
- **Indent:** 2 spaces
- **Quotes:** single
- **Semicolons:** yes
- **Trailing commas:** all (ES2017+)
- **Import sort order:** `node` → `@kaira/*` → `@/` → relative

Config: `.prettierrc.js`

**Pre-commit hook via `lint-staged`:** Prettier runs on staged files automatically.

## Package Conventions

### Workspace Dependencies

**Local packages:** Use `workspace:*` in `package.json`

```json
"@kaira/chat-core": "workspace:*"
```

**External packages:** Pin versions and use `pnpm.overrides` for forced alignment:

```json
"react": "^19.2.5"  // in peerDependencies or dependencies
"react-dom": "^19.2.5"
```

Managed by `syncpack` (`.syncpackrc.json`). Run `pnpm deps:check` before commit.

### Build Output

Each package builds to `dist/`:

- **Format:** ESM + CommonJS
- **Targets:** ES2020
- **Tools:** `tsup` (bundler)
- **Output:** `dist/index.js` (main), `dist/index.d.ts` (types), `dist/index.js.map` (sourcemap)
- **Treeshake:** enabled

### Test Structure

- **Framework:** Vitest 4
- **Location:** `src/**/*.test.ts` or `.test.tsx`
- **Pattern:** Unit + focused integration tests
- **No `--runInBand`:** Vitest 4 handles concurrency well
- **Caching:** Turbo caches test results; re-run on code changes
- **Coverage:** `pnpm test` runs all Vitest suites

**Key rule:** Do not ignore failing tests; fix them follow recommendations.

## Validation & CI

### Pre-Commit

Runs via `simple-git-hooks`:

```bash
prettier --write <staged-files>
```

### Pre-Push

Runs full validation:

```bash
pnpm validate
# = deps:check && docs:status:check && lint && check-types && build && test
```

### CI Pipeline

Triggered on pull requests and pushes to `main`:

1. **deps:check** — Syncpack lint for dependency alignment
2. **docs:status:check** — Verify generated docs are in sync
3. **lint** — ESLint across all packages
4. **check-types** — TypeScript type checking
5. **build** — Full monorepo build via Turbo
6. **test** — All test suites

Failure in any step blocks merge.

## Safe Edit Boundaries & Caution Areas

### Boundary Rules

- **`packages/chat-core` is the engine:** It owns event semantics, storage integration, plugin lifecycle, middleware execution, and streaming helpers. Changes here affect all dependent packages. Use extra caution.
- **`apps/web` is demo-only:** Do not document demo-only paths as SDK guarantees. Treat demo behavior as implementation example, not contract.
- **`apps/docs` is consumer documentation only:** Do not use it as the source of truth for internal implementation status.

### Workspace Boundaries

**Public SDK surface (published to npm):**

- `packages/chat-core` (leaf, no deps on other @kaira/\*)
- `packages/chat-react`, `packages/chat-ui`, `packages/chat-devtools`
- `packages/chat-storage-indexeddb`, `packages/chat-transport-polling`, `packages/chat-transport-websocket`, `packages/chat-provider-dit`
- `packages/eslint-config`, `packages/typescript-config` (tooling)

**Internal (not published):**

- `apps/web` (demo app + DIT proxy)
- `apps/docs` (consumer docs)

Public package exports are defined by **both** `package.json` `exports` and `src/index.ts`. Change both intentionally.

### Generated and Build Artifacts to Avoid Editing

Do not hand-edit these unless the task is specifically about generated output:

- `packages/*/dist/**`
- `apps/web/.next/**`
- `apps/docs/.next/**` and `apps/docs/out/**`
- `apps/*/next-env.d.ts`
- `docs/implementation-status.md`
- `docs/feature-matrix.md`

### Use Extra Caution With

These are manually maintained or generated-adjacent files:

- `apps/docs/lib/search-data.ts` — committed generated search index for the docs app
- `pnpm-lock.yaml` — should move via dependency changes, not ad hoc edits

### Extra Caution Areas (Code Files)

These files implement core behavior and require careful changes:

- `packages/chat-core/src/engine/chat-engine.ts` — orchestrator
- `apps/web/lib/chat/server-chat-engine.ts` — server-side demo runtime
- `apps/web/lib/demo/client-runtime.ts` — browser-side demo runtime
- `apps/web/lib/demo/server/runtime-registry.ts` — demo registry and session management
- `.github/workflows/release.yml` — release automation

### Common Pitfalls

- `@kaira/chat-provider-dit` is a **concrete transport adapter**, not an `IProvider` implementation
- Built-in tool invocation transcript semantics are **out of scope** for the SDK. Use `custom` messages and consumer-owned renderers for provider-specific payloads
- The demo browser runtime is demo-scoped. Polling is the primary transport for most demos; WebSocket demo is the exception
- Streaming helper methods in `ChatEngine` are exercised by the local demo runtime, while the DIT-backed path remains polling-first
- `IProvider` remains a contract-only surface. `IStorage` is a core contract, but the repo now ships a first-party browser adapter (`IndexedDBStorage`)
- The docs app is authored MDX plus generated search data, not auto-generated from package exports or tests
- Package READMEs and docs examples can drift from runtime behavior

## Error Handling & Security

### Try-Catch Patterns

- Catch errors from async operations, DOM APIs, external libraries
- Log meaningful error context (do not swallow silently)
- For storage/transport, include state recovery options

**Example:**

```ts
try {
  await this.transport.send(message);
} catch (err) {
  console.error('Failed to send message:', err, { messageId: message.id });
  // Retry or emit error event to application
}
```

### Secrets Management

- **Never commit:** `.env`, `.env.local`, or any file with API keys
- **Server-side only:** `API_URL`, `X_API_KEY`, `X_API_ID` (in `apps/web`)
- **Client-safe:** `NEXT_PUBLIC_*` for demo identifiers only
- **Template:** `.env.example` documents expected keys

See [`./deployment-guide.md`](./deployment-guide.md) for full env var list and release workflow.

## Testing Standards

Tests are the primary evidence of working code. Vitest 4 is the test runner across all packages.

**Key conventions:**

- Test files live alongside source: `src/**/*.test.ts` or `.test.tsx`
- No `--runInBand` (Vitest 4 handles concurrency well); prefer file filtering
- Turbo caches test results; re-run automatically on code changes
- Run `pnpm test` to execute all Vitest suites

**What to test:**

- State transitions (machines, hooks, components)
- Event payloads (shape, required fields)
- Error paths (missing data, network failures)
- Integration points (engine ↔ storage, engine ↔ transport)
- Skip presentation-only rendering without logic

**Coverage expectations by surface:**

See [`./testing-strategy.md`](./testing-strategy.md) for full coverage expectations, validation guidance per change type, and what to validate before modifying key areas.

## Documentation Standards

### Code Comments

Write comments for **why**, not **what**:

**Good:**

```ts
// Dedupe based on server timestamp to handle out-of-order delivery
if (existingMessage && msg.timestamp <= existingMessage.timestamp) return;
```

**Avoid:**

```ts
// Check if timestamp is less than or equal
if (existingMessage && msg.timestamp <= existingMessage.timestamp) return;
```

### JSDoc

Use JSDoc for public exports:

```ts
/**
 * Register a renderer for a custom message content type.
 * @param contentType - Unique identifier (e.g., "custom:survey")
 * @param renderer - React component that renders the content
 */
export function registerRenderer(contentType: string, renderer: Component) { ... }
```

### README Files

Each package `README.md` should:

- Explain the package's purpose in one sentence
- List the main exports with brief descriptions
- Include a simple usage example
- Link to consumer docs or deeper guides

Keep READMEs short; link to `docs/` for detailed guidance.

## Related Documentation

**Implementation guidance:**

- [`./testing-strategy.md`](./testing-strategy.md) — coverage expectations by surface, validation gates per change type
- [`./deployment-guide.md`](./deployment-guide.md) — commands, env vars, release workflow
- [`./system-architecture.md`](./system-architecture.md) — runtime model and state machines
- [`./design-guidelines.md`](./design-guidelines.md) — design tenets and extensibility model

**Configuration:**

- `tsconfig.base.json` — TypeScript compiler options (shared)
- `packages/eslint-config` — ESLint rules (flat config, ESLint 9+)
- `.prettierrc.js` — Prettier formatting rules
- `.syncpackrc.json` — Dependency alignment rules
- `turbo.json` — Build orchestration and caching

## Quick Checklist

Before commit:

- [ ] Files under 200 lines (code files only)
- [ ] Kebab-case file names (no abbreviations)
- [ ] Public API: both `package.json` exports and `src/index.ts` updated
- [ ] `pnpm lint` passes (or run `pnpm format`)
- [ ] `pnpm check-types` passes
- [ ] Tests added/updated for behavior changes
- [ ] Comments explain **why**, not **what**
- [ ] No console.log or debugger statements (except demos)
- [ ] No secrets in code or commit messages

Before push:

- [ ] `pnpm validate` passes (full CI gate)
- [ ] Tests do not require `--runInBand` workarounds
- [ ] Commit message is clear and conventional (feat, fix, docs, chore)
