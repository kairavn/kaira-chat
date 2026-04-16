# @kaira/web — Internal Demo App

This is the internal demo showcase for the Kaira Chat SDK. It now includes a
demo catalog plus multiple focused routes that exercise the SDK against both a
DIT-backed runtime and local Next.js backends inside `apps/web`.

> **Note:** This app is intended for internal Kaira team use only. It is not
> designed for external deployment or public access.

## Setup

### 1. Install dependencies

From the monorepo root:

```bash
pnpm install
```

### 2. Configure environment

Copy the example file and fill in your values:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local` for the DIT-backed demo:

| Variable                            | Description                             |
| ----------------------------------- | --------------------------------------- |
| `API_URL`                           | Base URL of the Kaira DIT API           |
| `X_API_KEY`                         | API authentication key                  |
| `X_API_ID`                          | API application/client ID               |
| `NEXT_PUBLIC_DEMO_SESSION_ID`       | Demo session id shared with the browser |
| `NEXT_PUBLIC_DEMO_SENDER_ID`        | Browser sender id for the DIT route     |
| `NEXT_PUBLIC_DEMO_CHATBOT_NICKNAME` | Assistant nickname for the DIT route    |
| `NEXT_PUBLIC_DEMO_CHATROOM_ID`      | Dedicated seeded DIT demo chatroom id   |

The DIT route is the only demo that requires these variables. The demo catalog
and all local Next-backed demos remain available without them.

For deterministic live demos, `NEXT_PUBLIC_DEMO_CHATROOM_ID` must point to a
dedicated pre-seeded DIT room. `apps/web` does not seed or mutate that room for
you, and `/dit-modive` stays unavailable when the required DIT env is missing so
the demo does not silently fall back to unstable live data.

### 3. Run locally

```bash
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000) by default.

To run only the web app without the docs site:

```bash
pnpm dev --filter=web
```

## Demo routes

| Route           | Purpose                                                      |
| --------------- | ------------------------------------------------------------ |
| `/`             | Demo catalog with route descriptions and availability status |
| `/dit-modive`   | Existing DIT-backed demo, preserved under its own route      |
| `/next-backend` | Local Next.js backend demo with typing and streaming         |
| `/streaming`    | Stream lifecycle-focused demo                                |
| `/media`        | Built-in renderer coverage with exact media quick actions    |
| `/persistence`  | IndexedDB persistence and conversation switching             |
| `/websocket`    | Local-only WebSocket transport showcase with reconnect drill |

## Architecture overview

- Demo metadata lives in `apps/web/config/demo-registry.ts`.
- Browser runtimes are created per demo in `apps/web/lib/demo/client-runtime.ts`.
- Shared runtime provisioning lives in
  `apps/web/components/demo/DemoRuntimeProvider.tsx`.
- The generalized backend registry lives in
  `apps/web/lib/demo/server/runtime-registry.ts`.
- The local-only sibling-port WebSocket bridge lives in
  `apps/web/lib/demo/server/demo-websocket-server.ts`.
- Dynamic demo routes use `app/api/demos/[demoId]/*`.
- Legacy `/api/chat/*` routes remain as DIT compatibility wrappers.

Local demos use a server-owned `ChatEngine` plus route handlers to simulate
realistic chat behavior. `next-backend`, `streaming`, and `media` now expose
deterministic quick actions so specific backend and renderer paths can be
verified without relying on prompt parsing alone. Stream-capable demos still
bridge `message:stream:*` events into the browser through the demo SSE route,
but the final assistant reply also lands through the normal message transport.
The `/websocket` route stays additive and local-only: it bootstraps the
conversation over the existing HTTP demo routes, then uses a demo-only
WebSocket server on `localhost:3021` for message and typing traffic so connect,
send, receive, and reconnect behavior can be reviewed without changing the
polling-first demos.

## Project structure

```text
apps/web/
├── app/           # App Router pages plus demo API routes
├── components/    # Shared chat and demo UI surfaces
├── config/        # Demo registry and DIT-specific config helpers
├── lib/           # Demo runtimes, server backends, and renderer wiring
└── public/        # Static assets
```

## Related packages

| Package                           | Role                             |
| --------------------------------- | -------------------------------- |
| `@kaira/chat-core`                | Core chat engine and event types |
| `@kaira/chat-react`               | React hooks (`useChat`, etc.)    |
| `@kaira/chat-ui`                  | Pre-built UI components          |
| `@kaira/chat-devtools`            | Debug overlay (dev mode only)    |
| `@kaira/chat-transport-websocket` | Generic WebSocket transport      |
| `@kaira/chat-provider-dit`        | DIT transport adapter            |

## Focused regression test

Run the persistence restore integration test directly when validating the live
demo flow:

```bash
pnpm --filter web test -- PersistenceDemo.test.tsx
```

This test verifies that the `/persistence` demo restores the last selected
thread after a reload and does not surface another thread's seeded history in
the restored view.
