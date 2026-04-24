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
  pollAfterSend: true,
  poll: async () => [],
  send: async (event) => {
    console.log('send', event.type);
  },
});
```

## Documentation

- [Transport API](../../apps/docs/app/transport/page.mdx)
- [Quick start](../../apps/docs/app/quick-start/page.mdx)
- [Examples](../../apps/docs/app/examples/page.mdx)
