# @kaira/chat-react

React bindings for Kaira Chat SDK.

## Installation

```bash
npm install @kaira/chat-react @kaira/chat-core react react-dom
```

## Quick Start

```tsx
import { ChatEngine } from '@kaira/chat-core';
import { ChatProvider, useMessages, useSendMessage } from '@kaira/chat-react';

const engine = new ChatEngine();
const conversationId = 'demo-room';

function ChatScreen(): JSX.Element {
  const messages = useMessages(conversationId);
  const sendMessage = useSendMessage();

  return (
    <button
      type="button"
      onClick={() =>
        sendMessage(conversationId, {
          type: 'text',
          content: 'Hello world',
        })
      }
    >
      Send ({messages.length})
    </button>
  );
}

export function App(): JSX.Element {
  return (
    <ChatProvider engine={engine}>
      <ChatScreen />
    </ChatProvider>
  );
}
```

## Documentation

- [Project docs](https://github.com/Kaira/chat-core)
- [Examples](https://github.com/Kaira/chat-core/tree/main/apps)
