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
