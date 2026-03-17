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

await engine.sendMessage({
  conversationId: 'demo-room',
  type: 'text',
  content: 'Hello world',
});
```

## Documentation

- [Project docs](https://github.com/Kaira/chat-core)
- [Examples](https://github.com/Kaira/chat-core/tree/main/apps)
