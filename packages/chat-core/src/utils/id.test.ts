import { describe, expect, it, vi } from 'vitest';

import { generateId } from './id.js';

describe('generateId', () => {
  it('returns a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('matches UUID v4 format', () => {
    const uuid = generateId();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('uses fallback when crypto.randomUUID is unavailable', () => {
    const original = crypto.randomUUID;
    vi.stubGlobal('crypto', { ...crypto, randomUUID: undefined });
    try {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      vi.stubGlobal('crypto', { ...crypto, randomUUID: original });
    }
  });
});
