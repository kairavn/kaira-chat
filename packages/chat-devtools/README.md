# @kaira/chat-devtools

Developer tooling for inspecting Kaira Chat runtime state.

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

- [Project docs](https://github.com/Kaira/chat-core)
- [Examples](https://github.com/Kaira/chat-core/tree/main/apps)
