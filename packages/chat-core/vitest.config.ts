import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/types/common.ts',
        'src/types/conversation.ts',
        'src/types/engine.ts',
        'src/types/event.ts',
        'src/types/message.ts',
        'src/types/middleware.ts',
        'src/types/participant.ts',
        'src/types/plugin.ts',
        'src/types/storage.ts',
        'src/types/transport.ts',
      ],
      thresholds: {
        lines: 100,
        branches: 95,
        functions: 100,
        statements: 100,
      },
    },
  },
});
