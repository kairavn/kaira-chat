import type { IChatEngine } from './engine.js';
import type { ChatEvent, ChatEventType } from './event.js';

/** Read-only context passed to each middleware in the pipeline. */
export interface MiddlewareContext<E extends ChatEventType = ChatEventType> {
  readonly engine: IChatEngine;
  readonly event: ChatEvent<E>;
}

/**
 * Call the next middleware in the pipeline.
 *
 * Passing a `modifiedEvent` replaces the event for all downstream middleware
 * (immutable clone-and-replace). Omitting it forwards the current event.
 * Not calling `next` at all short-circuits the pipeline.
 */
export type NextFn = (modifiedEvent?: ChatEvent) => Promise<ChatEvent>;

/**
 * A middleware function that can inspect, transform, or short-circuit events.
 *
 * Must return the (possibly modified) event that should continue downstream.
 */
export type Middleware = (ctx: MiddlewareContext, next: NextFn) => Promise<ChatEvent>;
