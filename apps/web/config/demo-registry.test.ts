import { describe, expect, it } from 'vitest';

import { DEMO_DEFINITIONS } from './demo-registry';

describe('demo registry', () => {
  it('exposes the required multi-demo routes with unique paths', () => {
    const routes = DEMO_DEFINITIONS.map((definition) => definition.route);

    expect(routes).toContain('/dit-modive');
    expect(routes).toContain('/next-backend');
    expect(routes).toContain('/streaming');
    expect(routes).toContain('/media');
    expect(routes).toContain('/persistence');
    expect(routes).not.toContain('/states');
    expect(new Set(routes).size).toBe(routes.length);
  });
});
