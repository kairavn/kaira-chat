'use client';

import type { Conversation, IChatEngine, Message } from '@kaira/chat-core';
import type {
  ChatDevToolsFromContextProps,
  ChatDevToolsProps,
  ChatDevToolsState,
  DevToolsTab,
} from './types';
import type { CSSProperties, JSX } from 'react';

import { useMemo, useState } from 'react';

import { useChatEngine } from '@kaira/chat-react';

import { useChatDevTools } from './useChatDevTools';

const PANEL_STYLE: CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  width: 560,
  height: 420,
  border: '1px solid #2f3747',
  borderRadius: 10,
  backgroundColor: '#0f1420',
  color: '#e8ecf3',
  boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 99_999,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
};

const TAB_LIST: ReadonlyArray<{ readonly id: DevToolsTab; readonly label: string }> = [
  { id: 'events', label: 'Events' },
  { id: 'messages', label: 'Messages' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'streaming', label: 'Streaming' },
  { id: 'transport', label: 'Transport' },
  { id: 'plugins', label: 'Plugins' },
  { id: 'middleware', label: 'Middleware' },
] as const;

function isDevelopmentMode(): boolean {
  const globalObject = globalThis as {
    readonly process?: { readonly env?: { readonly NODE_ENV?: string } };
  };
  return globalObject.process?.env?.NODE_ENV !== 'production';
}

function messagePreview(message: Message): string {
  switch (message.type) {
    case 'text':
    case 'system':
    case 'ai':
      return message.content;
    case 'image':
      return message.url;
    case 'audio':
    case 'video':
      return message.title ?? message.url;
    case 'file':
      return message.name;
    case 'location':
      return message.label ?? `${message.latitude}, ${message.longitude}`;
    case 'custom':
      return message.customType;
    default:
      return '';
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(
      value,
      (_key, nextValue) => {
        if (nextValue instanceof Error) {
          return {
            name: nextValue.name,
            message: nextValue.message,
            stack: nextValue.stack,
          };
        }
        return nextValue;
      },
      2,
    );
  } catch {
    return '"[unserializable]"';
  }
}

