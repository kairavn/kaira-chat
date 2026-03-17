import { DEFAULT_RENDERERS } from './default-renderers';
import { RendererRegistry } from './renderer-registry';

let cachedRegistry: RendererRegistry | undefined;

/**
 * Create a renderer registry preloaded with default message renderers.
 * Returns a cached singleton — safe to call from component render without memoization.
 */
export function createDefaultRendererRegistry(): RendererRegistry {
  if (!cachedRegistry) {
    cachedRegistry = new RendererRegistry();
    for (const definition of DEFAULT_RENDERERS) {
      cachedRegistry.register(definition);
    }
  }
  return cachedRegistry;
}
