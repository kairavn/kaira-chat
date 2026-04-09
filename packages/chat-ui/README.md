# @kaira/chat-ui

UI components for Kaira Chat SDK.

## Installation

```bash
npm install @kaira/chat-ui @kaira/chat-react @kaira/chat-core react react-dom
```

## Quick Start

```tsx
import { MessageInput, TypingIndicator } from '@kaira/chat-ui';

export function Composer(): JSX.Element {
  return (
    <>
      <TypingIndicator participants={[]} />
      <MessageInput
        onValueChange={(value) => {
          console.log('draft', value);
        }}
        onBlur={() => {
          console.log('composer blurred');
        }}
        onSend={async (content) => {
          console.log('submit', content);
        }}
      />
    </>
  );
}
```

## Documentation

- [Project docs](https://github.com/Kaira/chat-core)
- [Examples](https://github.com/Kaira/chat-core/tree/main/apps)
