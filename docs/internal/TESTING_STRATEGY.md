# Testing Strategy

This file describes the current automated coverage and the practical validation expected for future changes.

## Current coverage by surface

| Surface                         | Current coverage                                  | Evidence                                                                                          |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `@kaira/chat-core`              | strong unit coverage                              | `packages/chat-core/src/**/*.test.ts`, `packages/chat-core/vitest.config.ts`                      |
| `@kaira/chat-transport-polling` | targeted behavioral coverage                      | `packages/chat-transport-polling/src/polling-transport.test.ts`                                   |
| `@kaira/chat-provider-dit`      | targeted adapter and parser coverage              | `packages/chat-provider-dit/src/dit-transport.test.ts`                                            |
| `@kaira/chat-react`             | focused hook and provider coverage                | `packages/chat-react/src/chat-context.test.tsx`, `packages/chat-react/src/useChatHooks.test.tsx`  |
| `@kaira/chat-ui`                | focused renderer and composer coverage            | `packages/chat-ui/src/default-renderers.test.tsx`, `packages/chat-ui/src/MessageInput.test.tsx`   |
| `@kaira/chat-devtools`          | focused runtime inspection coverage               | `packages/chat-devtools/src/useChatDevTools.test.tsx`                                             |
| `apps/web`                      | targeted route, runtime, and integration coverage | `apps/web/app/api/**/*.test.ts`, `apps/web/lib/**/*.test.ts`, `apps/web/components/**/*.test.tsx` |
| `apps/docs`                     | lightweight search-integrity coverage             | `apps/docs/lib/generate-search-data.test.ts`                                                      |

## Weakly tested or untested areas

- Remaining React/UI edge cases outside the current high-signal hook and primitive suites
- Deeper renderer coverage beyond the current fallback and composer-focused paths
- Demo app API routes, server singleton runtime, and browser-server integration
- Broader docs navigation coverage beyond the current search index integrity checks

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
- run `pnpm test --filter web` or `pnpm --filter web test`
- run `pnpm build`
- if local env is available, run `pnpm dev:web` and exercise the chat flow plus affected API routes

Validate these paths when relevant:

- `/api/chat/messages`
- `/api/chat/events`
- `/api/chat/conversation`

High-signal coverage should stay focused on route behavior, runtime integration,
and critical demo flows. The persistence demo now has a dedicated jsdom
integration test in `apps/web/components/demo/PersistenceDemo.test.tsx` that
verifies the selected thread restores after a simulated reload without leaking
another thread's seeded history into the restored view.

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
