import { describe, expect, it } from 'vitest';

import { createChatError } from './error.js';

describe('createChatError', () => {
  it('creates an error with kind and message', () => {
    const err = createChatError('transport', 'connection lost');
    expect(err).toEqual({
      kind: 'transport',
      message: 'connection lost',
      cause: undefined,
      metadata: undefined,
    });
  });

  it('includes cause when provided', () => {
    const cause = new Error('original');
    const err = createChatError('storage', 'write failed', { cause });
    expect(err.cause).toBe(cause);
  });

  it('includes metadata when provided', () => {
    const err = createChatError('validation', 'bad input', {
      metadata: { field: 'email' },
    });
    expect(err.metadata).toEqual({ field: 'email' });
  });

  it('works with all error kinds', () => {
    const kinds = [
      'transport',
      'storage',
      'middleware',
      'validation',
      'state',
      'plugin',
      'unknown',
    ] as const;
    for (const kind of kinds) {
      const err = createChatError(kind, `${kind} error`);
      expect(err.kind).toBe(kind);
    }
  });
});
