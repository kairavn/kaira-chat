'use client';

import type {
  ChatEvent,
  ChatEventType,
  ConnectionState,
  Conversation,
  IChatEngine,
  Message,
} from '@kaira/chat-core';
import type {
  ChatDevToolsState,
  DevToolsEventEntry,
  EngineInternals,
  MiddlewareFlowEntry,
  PluginSnapshot,
  StreamSnapshot,
  TransportSnapshot,
} from './types';

import { useEffect, useMemo, useState } from 'react';

import { CORE_EVENT_TYPES, DEFAULT_EVENT_RING_BUFFER_SIZE } from './types';

interface EventAccumulator {
  readonly events: ReadonlyArray<DevToolsEventEntry>;
  readonly nextId: number;
}

interface UseChatDevToolsOptions {
  readonly maxEvents?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasTransportSnapshotCandidate(
  value: unknown,
): value is NonNullable<EngineInternals['transport']> {
  return isRecord(value) && typeof value['getState'] === 'function';
}

function engineInternals(engine: IChatEngine): EngineInternals {
  if (!isRecord(engine)) {
    return {};
  }

  const pipeline = isRecord(engine['pipeline']) ? engine['pipeline'] : undefined;
  const plugins = Array.isArray(engine['plugins']) ? engine['plugins'] : undefined;
  const transport = isRecord(engine['transport']) ? engine['transport'] : undefined;

  return {
    pipeline: pipeline
      ? {
          stack: Array.isArray(pipeline['stack']) ? pipeline['stack'] : undefined,
        }
      : undefined,
    plugins:
      plugins?.filter((plugin): plugin is { readonly name: string; readonly version: string } => {
        if (!isRecord(plugin)) return false;
        return typeof plugin['name'] === 'string' && typeof plugin['version'] === 'string';
      }) ?? undefined,
    transport: hasTransportSnapshotCandidate(transport) ? transport : undefined,
  };
}

function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

function summarizeEvent(
  type: ChatEventType | `custom:${string}`,
  payload: ChatEvent | Record<string, unknown>,
): string {
  const payloadRecord: Record<string, unknown> | undefined = isRecord(payload)
    ? payload
    : undefined;

  if (type === 'connection:state' && payloadRecord && typeof payloadRecord['state'] === 'string') {
    return `state=${payloadRecord['state']}`;
  }
  if (
    type === 'message:sent' &&
    payloadRecord &&
    isRecord(payloadRecord['message']) &&
    typeof payloadRecord['message']['id'] === 'string'
  ) {
    return `id=${payloadRecord['message']['id']}`;
  }
  if (
    type === 'message:received' &&
    payloadRecord &&
    isRecord(payloadRecord['message']) &&
    typeof payloadRecord['message']['id'] === 'string'
  ) {
    return `id=${payloadRecord['message']['id']}`;
  }
  if (
    type === 'message:stream:start' &&
    payloadRecord &&
    typeof payloadRecord['messageId'] === 'string'
  ) {
    return `messageId=${payloadRecord['messageId']}`;
  }
  if (
    type === 'message:stream:chunk' &&
    payloadRecord &&
    typeof payloadRecord['messageId'] === 'string'
  ) {
    return `messageId=${payloadRecord['messageId']}`;
  }
  if (
    type === 'message:stream:end' &&
    payloadRecord &&
    isRecord(payloadRecord['message']) &&
    typeof payloadRecord['message']['id'] === 'string'
  ) {
    return `messageId=${payloadRecord['message']['id']}`;
  }
  return '';
}

function appendRingEntry(
  current: EventAccumulator,
  type: ChatEventType | `custom:${string}`,
  payload: ChatEvent | Record<string, unknown>,
  maxEvents: number,
): EventAccumulator {
  const payloadRecord: Record<string, unknown> | undefined = isRecord(payload)
    ? payload
    : undefined;
  const timestamp =
    payloadRecord && typeof payloadRecord['timestamp'] === 'number'
      ? payloadRecord['timestamp']
      : Date.now();
  const entry: DevToolsEventEntry = {
    id: current.nextId,
    type,
    timestamp,
    payload,
    summary: summarizeEvent(type, payload),
  };
  const nextEvents = [...current.events, entry];
  const bounded =
    nextEvents.length > maxEvents ? nextEvents.slice(nextEvents.length - maxEvents) : nextEvents;
  return {
    events: bounded,
    nextId: current.nextId + 1,
  };
}

function upsertMessage(messages: ReadonlyArray<Message>, message: Message): ReadonlyArray<Message> {
  const index = messages.findIndex((item) => item.id === message.id);
  if (index === -1) {
    return [...messages, message].sort((left, right) => left.timestamp - right.timestamp);
  }
  return messages.map((item) => (item.id === message.id ? message : item));
}

function removeMessage(
  messages: ReadonlyArray<Message>,
  messageId: string,
): ReadonlyArray<Message> {
  return messages.filter((message) => message.id !== messageId);
}

function upsertConversation(
  conversations: ReadonlyArray<Conversation>,
  conversation: Conversation,
): ReadonlyArray<Conversation> {
  const index = conversations.findIndex((item) => item.id === conversation.id);
  if (index === -1) {
    return [...conversations, conversation].sort((left, right) => left.updatedAt - right.updatedAt);
  }
  return conversations
    .map((item) => (item.id === conversation.id ? conversation : item))
    .sort((left, right) => left.updatedAt - right.updatedAt);
}

function removeConversation(
  conversations: ReadonlyArray<Conversation>,
  conversationId: string,
): ReadonlyArray<Conversation> {
  return conversations.filter((conversation) => conversation.id !== conversationId);
}

function initializePlugins(
  engine: IChatEngine,
  connectionState: ConnectionState,
): ReadonlyArray<PluginSnapshot> {
  const pluginList = engineInternals(engine).plugins ?? [];
  const now = Date.now();
  return pluginList.map((plugin) => ({
    name: plugin.name,
    version: plugin.version,
    status: connectionState === 'connected' ? 'installed' : 'registered',
    installTime: connectionState === 'connected' ? now : undefined,
  }));
}

function updatePluginLifecycle(
  current: ReadonlyArray<PluginSnapshot>,
  connectionState: ConnectionState,
): ReadonlyArray<PluginSnapshot> {
  const now = Date.now();
  return current.map((plugin) => {
    if (connectionState === 'connected') {
      return {
        ...plugin,
        status: 'installed',
        installTime: plugin.installTime ?? now,
      };
    }
    if (connectionState === 'disconnected' && plugin.status === 'installed') {
      return {
        ...plugin,
        status: 'destroyed',
        destroyTime: plugin.destroyTime ?? now,
      };
    }
    return plugin;
  });
}

function middlewareNames(engine: IChatEngine): ReadonlyArray<string> {
  const stack = engineInternals(engine).pipeline?.stack ?? [];
  return stack.map((middleware, index) => {
    if (typeof middleware === 'function' && middleware.name) {
      return `middleware: ${middleware.name}`;
    }
    return `middleware: #${index + 1}`;
  });
}

function transportSnapshot(
  engine: IChatEngine,
  connectionState: ConnectionState,
  lastNetworkEvent?: string,
): TransportSnapshot {
  const transport = engineInternals(engine).transport;
  const state = transport ? transport.getState() : connectionState;
  const pollingStatusValue = transport && isRecord(transport) ? transport['isPolling'] : undefined;
  const pollingStatus =
    typeof pollingStatusValue === 'boolean' ? (pollingStatusValue ? 'active' : 'idle') : 'unknown';
  return {
    state,
    pollingStatus,
    lastNetworkEvent,
  };
}

/**
 * Captures runtime chat engine diagnostics for the developer tools UI.
 */
export function useChatDevTools(
  engine: IChatEngine,
  options: UseChatDevToolsOptions = {},
): ChatDevToolsState {
  const maxEvents = options.maxEvents ?? DEFAULT_EVENT_RING_BUFFER_SIZE;

  const [connectionState, setConnectionState] = useState<ConnectionState>(
    engine.getConnectionState(),
  );
  const [events, setEvents] = useState<EventAccumulator>({ events: [], nextId: 1 });
  const [messages, setMessages] = useState<ReadonlyArray<Message>>([]);
  const [conversations, setConversations] = useState<ReadonlyArray<Conversation>>([]);
  const [streams, setStreams] = useState<ReadonlyArray<StreamSnapshot>>([]);
  const [lastNetworkEvent, setLastNetworkEvent] = useState<string | undefined>(undefined);
  const [middlewareFlows, setMiddlewareFlows] = useState<ReadonlyArray<MiddlewareFlowEntry>>([]);
  const [plugins, setPlugins] = useState<ReadonlyArray<PluginSnapshot>>(() =>
    initializePlugins(engine, engine.getConnectionState()),
  );

  useEffect(() => {
    let isMounted = true;
    const load = async (): Promise<void> => {
      const page = await engine.getConversations();
      if (!isMounted) return;
      setConversations(page.items);
      const messagePages = await Promise.all(
        page.items.map((conversation) => engine.getMessages({ conversationId: conversation.id })),
      );
      if (!isMounted) return;
      setMessages(
        messagePages
          .flatMap((result) => result.items)
          .sort((left, right) => left.timestamp - right.timestamp),
      );
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [engine]);

  useEffect(() => {
    setPlugins(initializePlugins(engine, engine.getConnectionState()));
  }, [engine]);

  useEffect(() => {
    const unsubs = CORE_EVENT_TYPES.map((eventType) =>
      engine.on(eventType, (event) => {
        setEvents((current) => appendRingEntry(current, eventType, event, maxEvents));
        setLastNetworkEvent(`${formatEventTime(event.timestamp)} ${eventType}`);
      }),
    );

    const customUnsub = engine.on('custom:*', (event) => {
      setEvents((current) => appendRingEntry(current, 'custom:*', event, maxEvents));
      setLastNetworkEvent(`${formatEventTime(Date.now())} custom:*`);
    });

    const unsubsAll = [...unsubs, customUnsub];

    const unsubscribeConnection = engine.on('connection:state', (event) => {
      setConnectionState(event.state);
      setPlugins((current) => updatePluginLifecycle(current, event.state));
    });

    const unsubscribeMessageSent = engine.on('message:sent', (event) => {
      setMessages((current) => upsertMessage(current, event.message));
      const steps = ['sendMessage()', ...middlewareNames(engine), 'transport.send()'];
      setMiddlewareFlows((current) => {
        const next: MiddlewareFlowEntry = {
          id: current.length + 1,
          timestamp: event.timestamp,
          messageId: event.message.id,
          conversationId: event.message.conversationId,
          steps,
        };
        const merged = [...current, next];
        return merged.length > 100 ? merged.slice(merged.length - 100) : merged;
      });
    });

    const unsubscribeMessageReceived = engine.on('message:received', (event) => {
      setMessages((current) => upsertMessage(current, event.message));
    });

    const unsubscribeMessageUpdated = engine.on('message:updated', (event) => {
      setMessages((current) => upsertMessage(current, event.message));
    });

    const unsubscribeMessageDeleted = engine.on('message:deleted', (event) => {
      setMessages((current) => removeMessage(current, event.messageId));
    });

    const unsubscribeConversationCreated = engine.on('conversation:created', (event) => {
      setConversations((current) => upsertConversation(current, event.conversation));
    });

    const unsubscribeConversationUpdated = engine.on('conversation:updated', (event) => {
      setConversations((current) => upsertConversation(current, event.conversation));
    });

    const unsubscribeConversationDeleted = engine.on('conversation:deleted', (event) => {
      setConversations((current) => removeConversation(current, event.conversationId));
    });

    const unsubscribeStreamStart = engine.on('message:stream:start', (event) => {
      setStreams((current) => {
        const nextStream: StreamSnapshot = {
          messageId: event.messageId,
          conversationId: event.conversationId,
          startedAt: event.timestamp,
          lastUpdatedAt: event.timestamp,
          chunks: 0,
          accumulated: '',
          status: 'streaming',
        };
        const withoutMessage = current.filter((stream) => stream.messageId !== event.messageId);
        return [...withoutMessage, nextStream].sort(
          (left, right) => right.lastUpdatedAt - left.lastUpdatedAt,
        );
      });
    });

    const unsubscribeStreamChunk = engine.on('message:stream:chunk', (event) => {
      setStreams((current) => {
        const existing = current.find((stream) => stream.messageId === event.messageId);
        if (!existing) {
          return current;
        }
        const updated: StreamSnapshot = {
          ...existing,
          lastUpdatedAt: event.timestamp,
          chunks: existing.chunks + 1,
          accumulated: event.accumulated,
          status: 'streaming',
        };
        return current
          .map((stream) => (stream.messageId === event.messageId ? updated : stream))
          .sort((left, right) => right.lastUpdatedAt - left.lastUpdatedAt);
      });
    });

    const unsubscribeStreamEnd = engine.on('message:stream:end', (event) => {
      setMessages((current) => upsertMessage(current, event.message));
      setStreams((current) => {
        const nextStreams = current.map((stream): StreamSnapshot => {
          if (
            stream.messageId !== event.message.id ||
            stream.conversationId !== event.message.conversationId
          ) {
            return stream;
          }

          return {
            ...stream,
            lastUpdatedAt: event.timestamp,
            status: 'ended',
          };
        });
        return nextStreams.sort((left, right) => right.lastUpdatedAt - left.lastUpdatedAt);
      });
    });

    const unsubscribeStreamError = engine.on('message:stream:error', (event) => {
      setStreams((current) => {
        const nextStreams = current.map((stream): StreamSnapshot => {
          if (
            stream.messageId !== event.messageId ||
            stream.conversationId !== event.conversationId
          ) {
            return stream;
          }

          return {
            ...stream,
            lastUpdatedAt: event.timestamp,
            status: 'error',
            error: event.error.message,
          };
        });
        return nextStreams.sort((left, right) => right.lastUpdatedAt - left.lastUpdatedAt);
      });
    });

    return () => {
      unsubscribeConnection();
      unsubscribeMessageSent();
      unsubscribeMessageReceived();
      unsubscribeMessageUpdated();
      unsubscribeMessageDeleted();
      unsubscribeConversationCreated();
      unsubscribeConversationUpdated();
      unsubscribeConversationDeleted();
      unsubscribeStreamStart();
      unsubscribeStreamChunk();
      unsubscribeStreamEnd();
      unsubscribeStreamError();
      unsubsAll.forEach((unsubscribe) => unsubscribe());
    };
  }, [engine, maxEvents]);

  const transport = useMemo(
    () => transportSnapshot(engine, connectionState, lastNetworkEvent),
    [connectionState, engine, lastNetworkEvent],
  );

  return {
    connectionState,
    events: events.events,
    messages,
    conversations,
    streams,
    transport,
    plugins,
    middlewareFlows,
  };
}
