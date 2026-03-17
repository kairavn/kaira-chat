import { resolve } from 'node:path';

export default {
  resolve: {
    alias: {
      '@kaira/chat-core': resolve(__dirname, '../chat-core/src/index.ts'),
      '@kaira/chat-transport-polling': resolve(__dirname, '../chat-transport-polling/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
  },
};
