# Deployment Guide

## Package Publishing (NPM)

### Release Flow

The repo uses **Changesets** as the single release mechanism. Release automation is active in `.github/workflows/release.yml`.

**Automatic flow on `main` branch:**

1. Developer opens PR with changeset file (via `pnpm changeset`)
2. CI validates PR (tests, lint, types, build all pass)
3. On merge to `main`, release.yml triggers
4. Changesets action creates version PR or publishes directly
5. Packages appear on npm under `@kaira/*` org

### Manual Release Steps (if needed)

```bash
# 1. Create a changeset (interactive)
pnpm changeset
# Prompts: which packages changed, what type (patch/minor/major), description

# 2. (Optional) Check changeset status
pnpm changeset:status

# 3. Version packages locally
pnpm changeset:version
# Updates package.json versions and CHANGELOG files

# 4. Publish to npm (requires NPM_TOKEN secret)
pnpm changeset:publish
# Publishes all versioned packages to npm registry
```

### Requirements

**Repository secrets:**

- `NPM_TOKEN` — npm org token with publish permission (required for release.yml)
- `GITHUB_TOKEN` — auto-provided by GitHub Actions (used for GitHub API)

**Pre-release checklist:**

- [ ] `pnpm validate` passes (deps, docs, lint, types, build, test)
- [ ] All 8 public packages have updated version in `package.json`
- [ ] No breaking changes without major version bump
- [ ] CHANGELOG entries are meaningful (why it changed, not what changed)
- [ ] Package `README.md` files are up-to-date
- [ ] Consumer docs reflect any API changes

### Versioning

Follow **semantic versioning**:

- `patch` (0.0.x) — bug fixes, non-breaking changes
- `minor` (0.x.0) — new features, backward-compatible
- `major` (x.0.0) — breaking changes

Currently in pre-1.0 phase (`0.x.y`), so:

- New features are typically `minor`
- Breaking changes are `minor` (not yet at 1.0 stability promise)

## Apps Deployment

### apps/web (Demo App)

**Environment:** Next.js 16.2.4, Node >=18, port 3000

**Local development:**

```bash
pnpm install
pnpm dev:web
# Opens http://localhost:3000
```

**Build for production:**

```bash
pnpm build
# or just web:
turbo run build --filter=web
```

**Required environment variables (server-side):**

```bash
API_URL=https://your-backend-api
X_API_KEY=your-api-key
X_API_ID=your-api-id
```

**Required environment variables (client-safe, NEXT*PUBLIC*):**

```bash
NEXT_PUBLIC_DEMO_SESSION_ID=session-uuid
NEXT_PUBLIC_DEMO_SENDER_ID=sender-uuid
NEXT_PUBLIC_DEMO_CHATBOT_NICKNAME=Assistant
NEXT_PUBLIC_DEMO_CHATROOM_ID=room-id
```

**Deployment:**

- Can deploy to Vercel, Railway, or self-hosted Node servers
- Requires `API_URL`, `X_API_KEY`, `X_API_ID` set in production environment
- Uses Next.js App Router, no static export

**Demo routes (always available):**

- `/` — demo index
- `/dit-modive` — DIT-backed demo (requires DIT env vars)
- `/websocket` — WebSocket transport showcase
- `/streaming` — local streaming demo with SSE
- `/next-backend` — next-backend demo
- `/persistence` — local persistence demo with IndexedDB
- `/media` — media content demo

### apps/docs (Consumer Documentation)

**Environment:** Next.js 16.2.4, Node >=18, port 3001, static export

**Local development:**

```bash
pnpm install
pnpm dev:docs
# Opens http://localhost:3001
```

**Build for static export:**

```bash
cd apps/docs
pnpm build
# Output: ./out/ directory (ready for GitHub Pages or CDN)
```

**Environment variables (optional):**

```bash
# Optional: if deploying to subdirectory
NEXT_PUBLIC_BASE_PATH=/docs
NEXT_PUBLIC_DOCS_BASE_URL=https://example.com/docs
```

**Deployment:**

- Static export (no server required)
- Deploy `out/` directory to GitHub Pages, Netlify, Vercel, or CDN
- Automatic via `.github/workflows/deploy-docs-pages.yml` to GitHub Pages

**GitHub Pages configuration:**

- Repo must have GitHub Pages enabled (Settings → Pages)
- Source: GitHub Actions
- Deploys to `gh-pages` branch automatically
- Public URL: `https://{org}.github.io/{repo}`

## Workspace Build

### Local Build

```bash
pnpm install
pnpm build
# Runs Turbo build with dependency caching
# Outputs: packages/*/dist/, apps/*/.next/
```

**Build sequence (Turbo-orchestrated):**

1. `packages/typescript-config` and `packages/eslint-config` (no deps)
2. `packages/chat-core` (no @kaira deps)
3. `packages/chat-react`, `packages/chat-ui`, etc. (depend on chat-core)
4. `packages/chat-devtools`, `packages/chat-provider-dit` (depend on above)
5. `apps/web` and `apps/docs` (depend on packages)

**Caching:**

- Turbo caches successful builds
- Cache invalidates on source changes
- Use `pnpm clean` to reset cache

### CI Build

Triggered on all pushes and PRs:

```bash
# In .github/workflows/ci.yml:
pnpm validate
# = deps:check && docs:status:check && lint && check-types && build && test
```

**Fail conditions (any fail blocks merge):**

