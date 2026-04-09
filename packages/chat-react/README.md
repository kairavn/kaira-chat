# @kaira/chat-react

React bindings for Kaira Chat SDK.

## Installation

```bash
npm install @kaira/chat-react @kaira/chat-core react react-dom
```

## Quick Start

```tsx
import { ChatEngine } from '@kaira/chat-core';
import {
  ChatProvider,
  useMessages,
  useSendMessage,
  useTypingController,
  useTypingParticipants,
} from '@kaira/chat-react';
import { MessageInput, TypingIndicator } from '@kaira/chat-ui';

const engine = new ChatEngine();
const conversationId = 'demo-room';

function ChatScreen(): JSX.Element {
  const messages = useMessages(conversationId);
  const sendMessage = useSendMessage();
  const typingParticipants = useTypingParticipants(conversationId);
  const { notifyTyping, stopTyping } = useTypingController(conversationId);

  return (
    <>
      <div>Messages: {messages.length}</div>
      <TypingIndicator participants={typingParticipants} />
      <MessageInput
        onValueChange={(text) => {
          if (text.trim()) {
            notifyTyping();
            return;
          }

          stopTyping();
        }}
        onBlur={stopTyping}
        onSend={async (text) => {
          stopTyping();
          await sendMessage(conversationId, {
            type: 'text',
            content: text,
          });
        }}
      />
    </>
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

Additional typing hooks:

- `useTypingState(conversationId)`
- `useTypingParticipants(conversationId, options?)`
- `useIsTyping(conversationId, participantId?)`
- `useTypingController(conversationId)`

## Documentation

- [Project docs](https://github.com/Kaira/chat-core)
- [Examples](https://github.com/Kaira/chat-core/tree/main/apps)
