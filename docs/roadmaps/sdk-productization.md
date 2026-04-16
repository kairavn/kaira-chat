# SDK Productization Roadmap

## Summary

This roadmap defines the next internal milestone for moving the current Kaira Chat SDK monorepo from a working internal platform to a releaseable, repeatable, and better-supported product baseline.

The roadmap is aligned to the repo as it exists today:

- The SDK is transport-first around `ITransport`.
- `apps/web` is an internal demo and validation surface, not a public product contract.
- `IProvider` exists as a contract surface, but it is not part of the committed implementation path for this milestone.
- This roadmap does not introduce public API changes by itself. It defines the implementation work required to make the current SDK easier to ship, extend, and validate.

## Milestone

### SDK Productization Foundation

Deliver one productization milestone that:

- activates the currently inactive package release path
- removes manual docs search generation drift
- proves the middleware and plugin extension surfaces with first-party packages
- improves implementation guidance and validation around streaming without changing the architecture
- tightens public-surface confidence for devtools where that work is directly needed by the shipped SDK

Milestone exit criteria:

- release automation is runnable from the checked-in workflow on `main`
- docs search generation has explicit repo workflows for sync and verification
- the repo ships at least one first-party middleware package and one first-party plugin package
- the roadmap, workflow docs, and package-level docs are aligned with the actual repo behavior for this milestone

Phase 4 hardening work is intentionally tracked in this roadmap but does not block milestone completion unless explicitly pulled into scope later.

## Decision on IProvider

For this milestone, `IProvider` is explicitly de-scoped.

That means:

- the repo remains transport-first
- no first-party provider package will be introduced in this milestone
- no provider-engine integration work is required for milestone completion
- public and internal docs should avoid presenting `IProvider` as the recommended near-term integration path until a concrete provider strategy is adopted

This is an explicit product decision for the milestone, not an unresolved implementation omission.

## Execution Order

Implementation order for this roadmap:

1. Phase 1 — Release Automation Activation
2. Phase 2 — Docs Search Generation and Workflow Hardening
3. Phase 3 — First-Party Extensibility Packages
4. Phase 4 — Streaming and Devtools Hardening

Execution rules:

- Phase 1 must land before the repo is treated as release-ready.
- Phase 2 must land before generated docs artifacts are considered workflow-safe.
- Phase 3 should build on the release and docs workflow foundations from Phases 1 and 2.
- Phase 4 is follow-on hardening work and should not expand the milestone scope unless explicitly prioritized.

## Phases

### Phase 1 — Release Automation Activation

Priority: `P0`

Goal:

Make the checked-in release path operational, source-backed, and consistent with how the repo claims packages are published.

Deliverables:

- activate `.github/workflows/release.yml` for the intended `main` branch publish flow
- make the workflow logic match its trigger conditions so the release job can actually run
- document required release secrets and preconditions in internal workflow docs
- verify the Changesets path remains the single release mechanism for public packages

Affected areas:

- `.github/workflows/release.yml`
- `.changeset/config.json`
- root `package.json`
- `docs/internal/ENGINEERING_WORKFLOW.md`
- `CONTRIBUTING.md` if release instructions drift from workflow reality

Acceptance criteria:

- a push to `main` can satisfy the workflow trigger and reach the Changesets release step
- the workflow no longer contains a trigger/job-guard mismatch
- internal docs describe the release path as active only if the checked-in workflow supports it
- no additional release mechanism is introduced alongside Changesets

### Phase 2 — Docs Search Generation and Workflow Hardening

Priority: `P0`

Goal:

Remove manual drift from generated docs search artifacts and make the workflow explicit, repeatable, and validation-backed.

Deliverables:

- add explicit root scripts for docs search generation sync and verification
- make `apps/docs/lib/generate-search-data.ts` runnable through normal repo workflows without ad hoc shell snippets
- integrate search-data verification into the normal validation path or an equivalent documented CI-quality check
- keep docs status sync and docs search sync as separate workflows so internal status generation and consumer-doc generation do not get conflated

Validation defaults for this milestone:

- the repo should expose one command to regenerate docs search data
- the repo should expose one command to verify docs search data is current
- verification should run in CI for pull requests, or in an equivalent documented validation path that blocks stale generated data from merging
- generation should remain an explicit sync/update command, not an implicit side effect of unrelated install steps

Affected areas:

- root `package.json`
- `apps/docs/lib/generate-search-data.ts`
- `apps/docs/lib/search-data.ts`
- `apps/docs/lib/generate-search-data.test.ts`
- `docs/internal/ENGINEERING_WORKFLOW.md`

Acceptance criteria:

- the repo exposes one documented command to regenerate docs search data
- the repo exposes one documented command to verify docs search data is current
- docs contributors no longer need custom one-off commands to update `apps/docs/lib/search-data.ts`
- CI-quality validation catches stale search data before merge

### Phase 3 — First-Party Extensibility Packages

Priority: `P1`

Goal:

Prove the middleware and plugin extension surfaces with minimal, source-backed, first-party packages that are small enough to be stable reference implementations.

Deliverables:

- add one first-party middleware package as a reference implementation of the middleware surface
- add one first-party plugin package as a reference implementation of the plugin lifecycle surface
- publish both packages through the existing workspace and Changesets model
- add focused tests plus minimal docs for installation, intended use, and boundaries

Implementation defaults for this milestone:

- the middleware package should demonstrate ordered interception and value-added behavior without redefining engine semantics
- the plugin package should demonstrate install/destroy lifecycle handling without depending on demo-only code
- both packages should be small, source-backed reference packages rather than framework-heavy integrations

