# Agent Guide

Use this file when making implementation changes in this monorepo. It is intentionally internal and operational.

## Source-of-truth order

Use these in order when deciding what is real:

1. Code, package manifests, route handlers, tests, and workflow config
2. `docs/internal/feature-status.json` plus generated internal docs in `docs/internal/`
3. Consumer docs in `apps/docs`
4. Package and app `README.md` files

Manual docs can drift. Treat `apps/docs` and README files as secondary evidence unless code and tests agree.

## Workspace boundaries

- Public SDK surface: `packages/chat-core`, `packages/chat-react`, `packages/chat-ui`, `packages/chat-devtools`, `packages/chat-transport-polling`, `packages/chat-provider-dit`
- Internal demo app: `apps/web`
- Consumer docs app: `apps/docs`
- Tooling and release workflow: root `package.json`, `turbo.json`, `.syncpackrc.json`, `.changeset/`, `.github/workflows/`, `packages/eslint-config`, `packages/typescript-config`

Public package exports are defined by both:

- `packages/*/package.json` `exports`
- `packages/*/src/index.ts`

Change both intentionally when modifying public API.

## Status-system rules

- Canonical status source: `docs/internal/feature-status.json`
- Generated views: `docs/internal/IMPLEMENTATION_STATUS.md` and `docs/internal/FEATURE_MATRIX.md`
- Sync after status edits with `pnpm docs:status:sync`
- Verify sync in validation or CI-like checks with `pnpm docs:status:check`
- Do not hand-edit generated status markdown

## Safe edit boundaries

- Change `packages/chat-core` carefully. It owns engine behavior, event semantics, storage integration, plugin lifecycle, middleware execution, and streaming helpers.
- Treat `apps/web` as demo-only behavior. Do not document demo-only paths as SDK guarantees.
- Treat `apps/docs` as consumer documentation only. Do not turn it into the internal implementation status tracker.
- Keep internal implementation notes in `docs/internal/`.

## Generated and build artifacts to avoid editing

Do not hand-edit these unless the task is specifically about generated output:

- `packages/*/dist/**`
- `apps/web/.next/**`
- `apps/docs/.next/**`
- `apps/docs/out/**`
- `apps/*/next-env.d.ts`
- `docs/internal/IMPLEMENTATION_STATUS.md`
- `docs/internal/FEATURE_MATRIX.md`

Use extra caution with these manually maintained or generated-adjacent files:

- `apps/docs/lib/search-data.ts` is a committed generated search index for the docs app
- `pnpm-lock.yaml` should move via dependency changes, not ad hoc edits

## Validation by surface

- Core runtime or adapter changes: `pnpm lint && pnpm check-types && pnpm test && pnpm build`
- Demo app changes: `pnpm lint && pnpm check-types && pnpm build`, then run `pnpm dev:web` if env is available
- Consumer docs changes: `pnpm lint && pnpm check-types && pnpm build`, and confirm `apps/docs/lib/search-data.ts` is still aligned with the authored MDX pages
- Status-system or internal-doc changes: `pnpm docs:status:check`, then run at least `pnpm lint && pnpm check-types`
- Tooling or workflow changes: validate the specific scripts or config paths you changed, then run at least `pnpm lint && pnpm check-types`

## Common pitfalls

- `@kaira/chat-provider-dit` is a concrete transport adapter. It is not an `IProvider` implementation.
- The demo browser runtime uses polling through `/api/chat/events`. It does not use SSE today.
- Streaming helper methods exist in `ChatEngine`, but the demo runtime does not currently emit stream lifecycle events from its DIT-backed path.
- `IProvider` and `IStorage` are exported contracts. They are not first-party concrete packages in this repo.
- The docs app is authored MDX plus generated search data. It is not generated from package exports or tests.
- Package READMEs and docs examples can drift from runtime behavior.

## Extra caution areas

- `packages/chat-core/src/engine/chat-engine.ts`
- `apps/web/lib/chat/server-chat-engine.ts`
- `apps/web/lib/chat/engine.ts`
- `.github/workflows/release.yml`

Inferred: `apps/web/lib/chat/event-broker.ts` is process-local and in-memory, so any SSE-style fan-out assumes a single Node process unless the implementation changes.

See also:

- [README.md](./README.md)
- [ARCHITECTURE_INTERNAL.md](./ARCHITECTURE_INTERNAL.md)
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- [ENGINEERING_WORKFLOW.md](./ENGINEERING_WORKFLOW.md)
- [DECISIONS_AND_CONSTRAINTS.md](./DECISIONS_AND_CONSTRAINTS.md)
