import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureConversation = vi.fn(async () => ({
  demoId: 'dit-modive',
  conversationId: 'conversation-1',
  conversation: {
    id: 'conversation-1',
    type: 'direct',
    participants: [
      {
        id: 'user-1',
        role: 'user',
        displayName: 'User One',
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        displayName: 'Assistant One',
      },
    ],
    createdAt: 1_710_000_000_000,
    updatedAt: 1_710_000_000_000,
  },
}));

const getDemoRuntime = vi.fn(() => ({
  ensureConversation,
  isAvailable: () => ({
    available: true,
    missingEnv: [],
  }),
}));

vi.mock('@/lib/demo/server/runtime-registry', () => ({
  getDemoRuntime,
}));

describe('legacy chat conversation route', () => {
  beforeEach(() => {
    ensureConversation.mockClear();
    getDemoRuntime.mockClear();
  });

  it('preserves the top-level conversationId field for legacy clients', async () => {
    const { POST } = await import('./route');
    const response = await POST();
    const json: unknown = await response.json();

    expect(getDemoRuntime).toHaveBeenCalledWith('dit-modive');
    expect(ensureConversation).toHaveBeenCalledTimes(1);
    expect(json).toMatchObject({
      success: true,
      conversationId: 'conversation-1',
      data: {
        conversationId: 'conversation-1',
      },
    });
  });
});
