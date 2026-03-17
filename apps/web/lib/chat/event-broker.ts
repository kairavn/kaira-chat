import type { ChatEvent } from '@kaira/chat-core';

type Listener = (event: ChatEvent) => void;

const listeners = new Set<Listener>();

/**
 * Publishes one chat event to all subscribers.
 */
export function publishChatEvent(event: ChatEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Best-effort fan-out.
    }
  }
}

/**
 * Subscribes to chat events from the server-owned ChatEngine.
 */
export function subscribeChatEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
