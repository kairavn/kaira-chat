# Engineering Workflow

This file captures the current repo workflow as reflected by checked-in scripts and config.

## Install, dev, build, validate

| Command                  | Current behavior                                                          | Notes                                                                    |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm install`           | installs all workspaces                                                   | required before any other repo command                                   |
| `pnpm dev`               | `turbo run dev`                                                           | runs workspace dev scripts; useful when working across apps and packages |
| `pnpm dev:web`           | `turbo run dev --filter=web`                                              | focused on `apps/web`                                                    |
| `pnpm dev:docs`          | `turbo run dev --filter=docs`                                             | focused on `apps/docs`                                                   |
| `pnpm docs:status:sync`  | renders generated status docs from `docs/internal/feature-status.json`    | run after editing the canonical JSON inventory                           |
| `pnpm docs:status:check` | verifies generated status docs are in sync                                | suitable for local verification and CI-style checks                      |
| `pnpm lint`              | `turbo run lint`                                                          | repo-wide lint path                                                      |
| `pnpm check-types`       | `turbo run check-types`                                                   | repo-wide typecheck path                                                 |
| `pnpm test`              | `pnpm test:scripts && turbo run test`                                     | repo script tests plus workspace tests where a test script exists        |
| `pnpm build`             | `turbo run build`                                                         | builds packages and both apps                                            |
| `pnpm validate`          | `deps:check && docs:status:check && lint && check-types && build && test` | current CI-quality validation gate                                       |

## Dependency and release commands

| Command family           | Current behavior                                                                 |
| ------------------------ | -------------------------------------------------------------------------------- |
| `pnpm deps:check`        | runs `syncpack lint`                                                             |
| `pnpm deps:fix`          | runs `syncpack fix`                                                              |
| `pnpm deps:outdated`     | checks managed dependency updates via `scripts/run-syncpack-upgrade.mjs --check` |
| `pnpm deps:upgrade`      | upgrades managed dependencies via `scripts/run-syncpack-upgrade.mjs`             |
| `pnpm changeset`         | opens Changesets prompt                                                          |
| `pnpm changeset:status`  | reports current Changesets state                                                 |
| `pnpm changeset:version` | versions packages using pending changesets                                       |
| `pnpm changeset:publish` | publishes via Changesets                                                         |

## Environment and config expectations

`apps/web` depends on both server-only and `NEXT_PUBLIC_` demo variables. The checked-in template is:

- `apps/web/.env.example`

Required server-side variables for the demo runtime:

- `API_URL`
- `X_API_KEY`
- `X_API_ID`

Required shared demo identifiers used by both browser and server:

- `NEXT_PUBLIC_DEMO_SESSION_ID`
- `NEXT_PUBLIC_DEMO_SENDER_ID`
- `NEXT_PUBLIC_DEMO_CHATBOT_NICKNAME`
- `NEXT_PUBLIC_DEMO_CHATROOM_ID`

Docs app config:

- `apps/docs` supports optional `NEXT_PUBLIC_BASE_PATH` for GitHub Pages export
- see `apps/docs/next.config.mjs`

Turbo environment passthrough is defined in `turbo.json` for:

- `NODE_ENV`
- `API_URL`
- `X_API_KEY`
- `X_API_ID`
- `NEXT_PUBLIC_BASE_PATH`
- `NEXT_PUBLIC_DEMO_SESSION_ID`
- `NEXT_PUBLIC_DEMO_SENDER_ID`
- `NEXT_PUBLIC_DEMO_CHATBOT_NICKNAME`
- `NEXT_PUBLIC_DEMO_CHATROOM_ID`

## Release and deployment reality

- CI validation is active in `.github/workflows/ci.yml`
- Docs deployment is active in `.github/workflows/deploy-docs-pages.yml`
- Changesets config is active in `.changeset/config.json`
- Release automation is not currently live as checked in because `.github/workflows/release.yml` only triggers on `workflow_dispatch`, while the publish job only runs for a `push` event on `main`

## Incomplete or ambiguous areas

- `apps/docs/lib/search-data.ts` is a committed generated artifact, but there is no root script dedicated to regenerating it
- `apps/web` includes polling plus demo-scoped SSE for stream lifecycle updates, and the DIT-backed path remains polling-first
- The repo contains release configuration, but not a currently active publish workflow
- Package and app README examples can drift from source exports and current runtime wiring
- The repo now runs on Vitest 4, so older Jest-style flags such as `--runInBand` are no longer valid; prefer file filters or Vitest's own parallelism flags

## Repo-specific troubleshooting

- If `apps/web` fails at startup, check `apps/web/config/demo-registry.ts`, `apps/web/config/dit-demo.ts`, and `apps/web/lib/chat/server-config.ts` first. DIT config is optional for non-DIT routes, so failures are more likely to be route-specific now.
- If docs search looks stale after editing MDX, compare `apps/docs/app/**/*.mdx`, `apps/docs/lib/generate-search-data.ts`, and `apps/docs/lib/search-data.ts`.
- If you need to narrow a Vitest run, prefer `pnpm --filter <workspace> test -- <file-pattern>`; do not use `--runInBand`.
- If internal feature status looks stale, update `docs/internal/feature-status.json`, then run `pnpm docs:status:sync` and `pnpm docs:status:check`.
- Do not treat `.next`, `out`, or `dist` output as editable source.

See also:

- [README.md](./README.md)
- [AGENT_GUIDE.md](./AGENT_GUIDE.md)
- [TESTING_STRATEGY.md](./TESTING_STRATEGY.md)
- [DECISIONS_AND_CONSTRAINTS.md](./DECISIONS_AND_CONSTRAINTS.md)
