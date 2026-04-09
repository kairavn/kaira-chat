# @kaira/chat-transport-polling

Polling transport for Kaira Chat SDK.

## Installation

```bash
npm install @kaira/chat-transport-polling @kaira/chat-core
```

## Quick Start

```ts
import { PollingTransport } from '@kaira/chat-transport-polling';

const transport = new PollingTransport({
  intervalMs: 1000,
  poll: async () => [],
  send: async (event) => {
    console.log('send', event.type);
  },
});
```

## Documentation

- [Project docs](https://github.com/Kaira/chat-core)
- [Examples](https://github.com/Kaira/chat-core/tree/main/apps)
