import type { IChatEngine } from '../types/engine.js';
import type { ChatEvent } from '../types/event.js';
import type { Middleware, MiddlewareContext } from '../types/middleware.js';

import { createChatError } from '../types/error.js';

/**
 * Executes middleware in registration order using an immutable
 * clone-and-replace pattern.
 *
 * Each middleware receives a readonly context (with the engine reference)
 * and calls `next()` — optionally with a modified event — to pass control
 * downstream. Not calling `next()` short-circuits the pipeline.
 */
export class MiddlewarePipeline {
  private readonly stack: Middleware[] = [];

  /** Register a middleware at the end of the pipeline. */
  use(mw: Middleware): void {
    this.stack.push(mw);
  }

  /** Remove a previously registered middleware. */
  remove(mw: Middleware): void {
    const idx = this.stack.indexOf(mw);
    if (idx !== -1) {
      this.stack.splice(idx, 1);
    }
  }

  /** Run the full pipeline for an event and return the (possibly transformed) result. */
  async run(event: ChatEvent, engine: IChatEngine): Promise<ChatEvent> {
    if (this.stack.length === 0) {
      return event;
    }

    let index = 0;

    const next = async (modifiedEvent?: ChatEvent): Promise<ChatEvent> => {
      const current = modifiedEvent ?? event;

      if (index >= this.stack.length) {
        return current;
      }

      const mw = this.stack[index++]!;
      const ctx: MiddlewareContext = { engine, event: current };

      try {
        return await mw(ctx, async (nextModified?: ChatEvent) => {
          event = nextModified ?? current;
          return next(event);
        });
      } catch (err) {
        throw createChatError('middleware', `Middleware at index ${index - 1} threw`, {
          cause: err,
        });
      }
    };

    return next(event);
  }

  /** Number of registered middleware. */
  get size(): number {
    return this.stack.length;
  }

  /** Remove all middleware. */
  clear(): void {
    this.stack.length = 0;
  }
}
