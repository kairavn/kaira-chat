# Internal Docs

Internal implementation guidance, feature status tracking, and repo-safety notes live here. This directory is for engineers and agents working inside the monorepo. Consumer-facing SDK documentation remains in `apps/docs`.

## Source-of-truth order

Use these in order when deciding what is real:

1. Code, package manifests, route handlers, tests, and workflow config
2. `docs/internal/feature-status.json` and generated internal docs in this directory
3. `apps/docs` consumer documentation
4. Package and app `README.md` files

Manual docs can drift. Never use `apps/docs` or a README as sole evidence for implementation status.

## What lives here

| File                           | Purpose                                                 | Notes                                    |
| ------------------------------ | ------------------------------------------------------- | ---------------------------------------- |
| `README.md`                    | internal docs index and ownership map                   | start here                               |
| `AGENT_GUIDE.md`               | safe edit boundaries and operational rules              | primary implementation-safety doc        |
| `ARCHITECTURE_INTERNAL.md`     | repo shape and runtime boundaries                       | boundary-focused, not a status tracker   |
| `ENGINEERING_WORKFLOW.md`      | commands, env expectations, and workflow reality        | mirrors checked-in scripts and workflows |
| `IMPLEMENTATION_STATUS.md`     | canonical human-readable status view                    | generated from `feature-status.json`     |
| `FEATURE_MATRIX.md`            | quick-scan derived summary                              | generated from `feature-status.json`     |
| `DECISIONS_AND_CONSTRAINTS.md` | durable implementation constraints and inferred caveats | manual doc                               |
| `TESTING_STRATEGY.md`          | validation expectations by surface                      | manual doc                               |

## Feature status system

- Canonical source: `docs/internal/feature-status.json`
- Generated views: `IMPLEMENTATION_STATUS.md` and `FEATURE_MATRIX.md`
- Primary statuses: `implemented`, `partial`, `interface-only`, `missing`
- `roadmapCandidate` is a separate flag. It is not a promise and must not be used as a hidden backlog.
- Every status entry must cite one to three evidence paths from source code, tests, config, or workflows.

Sync commands:

```sh
pnpm docs:status:sync
pnpm docs:status:check
```

## Scope rules

- Public SDK surfaces are defined by `packages/*/package.json` exports and `packages/*/src/index.ts`.
- `apps/web` is an internal demo app and proxy layer. Do not treat demo behavior as a public SDK guarantee.
- `apps/docs` is a consumer docs app. Do not use it as implementation status truth.
- Generated artifacts such as `dist`, `.next`, and `out` are not authoritative implementation sources.

## When updating docs

- Prefer updating an existing internal doc over creating another status or overview file.
- Keep docs compact and evidence-backed.
- If a statement is inferred rather than explicit in source, label it as inferred.
