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

Additional runtime helpers:

- `getCurrentParticipant()`
- `supportsTyping()`
- `emitStreamStart(messageId, conversationId)`
- `emitStreamChunk(messageId, chunk, accumulated)`
- `emitStreamEnd(message)`
- `emitStreamError(messageId, conversationId, error)`

Provider-specific transcript payloads should use `custom` messages. Built-in SDK defaults do not
include tool invocation transcript semantics.

## Documentation

- [Core API](../../apps/docs/app/core-api/page.mdx)
- [Events](../../apps/docs/app/events/page.mdx)
- [Examples](../../apps/docs/app/examples/page.mdx)
