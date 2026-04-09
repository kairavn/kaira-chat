# Testing Strategy

This file describes the current automated coverage and the practical validation expected for future changes.

## Current coverage by surface

| Surface                         | Current coverage                     | Evidence                                                                     |
| ------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| `@kaira/chat-core`              | strong unit coverage                 | `packages/chat-core/src/**/*.test.ts`, `packages/chat-core/vitest.config.ts` |
| `@kaira/chat-transport-polling` | targeted behavioral coverage         | `packages/chat-transport-polling/src/polling-transport.test.ts`              |
| `@kaira/chat-provider-dit`      | targeted adapter and parser coverage | `packages/chat-provider-dit/src/dit-transport.test.ts`                       |
| `@kaira/chat-react`             | no automated coverage                | `packages/chat-react/package.json`                                           |
| `@kaira/chat-ui`                | no automated coverage                | `packages/chat-ui/package.json`                                              |
| `@kaira/chat-devtools`          | no automated coverage                | `packages/chat-devtools/package.json`                                        |
| `apps/web`                      | no automated coverage                | no test files under `apps/web`                                               |
| `apps/docs`                     | no automated coverage                | no test files under `apps/docs`                                              |

## Weakly tested or untested areas

- React hook behavior, provider lifecycle, and optimistic UI logic
- UI primitive behavior and default renderer coverage beyond core render paths
- Devtools state capture and private-internals inspection behavior
- Demo app API routes, server singleton runtime, and browser-server integration
- Docs navigation and docs search index drift

## Practical validation guidance

### Core runtime changes

When changing `packages/chat-core`:

- run `pnpm lint`
- run `pnpm check-types`
- run `pnpm test`
- run `pnpm build`

Pay special attention to:

- event payload compatibility
- transport dedupe behavior
- storage integration semantics
- middleware and plugin lifecycle ordering
- stream helper behavior

### Transport or adapter changes

When changing `packages/chat-transport-polling` or `packages/chat-provider-dit`:

- run `pnpm test`
- run `pnpm build`
- re-check any affected `chat-core` assumptions if transport event shapes changed

### React, UI, or devtools changes

When changing `packages/chat-react`, `packages/chat-ui`, or `packages/chat-devtools`:

- run `pnpm lint`
- run `pnpm check-types`
- run `pnpm build`
- if behavior is non-trivial, add tests for logic-heavy hooks or runtime state rather than presentation-only output

Current repo policy should continue to favor high-signal tests over presentational component tests.

### Demo app changes

When changing `apps/web`:

- run `pnpm lint`
- run `pnpm check-types`
- run `pnpm build`
- if local env is available, run `pnpm dev:web` and exercise the chat flow plus affected API routes

Validate these paths when relevant:

- `/api/chat/messages`
- `/api/chat/events`
- `/api/chat/conversation`

### Docs changes

When changing `apps/docs` or internal docs:

- run `pnpm lint`
- run `pnpm check-types`
- run `pnpm build`
- verify that `apps/docs/lib/search-data.ts` still matches the authored docs pages if MDX content changed

## What to validate before modifying key areas

- Core runtime: event contracts, message lifecycle, storage integration, streaming helpers
- React runtime: provider lifecycle, hook assumptions, optimistic reconciliation
- UI/renderers: unsupported message types, fallback behavior, default renderer coverage
- Demo app: client polling behavior, server proxy behavior, env expectations, demo-only assumptions
- Docs: authored content drift, generated search index drift, consumer-vs-internal docs separation

See also:

- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- [FEATURE_MATRIX.md](./FEATURE_MATRIX.md)
- [ENGINEERING_WORKFLOW.md](./ENGINEERING_WORKFLOW.md)