- `deps:check` — dependency version misalignment detected
- `docs:status:check` — generated docs out of sync with source JSON
- `lint` — ESLint violations
- `check-types` — TypeScript errors
- `build` — compilation failed
- `test` — test suite failures

**Phase 2 (Pending):**
Docs search generation lacks explicit repo workflow integration. `apps/docs/lib/generate-search-data.ts` exists but is not yet part of CI validation. See [`./project-roadmap.md`](./project-roadmap.md#phase-2-docs-search-generation--workflow-hardening-p0-pending) for planned integration.

## Publishing Consumer Docs

### Automatic (GitHub Actions)

The repo has an active docs deployment workflow (`.github/workflows/deploy-docs-pages.yml`):

1. Any push to `main` triggers
2. Builds `apps/docs` to static export
3. Deploys `out/` to `gh-pages` branch
4. GitHub Pages serves from `gh-pages`

**No manual steps required.**

### Manual (if needed)

```bash
cd apps/docs
pnpm install
pnpm build

# Then push ./out/ to gh-pages branch or your CDN
git add --force out/
git commit -m "docs: static export"
git push origin gh-pages
```

## Environment Variable Management

### Local Development

Copy `.env.example` files:

```bash
cp apps/web/.env.example apps/web/.env.local
# Edit with local values
```

**Do not commit `.env.local` or `.env`.**

### CI/CD & Production

Set secrets in GitHub (Settings → Secrets and variables → Actions):

- `NPM_TOKEN` — required for `release.yml`
- Any custom env vars used in workflows

For app-specific vars (API_URL, X_API_KEY, etc.):

- Set in deployment platform (Vercel, Railway, etc.)
- Or in GitHub environment secrets if deploying from Actions

### Turbo Environment Passthrough

These vars are automatically passed through Turbo to all tasks (if set):

```json
[
  "NODE_ENV",
  "API_URL",
  "X_API_KEY",
  "X_API_ID",
  "NEXT_PUBLIC_BASE_PATH",
  "NEXT_PUBLIC_DOCS_BASE_URL",
  "NEXT_PUBLIC_DEMO_SESSION_ID",
  "NEXT_PUBLIC_DEMO_SENDER_ID",
  "NEXT_PUBLIC_DEMO_CHATBOT_NICKNAME",
  "NEXT_PUBLIC_DEMO_CHATROOM_ID"
]
```

See `turbo.json` for the full `globalEnv` list.

## Validation Gates

### Pre-Commit

Runs via `simple-git-hooks`:

```bash
prettier --write <staged-files>
```

Prettier formats staged files automatically. If formatting changes, re-stage before committing.

### Pre-Push

Runs full validation:

```bash
pnpm validate
# = deps:check && docs:status:check && lint && check-types && build && test
```

Failure blocks push. Fix issues and retry.

### CI (Pull Requests & Main Branch)

Same as pre-push, but runs in CI environment. Additional checks:

- Docs search index integrity
- Generated docs are in sync
- No security vulnerabilities

## Troubleshooting

### Build Fails: "Cannot find module"

```bash
pnpm install
pnpm clean
pnpm build
```

### Release Fails: "NPM_TOKEN not found"

Ensure `NPM_TOKEN` is set in GitHub repo secrets:

1. Go to Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`, Value: your npm org token

### Docs Deploy Fails

Check `.github/workflows/deploy-docs-pages.yml` logs:

1. GitHub repo → Actions tab
2. Click latest "Deploy Docs" workflow
3. Review build output for errors

**Common issues:**

- `apps/docs` build error (fix in `apps/docs/`)
- Pages not enabled (Settings → Pages → source: GitHub Actions)
- Base path mismatch (check `NEXT_PUBLIC_BASE_PATH` vs GitHub Pages subdirectory)

### Validation Fails Locally

Run each step individually to isolate the issue:

```bash
pnpm deps:check      # dependency alignment
pnpm docs:status:check # generated docs in sync
pnpm lint             # ESLint
pnpm check-types      # TypeScript
pnpm build            # compilation
pnpm test             # test suites
```

Fix each failure before retrying `pnpm validate`.

## Related Documentation

**Developer guides:**

- [`./code-standards.md`](./code-standards.md) — validation rules, safe edit boundaries
- [`./testing-strategy.md`](./testing-strategy.md) — coverage expectations, validation per change type
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — contributor guide and release mechanism
- [`.changeset/config.json`](../.changeset/config.json) — Changesets configuration

**Workflow files:**

- [`.github/workflows/release.yml`](../.github/workflows/release.yml) — package release automation
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — CI validation pipeline
- [`.github/workflows/deploy-docs-pages.yml`](../.github/workflows/deploy-docs-pages.yml) — docs deployment

**Configuration:**

- `turbo.json` — build orchestration, env vars, task dependencies
- `apps/web/.env.example` — demo app environment template
- `apps/docs/next.config.mjs` — Next.js config for static export

## Deployment Checklist

Before going live:

- [ ] All 8 packages build without warnings
- [ ] `pnpm validate` passes
- [ ] CHANGELOG entries are present and meaningful
- [ ] Package versions are incremented (if releasing)
- [ ] NPM_TOKEN secret is set in GitHub
- [ ] Consumer docs deploy successfully
- [ ] Demo app loads without errors on deployment platform
- [ ] All environment variables are configured on production platform
- [ ] API endpoints are reachable and functional
- [ ] Tests pass in CI
