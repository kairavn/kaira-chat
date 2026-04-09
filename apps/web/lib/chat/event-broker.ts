import type { ChatEvent } from '@kaira/chat-core';

interface SequencedChatEvent {
  readonly sequence: number;
  readonly event: ChatEvent;
}

type Listener = (entry: SequencedChatEvent) => void;

const EVENT_HISTORY_MAX = 500;

const listeners = new Set<Listener>();
const eventHistory: SequencedChatEvent[] = [];
let nextSequence = 1;

/**
 * Publishes one chat event to all subscribers and stores a bounded event history.
 */
export function publishChatEvent(event: ChatEvent): void {
  const entry: SequencedChatEvent = {
    sequence: nextSequence,
    event,
  };
  nextSequence += 1;
  eventHistory.push(entry);

  if (eventHistory.length > EVENT_HISTORY_MAX) {
    eventHistory.splice(0, eventHistory.length - EVENT_HISTORY_MAX);
  }

  for (const listener of listeners) {
    try {
      listener(entry);
    } catch {
      // Best-effort fan-out.
    }
  }
}

/**
 * Returns the latest published event sequence, if any.
 */
export function getLatestChatEventSequence(): number | undefined {
  return eventHistory.at(-1)?.sequence;
}

/**
 * Returns sequenced chat events after one exclusive cursor.
 */
export function getChatEventsAfterSequence(
  sequence: number | undefined,
  conversationId: string,
): ReadonlyArray<SequencedChatEvent> {
  return eventHistory.filter(
    (entry) =>
      entry.sequence > (sequence ?? 0) && getEventConversationId(entry.event) === conversationId,
  );
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

/**
 * Clears broker state. Intended for tests only.
 */
export function resetChatEventBroker(): void {
  listeners.clear();
  eventHistory.length = 0;
  nextSequence = 1;
}

function getEventConversationId(event: ChatEvent): string | undefined {
  if ('conversationId' in event && typeof event.conversationId === 'string') {
    return event.conversationId;
  }

  if ('message' in event && typeof event.message.conversationId === 'string') {
    return event.message.conversationId;
  }

  return undefined;
}
