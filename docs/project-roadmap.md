# Project Roadmap

## Current Focus: SDK Productization Foundation

This release milestone activates the SDK for repeatable, maintainable shipping: release automation, docs foundation, and extensibility proof-of-concept.

**Exit criteria (all must pass):**

- Release automation is runnable from checked-in workflow on `main`
- Docs search generation has explicit repo workflows for sync + verification
- The repo ships at least one first-party middleware package and one first-party plugin package
- Roadmap, workflow docs, and package-level docs align with actual repo behavior

## Phases (4 total)

### Phase 1: Release Automation Activation (P0, COMPLETE)

**Goal:** Make the checked-in release path operational, source-backed, and consistent.

**Deliverables:**

- Activate `.github/workflows/release.yml` for `main` branch publish flow ✓
- Match workflow trigger conditions so release job can actually run ✓
- Document release secrets and preconditions in `docs/deployment-guide.md` ✓
- Verify Changesets remains the single release mechanism ✓

**Evidence:**

- `.github/workflows/release.yml` (active, triggers on main push with changeset/package.json/pnpm-lock.yaml changes)
- `.changeset/config.json` (public access, no auto-commit, ignores docs + web)
- Root `package.json` (changeset + publish scripts)
- `docs/deployment-guide.md` (describes release and deployment flow)

**Status:** Complete (2026-05-11: workflow tested, validated, ready for release)

### Phase 2: Docs Search Generation & Workflow Hardening (P0, PENDING)

**Goal:** Remove manual docs search generation drift; make it part of repo workflow.

**Deliverables:**

- Add explicit repo workflow for search-data.ts generation
- Document generation command in `docs/deployment-guide.md` and `CONTRIBUTING.md`
- Add integrity tests to verify search index is up-to-date
- Integrate search-data verification into CI validate gate

**Evidence:**

- `apps/docs/lib/generate-search-data.ts` (generation script exists)
- `apps/docs/lib/search-data.ts` (committed artifact, tested)
- `apps/docs/lib/generate-search-data.test.ts` (integrity tests)
- CI step in `.github/workflows/ci.yml`

**Status:** Pending (generation script exists, workflow integration needed)

### Phase 3: First-Party Extensibility Packages (P1, PENDING)

**Goal:** Prove middleware and plugin extension surfaces with shipped first-party packages.

**Deliverables:**

- Ship first-party middleware package (e.g., `@kaira/middleware-logging`)
- Ship first-party plugin package (e.g., `@kaira/plugin-persistence`)
- Document middleware and plugin APIs in consumer docs
- Add tests and examples for each package

**Constraints:**

- Interfaces already exist in core (`IMiddleware`, `IPlugin`)
- Packages should be minimal, focused, and well-tested
- Follow same build/release conventions as core packages

**Status:** Not started (depends on Phase 1 completion)

### Phase 4: Streaming & Devtools Hardening (P2, FUTURE)

**Goal:** Improve implementation guidance and validation around streaming without changing architecture.

**Deliverables:**

- Tighten devtools streaming visualization
- Improve streaming helper documentation with examples
- Add advanced streaming examples to demo app
- Consider first-party streaming utilities (if beneficial)

**Constraints:**

- Explicit streaming model is final (no auto-wrapping)
- This phase is follow-on hardening; should not expand milestone scope

**Status:** Future (not blocking release)

## Feature Status Summary

**47 features tracked across 9 categories:**

- **Core Runtime:** 4 features (engine, events, streaming, typing) — all implemented
- **Contracts & Extensibility:** 5 features (storage, provider, middleware, plugins) — 3 interfaces-only, 2 implemented
- **Concrete Adapters:** 4 features (IndexedDB, polling, WebSocket, DIT) — all implemented
- **React / UI / Devtools:** 6 features (provider, hooks, renderers, typing UI, devtools) — all implemented
- **Demo App:** 7 features (browser runtime, server runtime, streaming UX, typing, SSE, WebSocket showcase, bootstrap) — all implemented
- **Consumer Docs:** 2 features (docs app, search index) — app implemented, search partial
- **Tooling & Release:** 3 features (CI validate, docs deploy, package release) — all implemented
- **Testing:** 6 features (core tests, adapter tests, React tests, UI tests, web tests, docs tests) — all implemented
- **Internal Docs & Status:** 1 feature (feature status system) — implemented