Initial package intent guidance:

- the middleware package should be diagnostic, logging, tracing, or similarly lightweight
- the plugin package should focus on lifecycle behavior and not require `apps/web` as a dependency
- package names may vary, but the first-party references should be obviously discoverable and aligned with the existing `@kaira/*` workspace model

Affected areas:

- `packages/` for the new middleware and plugin workspaces
- root workspace and package manifests
- internal status docs if these surfaces move from “no first-party package” gaps to implemented deliverables
- consumer docs only where package discovery or public installation guidance becomes necessary

Acceptance criteria:

- both new workspaces build, test, and typecheck in the monorepo
- both packages have clear public exports and package metadata
- both packages are validated by focused automated tests
- the repo includes source-backed first-party examples for both middleware and plugins

### Phase 4 — Streaming and Devtools Hardening

Priority: `P1`

Goal:

Improve confidence in streaming behavior and devtools behavior without changing the transport-first architecture or turning internal demo behavior into public guarantees.

Deliverables:

- harden the streaming story around the existing helper-driven model instead of inventing provider-first abstractions
- add source-backed guidance or reference implementation patterns for emitting `message:stream:*` events from first-party integrations
- add missing automated coverage for the public devtools panel, not just its internal state hooks
- verify the streaming and devtools stories against the current local demo surfaces without treating `apps/web` as a public API

Scope note:

- this phase is roadmap-tracked hardening work
- it does not block milestone completion unless explicitly promoted into milestone scope
- it should follow the foundation work from Phases 1–3

Affected areas:

- `packages/chat-core`
- `packages/chat-react`
- `packages/chat-devtools`
- first-party transport and demo validation surfaces where streaming behavior is exercised
- internal status docs if roadmap gaps are materially closed

Acceptance criteria:

- streaming guidance is backed by code, tests, or both rather than docs-only recommendations
- public devtools rendering behavior has automated coverage
- the repo can validate stream lifecycle behavior without depending on undocumented demo-only guarantees
- no new provider abstraction is introduced to solve streaming in this phase

## Deliverables

Milestone deliverables at completion:

- active release workflow aligned with Changesets
- documented repo commands for docs search sync and docs search verification
- one first-party middleware package
- one first-party plugin package
- roadmap and workflow docs aligned with actual repo behavior for this milestone

Follow-on hardening deliverables, if Phase 4 is pulled into scope:

- stronger streaming implementation guidance backed by code and tests
- automated coverage for the public devtools panel

## Not in This Milestone

This milestone does not include:

- concrete `IProvider` integration
- redefining the SDK as provider-first instead of transport-first
- converting `apps/web` demo behavior into public SDK guarantees
- redesigning the in-memory event broker for distributed or multi-process runtime support
- benchmark-style performance work as a milestone gate
- a production-grade public example app unless that work is later explicitly prioritized

## Affected Areas

Primary implementation areas:

- root workflow and package scripts
- `apps/docs` search-data generation path
- `packages/chat-core`
- `packages/chat-react`
- `packages/chat-devtools`
- new first-party extensibility packages under `packages/`
- internal workflow and status docs

Secondary areas:

- `apps/web` only as a validation surface for streaming and devtools behavior
- consumer docs only where newly shipped public packages or commands must be surfaced

## Acceptance Criteria

The milestone is complete when all of the following are true:

- release automation is source-backed, active, and consistent with the repo’s documented workflow
- docs search generation is no longer a manual undocumented artifact maintenance step
- the SDK ships first-party, tested examples of both middleware and plugin extensibility
- the roadmap and supporting docs reflect the repo’s actual transport-first implementation direction
- no roadmap work depends on turning the demo app into a public compatibility contract
- no roadmap work requires implementing `IProvider` in this milestone

If Phase 4 is explicitly pulled into scope, the following additional conditions apply:

- streaming guidance is implemented in a way that matches the current transport-first architecture
- the public devtools panel has automated coverage

## Expected Implementation Hotspots

Expected implementation hotspots for this roadmap:

- `.github/workflows/release.yml`
- root `package.json`
- `.changeset/config.json`
- `apps/docs/lib/generate-search-data.ts`
- `apps/docs/lib/search-data.ts`
- `apps/docs/lib/generate-search-data.test.ts`
- `packages/chat-core`
- `packages/chat-react`
- `packages/chat-devtools`
- new packages under `packages/` for middleware and plugin references
- `docs/internal/ENGINEERING_WORKFLOW.md`
- `docs/internal/IMPLEMENTATION_STATUS.md` and `docs/internal/FEATURE_MATRIX.md` if feature status changes
- `CONTRIBUTING.md` only if contributor-facing instructions drift from actual workflow behavior

## Summary

This roadmap commits the repo to productization work that closes operational, workflow, and extensibility gaps without changing the fundamental architecture.

The committed direction for this milestone is:

- transport-first
- release-ready
- workflow-safe
- extension-ready

The milestone is intentionally scoped to shipping infrastructure, repeatable workflows, and first-party extensibility references rather than broad new runtime abstractions.

## Unresolved Gaps

These items remain intentionally outside the milestone and should be revisited later:

- a long-term `IProvider` strategy beyond its current contract surface
- whether and when the repo should ship a first-party provider package
- whether the demo/runtime event broker should evolve toward distributed or multi-process reference support
- stronger standardization of streaming semantics across first-party adapters beyond the initial helper-driven hardening path
- additional public example applications beyond the internal demo surface
- benchmark-style checks for message dedupe, pagination, storage sync, and renderer throughput
