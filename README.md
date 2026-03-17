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
