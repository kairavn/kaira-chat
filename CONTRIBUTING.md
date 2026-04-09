# Contributing to Kaira Chat SDK

This repository is maintained by the Kaira team. Public npm packages live beside an internal demo app and a separate consumer docs app.

This SDK is developed and maintained by the internal Kaira team. It is published to npm for convenience, but it is not an open-source community project.

## Monorepo structure

```text
apps/
  docs/   Consumer-facing SDK docs app
  web/    Internal demo app and Next.js proxy layer
packages/
  chat-core
  chat-react
  chat-ui
  chat-devtools
  chat-transport-polling
  chat-provider-dit
  eslint-config
  typescript-config
docs/internal/
  Internal architecture, status, workflow, and safety docs
```

Use `apps/` for runnable applications and `packages/` for importable libraries.

## Source-of-truth order

When docs and code disagree, use this order:

1. Code, package manifests, route handlers, tests, and workflow config
2. `docs/internal/feature-status.json` and generated internal docs
3. Consumer docs in `apps/docs`
4. Package and app `README.md` files

See [docs/internal/README.md](./docs/internal/README.md) for the internal docs map.

## Core workflow

Prefer the root scripts. They already map to `turbo run ...` and match CI behavior.

```sh
pnpm install
pnpm dev
pnpm dev:web
pnpm dev:docs
pnpm lint
pnpm check-types
pnpm test
pnpm build
pnpm validate
```

Notes:

- `pnpm dev` runs workspace `dev` scripts through Turbo. Use `pnpm dev:web` or `pnpm dev:docs` when you only need one app.
- There is no `pnpm dev:all` script in this repo.
- `pnpm validate` is the repo-wide quality gate used by CI: dependency checks, lint, typecheck, build, and tests.

## Release and deployment reality

- CI validation is active in `.github/workflows/ci.yml` and runs `pnpm validate` on pull requests and pushes to `main`.
- Consumer docs deployment is active in `.github/workflows/deploy-docs-pages.yml` and publishes `apps/docs` to GitHub Pages.
- Changesets is configured in `.changeset/config.json`.
- The checked-in release workflow is not currently live as written. `release.yml` only triggers on `workflow_dispatch`, while its publish job is guarded by `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`.

Treat package versioning and publish flow as configured-but-inactive automation unless the workflow is updated.

## Changesets

When a public package change is intended for release, add a changeset:

```sh
pnpm changeset
pnpm changeset:status
```

Useful follow-up commands:

```sh
pnpm changeset:version
pnpm changeset:publish
```

Only use these when release work is actually intended. The current repo state does not provide an always-on publish workflow.

## Dependency management

Shared dependency alignment is enforced with `syncpack`.

```sh
pnpm deps:check
pnpm deps:fix
pnpm deps:outdated
pnpm deps:upgrade
pnpm deps:upgrade vitest
```

Current rules are defined in `.syncpackrc.json`:

- local workspace packages stay on `workspace:*`
- React peer ranges stay pinned for published React packages
- key shared dependencies are version-aligned across the monorepo

## Package boundaries

- Changes in `packages/chat-core` affect the base runtime and public contracts.
- Changes in `packages/chat-react`, `packages/chat-ui`, and `packages/chat-devtools` affect public React-facing packages.
- Changes in `packages/chat-transport-polling` and `packages/chat-provider-dit` affect concrete runtime adapters.
- Changes in `apps/web` affect the internal demo app only.
- Changes in `apps/docs` affect consumer docs only.

See also:

- [docs/internal/README.md](./docs/internal/README.md)
- [docs/internal/AGENT_GUIDE.md](./docs/internal/AGENT_GUIDE.md)
- [docs/internal/ENGINEERING_WORKFLOW.md](./docs/internal/ENGINEERING_WORKFLOW.md)
- [docs/internal/IMPLEMENTATION_STATUS.md](./docs/internal/IMPLEMENTATION_STATUS.md)
