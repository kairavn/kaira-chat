# @kaira/chat-ui

UI components for Kaira Chat SDK.

## Installation

```bash
npm install @kaira/chat-ui @kaira/chat-react @kaira/chat-core react react-dom
```

## Quick Start

```tsx
import { MessageInput } from '@kaira/chat-ui';

export function Composer(): JSX.Element {
  return (
    <MessageInput
      onSubmit={async (content) => {
        console.log('submit', content);
      }}
    />
  );
}
```

## Documentation

- [Project docs](https://github.com/Kaira/chat-core)
- [Examples](https://github.com/Kaira/chat-core/tree/main/apps)
