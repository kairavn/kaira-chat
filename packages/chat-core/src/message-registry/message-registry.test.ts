import { describe, expect, it } from 'vitest';

import { MessageRegistry } from './message-registry.js';

describe('MessageRegistry', () => {
  it('registers and retrieves a definition', () => {
    const registry = new MessageRegistry();
    const definition = { type: 'custom:event' };
    registry.register(definition);

    expect(registry.has('custom:event')).toBe(true);
    expect(registry.get('custom:event')).toEqual(definition);
  });

  it('lists registered definitions', () => {
    const registry = new MessageRegistry();
    registry.register({ type: 'text' });
    registry.register({ type: 'image' });

    const types = registry.list().map((item) => item.type);
    expect(types).toEqual(['text', 'image']);
  });

  it('replaces definition when registering same type', () => {
    const registry = new MessageRegistry();
    registry.register({ type: 'text', validate: () => true });
    const nextValidate = () => false;
    registry.register({ type: 'text', validate: nextValidate });

    expect(registry.get('text')?.validate).toBe(nextValidate);
  });

  it('throws for empty type', () => {
    const registry = new MessageRegistry();
    expect(() => registry.register({ type: '   ' })).toThrowError(
      'Message type must be a non-empty string',
    );
  });
});
