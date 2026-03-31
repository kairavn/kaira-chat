# Kaira Chat SDK Monorepo

Modular TypeScript chat SDK for React and framework-agnostic runtimes.

## Packages

- `@kaira/chat-core` - core chat engine and types
- `@kaira/chat-react` - React bindings and hooks
- `@kaira/chat-ui` - reusable UI components
- `@kaira/chat-devtools` - runtime diagnostics panel
- `@kaira/chat-transport-polling` - polling transport implementation
- `@kaira/chat-provider-dit` - DIT provider integration

## Workspace Apps

- `apps/web` - local playground app
- `apps/docs` - SDK documentation site (deployed on GitHub Pages)

## Getting Started

```sh
pnpm install
pnpm dev
```

Useful commands:

```sh
pnpm build
pnpm check-types
pnpm lint
```

## Dependency Upgrade Flow

Shared dependency versions are enforced with `syncpack`, and every upgrade goes
through the same validation gate.

```sh
pnpm deps:check
pnpm deps:outdated
pnpm deps:upgrade vitest
pnpm validate
```

- `pnpm deps:check` verifies shared dependency versions stay aligned across the
  monorepo.
- `pnpm deps:outdated` shows available `patch` and `minor` updates for managed
  dependencies only.
- `pnpm deps:upgrade` updates all managed dependencies across the repo to the
  latest allowed `minor` versions.
- `pnpm deps:upgrade <name>` updates the selected dependency across every
  package that uses it, then runs `pnpm install` and `pnpm validate`.
- `pnpm deps:upgrade --target patch` restricts updates to patch releases.
- Dependency upgrades are manual-only. This repo does not use bot-created
  upgrade PRs.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full dependency management
policy.

## Build and Validate Before Publishing

```sh
pnpm -r build
pnpm -r check-types
pnpm -r --filter "kaira-chat-*" exec npm pack
```

## Publish Flow

```sh
pnpm changeset
pnpm changeset version
pnpm install
pnpm -r build
pnpm changeset publish
```

Note: do not run `npm pack` at repo root because the root package is private and not publishable.

## Documentation Deployment (GitHub Pages)

Docs are deployed via `.github/workflows/deploy-docs-pages.yml`.

- GitHub Pages source must be set to **GitHub Actions**
- The docs site URL is:
  - `https://<github-user>.github.io/<repo-name>/`

Example:

- `https://phuocle.github.io/chat-core/`

## License

MIT
