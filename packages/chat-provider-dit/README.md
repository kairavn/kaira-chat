# @kaira/chat-provider-dit

DIT provider integration for Kaira Chat SDK.

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

- [Project docs](https://github.com/Kaira/chat-core)
- [Examples](https://github.com/Kaira/chat-core/tree/main/apps)
