# @kaira/web — Internal Demo App

This is the internal demo web application for the Kaira Chat SDK. It showcases
end-to-end usage of `@kaira/chat-core`, `@kaira/chat-react`, `@kaira/chat-ui`,
and `@kaira/chat-devtools` against a live DIT backend.

> **Note:** This app is intended for internal Kaira team use only. It is not
> designed for external deployment or public access.

---

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

Edit `apps/web/.env.local` — the three required server-side variables are:

| Variable    | Description                   |
| ----------- | ----------------------------- |
| `API_URL`   | Base URL of the Kaira DIT API |
| `X_API_KEY` | API authentication key        |
| `X_API_ID`  | API application/client ID     |

All other variables are optional and fall back to hardcoded development defaults.

### 3. Run locally

```bash
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000) by default.

To run only the web app without the docs site:

```bash
pnpm dev --filter=web
```

---

## Project structure

```
apps/web/
├── app/           # Next.js App Router pages and layouts
├── components/    # UI components (chat panel, providers, etc.)
├── lib/           # Shared utilities and server config
└── public/        # Static assets
```

---

## Related packages

| Package                    | Role                             |
| -------------------------- | -------------------------------- |
| `@kaira/chat-core`         | Core chat engine and event types |
| `@kaira/chat-react`        | React hooks (`useChat`, etc.)    |
| `@kaira/chat-ui`           | Pre-built UI components          |
| `@kaira/chat-devtools`     | Debug overlay (dev mode only)    |
| `@kaira/chat-provider-dit` | DIT transport implementation     |
