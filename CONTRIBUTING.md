# Contributing to Kaira Chat SDK

> This SDK is developed and maintained by the internal Kaira team. It is
> published to npm for convenience, but is **not an open-source community
> project**. External contributions are not expected.

---

## Monorepo structure

```
kaira-chat/
├── apps/
│   ├── web/        # Internal demo app (Next.js, not for deployment)
│   └── docs/       # Public documentation site (Next.js, deployed to GitHub Pages)
├── packages/
│   ├── chat-core               # Core engine, event types, base interfaces
│   ├── chat-react              # React hooks and context provider
│   ├── chat-ui                 # Pre-built UI components
│   ├── chat-devtools           # Debug overlay (dev-only, peer-depends on chat-react)
│   ├── chat-provider-dit       # DIT transport implementation
│   ├── chat-transport-polling  # Generic polling transport
│   ├── eslint-config           # Shared ESLint config
│   └── typescript-config       # Shared TypeScript config
└── .github/
    └── workflows/
        ├── ci.yml              # Lint / build / type-check / test on every PR and push
        ├── release.yml         # Changesets release automation (push to main)
        └── deploy-docs-pages.yml
```

**Rule of thumb:** `apps/` contains things that run; `packages/` contains
things that are imported.

---

## Running tasks: `turbo run` vs `pnpm -r`

**Always prefer `turbo run` (or the root-level npm scripts that wrap it).**

| Command            | Correct way                            | Why                                                  |
| ------------------ | -------------------------------------- | ---------------------------------------------------- |
| Build all packages | `pnpm build`                           | Delegates to `turbo run build`, respects `dependsOn` |
| Lint everything    | `pnpm lint`                            | Turbo caches results; only re-runs changed packages  |
| Type-check all     | `pnpm check-types`                     | Same — Turbo-aware                                   |
| Run tests          | `pnpm test`                            | Turbo orchestrates build deps first                  |
| Build one package  | `pnpm --filter @kaira/chat-core build` | Fine for targeted work; bypasses Turbo cache         |

`pnpm -r <script>` runs a script across every workspace package in an
unordered, uncached fashion. It does not respect `dependsOn` from `turbo.json`,
so dependency ordering is not guaranteed. **Do not use it in CI.**

---

## Release policy (Changesets)

This repo uses [Changesets](https://github.com/changesets/changesets) for
versioning and publishing.

### Creating a changeset

When your PR contains a user-facing change to any published package, add a
changeset before merging:

```bash
pnpm changeset
```

Select the affected packages and choose a bump type:

| Bump type | When to use                                                            |
| --------- | ---------------------------------------------------------------------- |
| `patch`   | Bug fixes, docs updates, internal refactors with no API change         |
| `minor`   | New backwards-compatible features, new exports                         |
| `major`   | Breaking changes to public API (type signature change, removed export) |

Commit the generated `.changeset/*.md` file alongside your code changes.

### How publishing works

On every push to `main`, the `release.yml` workflow runs
`changesets/action`, which either:

1. Opens / updates a **"Version Packages" PR** accumulating all pending
   changesets, or
2. **Publishes to npm** if the "Version Packages" PR is merged.

No manual `npm publish` is ever needed.

---

## Dependency classification in SDK packages

SDK packages are consumed by external (and internal) applications, so
dependency classification directly affects consumer bundle sizes and
peer-dependency warnings.

| Type               | Use when                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `dependencies`     | The package **imports and bundles** the dependency at runtime (e.g. `zod`)                                       |
| `peerDependencies` | The host app is expected to provide the dependency (e.g. `react`, sibling SDK packages like `@kaira/chat-react`) |
| `devDependencies`  | Build-time / test-time only — never reaches the consumer (e.g. `tsup`, `vitest`, internal workspace configs)     |

**Key rules:**

- `react` / `react-dom` are **always** `peerDependencies` — never bundle React.
- Sibling `@kaira/*` packages that appear in a package's built output must be
  `peerDependencies`, not `devDependencies`. (`@kaira/chat-devtools` → `@kaira/chat-react`)
- Pure type-only imports from sibling packages can stay in `devDependencies`
  if they are erased at build time and not re-exported.

---

## Shared dependency management

This monorepo uses `syncpack` as the source of truth for shared external
dependency versions.

The enforced dependency set currently includes:

- `eslint`
- `typescript`
- `@types/node`
- `vitest`
- `next`
- `react`
- `react-dom`
- `@types/react`
- `@types/react-dom`
- `babel-plugin-react-compiler`

`@kaira/*` and `@repo/*` packages stay on `workspace:*` and are not treated like
external dependencies.

Published React packages also keep a stable peer contract:

- `peerDependencies.react`: `^18 || ^19`
- `peerDependencies.react-dom`: `^18 || ^19`

If you change one of those ranges, `pnpm deps:check` should fail.

### Daily commands

```bash
pnpm deps:check
pnpm deps:fix
pnpm deps:outdated
pnpm deps:upgrade vitest
pnpm validate
```

What they do:

- `pnpm deps:check` runs `syncpack lint` and fails on version drift.
- `pnpm deps:fix` runs `syncpack fix` to normalize mismatched managed versions.
- `pnpm deps:outdated` shows only `patch` and `minor` updates for managed
  dependencies.
- `pnpm deps:upgrade` updates every managed dependency across the monorepo to
  the latest allowed `minor` version.
- `pnpm deps:upgrade <dependency>` updates one managed dependency everywhere it
  is used, then runs `pnpm install`, then `pnpm validate`.
- `pnpm deps:upgrade --target patch` restricts upgrades to patch releases.
- `pnpm validate` is the single CI-quality gate:
  `deps:check -> lint -> check-types -> build -> test`.

### Upgrade policy

This repo uses a manual-only dependency upgrade flow. There is no automation
opening dependency PRs.

Use manual upgrades when you want to refresh all managed dependencies or target
a specific shared dependency.

Examples:

```bash
pnpm deps:outdated
pnpm deps:upgrade
pnpm deps:upgrade vitest
pnpm deps:upgrade --dependencies react --target patch
```

`pnpm deps:upgrade` accepts only `minor` and `patch` targets. Major upgrades are
not part of the standard workflow and should be handled as an explicit,
separate change.

Manual upgrades are expected to pass the same validation gate before
merge.

### Review expectations

Do not merge dependency PRs only because the versions are aligned. `syncpack`
guarantees consistency, not semantic safety.

Review at least:

- release notes for any dependency with notable behavior changes
- peer dependency impact for published SDK packages
- generated lockfile diff
- `pnpm validate` result

For high-risk upgrades like `react`, `react-dom`, `next`, or test/build
toolchain changes, prefer a dedicated PR even if the change looks small.

---

## Local development

```bash
# Install all workspace dependencies
pnpm install

# Build all packages (required before running apps)
pnpm build

# Run the demo web app
pnpm dev

# Run the docs site
pnpm dev:docs

# Run both in parallel
pnpm dev:all
```