function EventsTab(props: { readonly state: ChatDevToolsState }): JSX.Element {
  const { state } = props;
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const filteredEvents = useMemo(
    () =>
      state.events.filter((entry) =>
        selectedEventType === 'all' ? true : entry.type === selectedEventType,
      ),
    [selectedEventType, state.events],
  );
  const eventTypes = useMemo(
    () => ['all', ...Array.from(new Set(state.events.map((entry) => entry.type)))],
    [state.events],
  );

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span>Filter</span>
        <select
          aria-label="Filter events by type"
          value={selectedEventType}
          onChange={(event) => setSelectedEventType(event.target.value)}
          style={{
            backgroundColor: '#131a28',
            color: '#e8ecf3',
            border: '1px solid #2a3243',
            borderRadius: 6,
            padding: '4px 8px',
          }}
        >
          {eventTypes.map((eventType) => (
            <option
              key={eventType}
              value={eventType}
            >
              {eventType}
            </option>
          ))}
        </select>
      </label>
      <div
        style={{
          overflow: 'auto',
          border: '1px solid #222a39',
          borderRadius: 8,
          padding: 8,
          flex: 1,
        }}
      >
        {[...filteredEvents].reverse().map((entry) => (
          <div
            key={entry.id}
            style={{ padding: '6px 0', borderBottom: '1px dashed #1e2635' }}
          >
            <span style={{ color: '#9eacc7' }}>
              [{new Date(entry.timestamp).toLocaleTimeString()}]
            </span>{' '}
            <span style={{ color: '#8cc2ff' }}>{entry.type}</span>{' '}
            <span style={{ color: '#c5d3ea' }}>{entry.summary ? `-> ${entry.summary}` : ''}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MessagesTab(props: { readonly state: ChatDevToolsState }): JSX.Element {
  const { state } = props;
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const selectedMessage = selectedMessageId
    ? state.messages.find((message) => message.id === selectedMessageId)
    : undefined;
  const messagesByRecent = useMemo(
    () => [...state.messages].sort((left, right) => right.timestamp - left.timestamp),
    [state.messages],
  );

  return (
    <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, height: '100%' }}>
      <div style={{ overflow: 'auto', border: '1px solid #222a39', borderRadius: 8, padding: 8 }}>
        {messagesByRecent.map((message) => (
          <button
            key={message.id}
            type="button"
            onClick={() => setSelectedMessageId(message.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              marginBottom: 6,
              padding: 6,
              borderRadius: 6,
              border: message.id === selectedMessageId ? '1px solid #3d86ff' : '1px solid #2a3243',
              backgroundColor: '#111827',
              color: '#e8ecf3',
            }}
          >
            <div>{message.id}</div>
            <div style={{ color: '#95a4bf' }}>
              {message.sender.id} • {message.type} • {message.status}
            </div>
            <div
              style={{
                color: '#95a4bf',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
              }}
            >
              {messagePreview(message)}
            </div>
          </button>
        ))}
      </div>
      <pre
        style={{
          margin: 0,
          overflow: 'auto',
          border: '1px solid #222a39',
          borderRadius: 8,
          padding: 8,
        }}
      >
        {safeJson(selectedMessage)}
      </pre>
    </section>
  );
}

function getConversationMessageCount(conversation: Conversation, state: ChatDevToolsState): number {
  return state.messages.filter((message) => message.conversationId === conversation.id).length;
}

function getConversationLastMessage(
  conversation: Conversation,
  state: ChatDevToolsState,
): Message | undefined {
  const messages = state.messages
    .filter((message) => message.conversationId === conversation.id)
    .sort((left, right) => right.timestamp - left.timestamp);
  return messages[0];
}

function renderConversationsTab(state: ChatDevToolsState): JSX.Element {
  return (
    <div
      style={{
        overflow: 'auto',
        border: '1px solid #222a39',
        borderRadius: 8,
        padding: 8,
        height: '100%',
      }}
    >
      {state.conversations.map((conversation) => {
        const count = getConversationMessageCount(conversation, state);
        const lastMessage = getConversationLastMessage(conversation, state);
        return (
          <div
            key={conversation.id}
            style={{ padding: '8px 0', borderBottom: '1px dashed #1e2635' }}
          >
            <div style={{ color: '#8cc2ff' }}>{conversation.id}</div>
            <div style={{ color: '#a7b7d4' }}>
              participants={conversation.participants.length} • messageCount={count}
            </div>
            <div style={{ color: '#8f9eb8' }}>metadata={safeJson(conversation.metadata ?? {})}</div>
            <div style={{ color: '#8f9eb8' }}>
              lastMessage={lastMessage ? messagePreview(lastMessage) : '-'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderStreamingTab(state: ChatDevToolsState): JSX.Element {
  return (
    <div
      style={{
        overflow: 'auto',
        border: '1px solid #222a39',
        borderRadius: 8,
        padding: 8,
        height: '100%',
      }}
    >
      {state.streams.length === 0 ? (
        <div style={{ color: '#9eacc7', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden="true">...</span>
          <span>No active streams yet.</span>
        </div>
      ) : (
        state.streams.map((stream) => (
          <div
            key={stream.messageId}
            style={{ padding: '8px 0', borderBottom: '1px dashed #1e2635' }}
          >
            <div style={{ color: '#8cc2ff' }}>
              {stream.messageId} • {stream.status}
            </div>
            <div style={{ color: '#a7b7d4' }}>
              chunks={stream.chunks} • conversation={stream.conversationId ?? '-'}
            </div>
            <pre
              style={{
                margin: '6px 0 0',
                backgroundColor: '#0b111d',
                padding: 6,
                borderRadius: 6,
                overflowX: 'auto',
              }}
            >
              {stream.accumulated}
            </pre>
            {stream.error ? <div style={{ color: '#ff8585' }}>error={stream.error}</div> : null}
          </div>
        ))
      )}
    </div>
  );
}

function renderTransportTab(state: ChatDevToolsState): JSX.Element {
  return (
    <div style={{ border: '1px solid #222a39', borderRadius: 8, padding: 10 }}>
      <div>transportState: {state.transport.state}</div>
      <div>pollingStatus: {state.transport.pollingStatus}</div>
      <div>lastNetworkEvent: {state.transport.lastNetworkEvent ?? '-'}</div>
    </div>
  );
}

function renderPluginsTab(state: ChatDevToolsState): JSX.Element {
  return (
    <div
      style={{
        overflow: 'auto',
        border: '1px solid #222a39',
        borderRadius: 8,
        padding: 8,
        height: '100%',
      }}
    >
      {state.plugins.map((plugin) => (
        <div
          key={`${plugin.name}@${plugin.version}`}
          style={{ padding: '8px 0', borderBottom: '1px dashed #1e2635' }}
        >
          <div style={{ color: '#8cc2ff' }}>
            {plugin.name} ({plugin.version})
          </div>
          <div style={{ color: '#a7b7d4' }}>status={plugin.status}</div>
          <div style={{ color: '#8f9eb8' }}>
            install={plugin.installTime ? new Date(plugin.installTime).toLocaleTimeString() : '-'} •
            destroy=
            {plugin.destroyTime ? new Date(plugin.destroyTime).toLocaleTimeString() : '-'}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderMiddlewareTab(state: ChatDevToolsState): JSX.Element {
  return (
    <div
      style={{
        overflow: 'auto',
        border: '1px solid #222a39',
        borderRadius: 8,
        padding: 8,
        height: '100%',
      }}
    >
      {[...state.middlewareFlows].reverse().map((flow) => (
        <div
          key={flow.id}
          style={{ padding: '8px 0', borderBottom: '1px dashed #1e2635' }}
        >
          <div style={{ color: '#8cc2ff' }}>
            [{new Date(flow.timestamp).toLocaleTimeString()}] message={flow.messageId}
          </div>
          <div style={{ color: '#8f9eb8' }}>conversation={flow.conversationId}</div>
          <div style={{ marginTop: 4, color: '#c8d5ee' }}>
            {flow.steps.map((step, index) => (
              <div key={`${flow.id}-${step}-${index}`}>{index === 0 ? step : `  -> ${step}`}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderTab(tab: DevToolsTab, state: ChatDevToolsState): JSX.Element {
  switch (tab) {
    case 'events':
      return <EventsTab state={state} />;
    case 'messages':
      return <MessagesTab state={state} />;
    case 'conversations':
      return renderConversationsTab(state);
    case 'streaming':
      return renderStreamingTab(state);
    case 'transport':
      return renderTransportTab(state);
    case 'plugins':
      return renderPluginsTab(state);
    case 'middleware':
      return renderMiddlewareTab(state);
    default:
      return <div />;
  }
}

/**
 * Floating runtime inspector for ChatEngine diagnostics in development mode.
 */
export function ChatDevTools(props: ChatDevToolsProps): JSX.Element | null {
  const { engine, maxEvents, initiallyOpen = true } = props;
  const [isOpen, setOpen] = useState<boolean>(initiallyOpen);
  const [activeTab, setActiveTab] = useState<DevToolsTab>('events');
  const state = useChatDevTools(engine, { maxEvents });

  if (!isDevelopmentMode()) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        style={{
          ...PANEL_STYLE,
          width: 116,
          height: 34,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setOpen(true)}
      >
        Chat DevTools
      </button>
    );
  }

  return (
    <section
      style={PANEL_STYLE}
      aria-label="Chat developer tools"
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 8,
        }}
      >
        <div>
          <strong>Chat DevTools</strong>
          <span style={{ marginLeft: 8, color: '#9eacc7' }}>
            connection: {state.connectionState}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            border: '1px solid #2a3243',
            backgroundColor: '#111827',
            color: '#e8ecf3',
            borderRadius: 6,
          }}
        >
          Hide
        </button>
      </header>

      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 8px 8px' }}>
        {TAB_LIST.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              border: activeTab === tab.id ? '1px solid #3d86ff' : '1px solid #2a3243',
              backgroundColor: activeTab === tab.id ? '#162845' : '#111827',
              color: '#e8ecf3',
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main style={{ padding: '0 8px 8px', overflow: 'hidden', flex: 1 }}>
        {renderTab(activeTab, state)}
      </main>
    </section>
  );
}

/**
 * Context-based variant that reads the engine from ChatProvider.
 */
export function ChatDevToolsFromContext(props: ChatDevToolsFromContextProps): JSX.Element | null {
  const engine: IChatEngine = useChatEngine();
  return (
    <ChatDevTools
      engine={engine}
      maxEvents={props.maxEvents}
      initiallyOpen={props.initiallyOpen}
    />
  );
}
