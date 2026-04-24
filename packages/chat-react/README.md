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
    <ChatProvider
      engine={engine}
      autoConnect
    >
      <ChatScreen />
    </ChatProvider>
  );
}
```

`ChatProvider` keeps a stable engine instance for each mounted provider. If you
prefer lazy creation, pass `createEngine` instead of `engine`; the factory runs
once per mount. With `autoConnect`, the provider manages connect/disconnect and
survives React Strict Mode cleanup replay without leaving the engine stuck in a
stale connection state.

Conversation-scoped hooks such as `useConversation()`, `useMessages()`,
`useStreamingMessage()`, and `useTypingState()` preserve the last snapshot that
matches the current conversation id while subscriptions refresh, so changing ids
does not briefly flash empty or unrelated state.

Additional typing hooks:

- `useTypingState(conversationId)`
- `useTypingParticipants(conversationId, options?)`
- `useIsTyping(conversationId, participantId?)`
- `useTypingController(conversationId)`

## Documentation

- [React integration](../../apps/docs/app/react/page.mdx)
- [Quick start](../../apps/docs/app/quick-start/page.mdx)
- [Examples](../../apps/docs/app/examples/page.mdx)