**Full breakdown:** [`./feature-matrix.md`](./feature-matrix.md) (generated from `feature-status.json`)

## Key Design Decisions (This Release)

1. **Transport-First, Not Provider-First**
   - Public SDK starts with `ITransport` abstractions
   - First-party polling + WebSocket transports ship; provider integrations layer on top
   - `IProvider` contract exists but has no concrete implementation this milestone
   - Rationale: Transports are more reusable; providers are more project-specific

2. **Explicit Streaming, Not Auto-Wrapped**
   - Developers call `emitStreamStart/Chunk/End` directly
   - No magic middleware that intercepts AI responses
   - Rationale: Clearer lifecycle, easier to debug, matches consumer expectations

3. **Optional Storage & Transport**
   - Engine works without persistence (all in memory)
   - Transport is optional (local-only mode possible)
   - Rationale: Reduces coupling, enables diverse use cases

4. **Registry-Based Extensibility**
   - Renderers, middleware, plugins registered at runtime
   - No global state or singleton factories
   - Rationale: Easier testing, multi-engine support, explicit dependencies

5. **Process-Local Event Broker (Demo Only)**
   - Server event broker in `apps/web` is in-memory, single-process
   - Assumption: demo and internal use only, not production multi-instance deployment
   - Rationale: Simplifies demo runtime; production would use external queue

## Roadmap Beyond This Release

### Post-Productization (P1 + Beyond)

**Not committed, but planned contexts:**

- **Middleware Packages:** Logging, filtering, rate limiting, message enrichment
- **Plugin Packages:** Persistence helpers, notification handlers, custom event sources
- **Provider Integrations:** Concrete `IProvider` implementations for OpenAI, Claude, etc.
- **Streaming Utilities:** Stream collectors, retry helpers, parser utilities
- **Storage Backends:** PostgreSQL, Redis, cloud-native adapters
- **DevOps Examples:** Docker, Kubernetes, multi-instance scaling patterns
- **Consumer Templates:** Pre-built React app templates, Next.js integration examples

## Success Metrics

**For this release:**

- [ ] `pnpm validate` passes without intervention
- [ ] Release workflow publishes all 8 packages to npm without manual steps
- [ ] Consumer docs deploy automatically on `main` push
- [ ] Search index integrity verified in CI
- [ ] At least 1 middleware + 1 plugin package shipped and tested
- [ ] No deprecation warnings in downstream projects using the SDK

**For future releases:**

- [ ] Middleware/plugin adoption and contributions from community
- [ ] Provider integration examples from partners
- [ ] Sub-second demo app cold start time
- [ ] Zero breaking changes in patch releases (semantic versioning strict)

## Related Planning & Status Documents

**Detailed phase breakdowns:**

- [`./roadmaps/sdk-productization.md`](./roadmaps/sdk-productization.md) — full 4-phase productization plan with acceptance criteria

**Implementation status:**

- [`./implementation-status.md`](./implementation-status.md) — evidence-backed feature status for all 47 features
- [`./feature-matrix.md`](./feature-matrix.md) — quick-scan summary by category

**Release mechanics:**

- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — contributor entry, release commands, and workflow status
- [`./deployment-guide.md`](./deployment-guide.md) — env vars, CI/CD, deployment

## Stakeholder Alignment

**Internal teams:**

- Kaira DIT integration via `@kaira/chat-provider-dit` (server-side transport adapter)
- Demo app (`apps/web`) validates transport + storage + streaming patterns
- Docs site (`apps/docs`) supports developer onboarding

**SDK consumers:**

- React/web developers integrating chat into applications
- Transport and storage implementers building custom adapters
- Third-party providers integrating with Kaira backends

**DevOps / Release:**

- NPM publishing via Changesets (repo secret: `NPM_TOKEN`)
- GitHub Pages docs deployment (automatic, no secrets required)
- CI validation gate: `pnpm validate` on all pushes and PRs
