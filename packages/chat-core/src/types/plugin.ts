import type { IChatEngine } from './engine.js';

/**
 * A plugin that extends chat engine behaviour.
 *
 * Plugins are registered via `engine.use(plugin)`. The engine calls `install`
 * during registration and `destroy` (if defined) on disconnect.
 */
export interface ChatPlugin {
  /** Unique human-readable plugin name. */
  readonly name: string;
  /** Semver version string. */
  readonly version: string;
  /** Called when the plugin is registered on the engine. */
  install(engine: IChatEngine): void | Promise<void>;
  /** Called when the engine disconnects. */
  destroy?(): void | Promise<void>;
}
