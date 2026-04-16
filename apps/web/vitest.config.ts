import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@kaira/chat-core': resolve(__dirname, '../../packages/chat-core/src/index.ts'),
      '@kaira/chat-react': resolve(__dirname, '../../packages/chat-react/src/index.ts'),
      '@kaira/chat-ui': resolve(__dirname, '../../packages/chat-ui/src/index.ts'),
      '@kaira/chat-devtools': resolve(__dirname, '../../packages/chat-devtools/src/index.ts'),
      '@kaira/chat-storage-indexeddb': resolve(
        __dirname,
        '../../packages/chat-storage-indexeddb/src/index.ts',
      ),
      '@kaira/chat-transport-polling': resolve(
        __dirname,
        '../../packages/chat-transport-polling/src/index.ts',
      ),
      '@kaira/chat-transport-websocket': resolve(
        __dirname,
        '../../packages/chat-transport-websocket/src/index.ts',
      ),
      '@kaira/chat-provider-dit': resolve(
        __dirname,
        '../../packages/chat-provider-dit/src/index.ts',
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts', 'components/**/*.test.tsx'],
  },
});
