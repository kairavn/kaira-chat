import type { ChatEvent } from '@kaira/chat-core';

interface SequencedChatEvent {
  readonly namespace: string;
  readonly sequence: number;
  readonly event: ChatEvent;
}

type Listener = (entry: SequencedChatEvent) => void;

const EVENT_HISTORY_MAX = 500;

interface NamespaceEventState {
  readonly listeners: Set<Listener>;
  readonly history: SequencedChatEvent[];
  nextSequence: number;
}

const namespaceStates = new Map<string, NamespaceEventState>();

function getOrCreateNamespaceState(namespace: string): NamespaceEventState {
  const existingState = namespaceStates.get(namespace);
  if (existingState) {
    return existingState;
  }

  const nextState: NamespaceEventState = {
    listeners: new Set<Listener>(),
    history: [],
    nextSequence: 1,
  };
  namespaceStates.set(namespace, nextState);
  return nextState;
}

/**
 * Publishes one chat event to all subscribers and stores a bounded event history.
 */
export function publishChatEvent(namespace: string, event: ChatEvent): void {
  const namespaceState = getOrCreateNamespaceState(namespace);
  const entry: SequencedChatEvent = {
    namespace,
    sequence: namespaceState.nextSequence,
    event,
  };
  namespaceState.nextSequence += 1;
  namespaceState.history.push(entry);

  if (namespaceState.history.length > EVENT_HISTORY_MAX) {
    namespaceState.history.splice(0, namespaceState.history.length - EVENT_HISTORY_MAX);
  }

  for (const listener of namespaceState.listeners) {
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
export function getLatestChatEventSequence(namespace: string): number | undefined {
  return namespaceStates.get(namespace)?.history.at(-1)?.sequence;
}

/**
 * Returns sequenced chat events after one exclusive cursor.
 */
export function getChatEventsAfterSequence(
  namespace: string,
  sequence: number | undefined,
  conversationId: string,
): ReadonlyArray<SequencedChatEvent> {
  return (namespaceStates.get(namespace)?.history ?? []).filter(
    (entry) =>
      entry.sequence > (sequence ?? 0) && getEventConversationId(entry.event) === conversationId,
  );
}

/**
 * Subscribes to chat events from the server-owned ChatEngine.
 */
export function subscribeChatEvents(namespace: string, listener: Listener): () => void {
  const namespaceState = getOrCreateNamespaceState(namespace);
  namespaceState.listeners.add(listener);
  return () => {
    namespaceState.listeners.delete(listener);
    if (namespaceState.listeners.size === 0 && namespaceState.history.length === 0) {
      namespaceStates.delete(namespace);
    }
  };
}

/**
 * Clears broker state. Intended for tests only.
 */
export function resetChatEventBroker(namespace?: string): void {
  if (namespace === undefined) {
    namespaceStates.clear();
    return;
  }

  namespaceStates.delete(namespace);
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
