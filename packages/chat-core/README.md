# @kaira/chat-core

Core chat engine for Kaira Chat SDK.

## Installation

```bash
npm install @kaira/chat-core
```

## Quick Start

```ts
import { ChatEngine } from '@kaira/chat-core';

const engine = new ChatEngine();

await engine.connect();

await engine.sendMessage('demo-room', {
  type: 'text',
  content: 'Hello world',
});

engine.notifyTyping('demo-room');
engine.stopTyping('demo-room');
```

## Typing API

`ChatEngine` exposes ephemeral conversation-scoped typing helpers:

- `notifyTyping(conversationId)`
- `stopTyping(conversationId)`
- `getTypingState(conversationId)`
- `isTyping(conversationId, participantId?)`

Typing support over transports is optional. Local typing state still updates even when the
active transport does not advertise typing capability.

## Documentation

- [Project docs](https://github.com/Kaira/chat-core)
- [Examples](https://github.com/Kaira/chat-core/tree/main/apps)
