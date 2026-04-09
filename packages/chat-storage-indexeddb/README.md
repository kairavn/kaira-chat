# @kaira/chat-storage-indexeddb

IndexedDB-backed `IStorage` adapter for Kaira Chat SDK.

## Installation

```bash
npm install @kaira/chat-storage-indexeddb @kaira/chat-core
```

## Quick Start

```ts
import { ChatEngine } from '@kaira/chat-core';
import { IndexedDBStorage } from '@kaira/chat-storage-indexeddb';

const storage = new IndexedDBStorage({
  databaseName: 'my-chat-app',
});

const engine = new ChatEngine({ storage });
```

## Behavior

- Opens IndexedDB lazily on first storage access.
- Falls back to in-memory storage when IndexedDB is unavailable or the database cannot be opened.
- Persists conversations and messages only.
- Uses `ChatSerializer` payloads internally so stored entities stay aligned with the core runtime model.

## Options

```ts
interface IndexedDBStorageOptions {
  readonly databaseName?: string;
  readonly databaseVersion?: number;
  readonly fallbackStorage?: IStorage;
  readonly serializer?: Pick<
    ChatSerializer,
    'serializeMessage' | 'deserializeMessage' | 'serializeConversation' | 'deserializeConversation'
  >;
  readonly onError?: (error: Error) => void;
}
```
