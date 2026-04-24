# @kaira/chat-devtools

Developer tooling for inspecting Kaira Chat runtime state.

DevTools render in development mode only. In production, `ChatDevTools` returns `null`.

## Installation

```bash
npm install @kaira/chat-devtools @kaira/chat-react @kaira/chat-core react react-dom
```

## Quick Start

```tsx
import { ChatEngine } from '@kaira/chat-core';
import { ChatDevTools } from '@kaira/chat-devtools';

const engine = new ChatEngine();

export function DebugPanel(): JSX.Element {
  return (
    <ChatDevTools
      engine={engine}
      initiallyOpen={true}
    />
  );
}
```

## Documentation

- [DevTools docs](../../apps/docs/app/devtools/page.mdx)
- [React integration](../../apps/docs/app/react/page.mdx)
- [Examples](../../apps/docs/app/examples/page.mdx)
