# @kaira/chat-provider-dit

DIT transport adapter for Kaira Chat SDK.

## Installation

```bash
npm install @kaira/chat-provider-dit @kaira/chat-core
```

## Quick Start

```ts
import { DitTransport } from '@kaira/chat-provider-dit';

const transport = new DitTransport({
  apiUrl: 'https://your-dit-api.example.com',
  apiKey: process.env.DIT_API_KEY ?? '',
  chatroomId: 'chatroom-id',
  senderId: 'sender-id',
  chatbotNickname: 'dit-assistant',
  pollIntervalMs: 2000,
  send: {
    apiId: 'api-user-id',
    sessionId: 'session-id',
    appContext: {
      username: 'demo-user',
      gender: 'unknown',
      dob: '1990-01-01',
    },
  },
});
```

## Documentation

- [Transport API](../../apps/docs/app/transport/page.mdx)
- [Examples](../../apps/docs/app/examples/page.mdx)
- [Internal demo app](../../apps/web/README.md)
