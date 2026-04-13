import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@kaira/chat-core': resolve(__dirname, '../chat-core/src/index.ts'),
      '@kaira/chat-react': resolve(__dirname, '../chat-react/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
