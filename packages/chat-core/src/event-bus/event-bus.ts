import type { Unsubscribe } from '../types/common.js';
import type { ChatEvent, ChatEventHandler, ChatEventType } from '../types/event.js';

type AnyHandler = (event: never) => void;

/**
 * Typed event bus supporting core chat events and `custom:*` plugin events.
 *
 * Core events are fully typed via `ChatEventMap`. Custom events use an
 * untyped `Record<string, unknown>` payload within the `custom:` namespace.
 */
export class EventBus {
  private readonly handlers = new Map<string, Set<AnyHandler>>();
  private readonly onceHandlers = new WeakSet<AnyHandler>();

  /** Subscribe to a core event. Returns an unsubscribe function. */
  on<E extends ChatEventType>(event: E, handler: ChatEventHandler<E>): Unsubscribe;
  /** Subscribe to a custom plugin event. */
  on(event: `custom:${string}`, handler: (event: Record<string, unknown>) => void): Unsubscribe;
  on(event: ChatEventType | `custom:${string}`, handler: AnyHandler): Unsubscribe {
    const key = event as string;
    let set = this.handlers.get(key);
    if (!set) {
      set = new Set();
      this.handlers.set(key, set);
    }
    set.add(handler);
    return () => this.offInternal(key, handler);
  }

  /** Subscribe to the next occurrence of an event only, then auto-unsubscribe. */
  once<E extends ChatEventType>(event: E, handler: ChatEventHandler<E>): Unsubscribe;
  once(event: `custom:${string}`, handler: (event: Record<string, unknown>) => void): Unsubscribe;
  once(event: ChatEventType | `custom:${string}`, handler: AnyHandler): Unsubscribe {
    this.onceHandlers.add(handler);
    return this.on(event as ChatEventType, handler as ChatEventHandler<ChatEventType>);
  }

  /** Remove a specific handler from an event. */
  off<E extends ChatEventType>(event: E, handler: ChatEventHandler<E>): void;
  off(event: `custom:${string}`, handler: (event: Record<string, unknown>) => void): void;
  off(event: ChatEventType | `custom:${string}`, handler: AnyHandler): void {
    this.offInternal(event as string, handler);
  }

  private offInternal(event: string, handler: AnyHandler): void {
    const set = this.handlers.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      this.handlers.delete(event);
    }
  }

  /** Emit a core event to all subscribed handlers. */
  emit<E extends ChatEventType>(event: E, payload: ChatEvent<E>): void;
  /** Emit a custom plugin event. */
  emit(event: `custom:${string}`, payload: Record<string, unknown>): void;
  emit(event: string, payload: unknown): void {
    // Deliver to exact subscribers
    this.deliverTo(event, payload);

    // Deliver to `custom:*` wildcard subscribers for any custom event
    if (event.startsWith('custom:') && event !== 'custom:*') {
      this.deliverTo('custom:*', payload);
    }
  }

  /** Remove all handlers (useful in tests and teardown). */
  clear(): void {
    this.handlers.clear();
  }

  private deliverTo(event: string, payload: unknown): void {
    const set = this.handlers.get(event);
    if (!set) return;

    for (const handler of [...set]) {
      const isOnce = this.onceHandlers.has(handler);
      if (isOnce) {
        set.delete(handler);
        this.onceHandlers.delete(handler);
        if (set.size === 0) {
          this.handlers.delete(event);
        }
      }

      try {
        (handler as (event: unknown) => void)(payload);
      } catch {
        // Subscriber errors must never crash the bus or other subscribers
      }
    }
  }
}
