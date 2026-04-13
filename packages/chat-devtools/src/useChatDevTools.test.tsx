'use client';

import type {
  ChatPlugin,
  ConnectionState,
  Conversation,
  ConversationQuery,
  CursorPage,
  IStorage,
  ITransport,
  Message,
  MessageQuery,
  Middleware,
  TransportCapabilities,
  TransportEvent,
  Unsubscribe,
} from '@kaira/chat-core';

import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ChatEngine } from '@kaira/chat-core';
import { ChatProvider } from '@kaira/chat-react';

import { ChatDevTools, ChatDevToolsFromContext } from './ChatDevTools';
import { useChatDevTools } from './useChatDevTools';

class TestStorage implements IStorage {
  private readonly messages = new Map<string, Message>();
  private readonly conversations = new Map<string, Conversation>();

  async saveMessage(message: Message): Promise<void> {
    this.messages.set(message.id, message);
  }

  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessages(query: MessageQuery): Promise<CursorPage<Message>> {
    const items = [...this.messages.values()]
      .filter((message) => message.conversationId === query.conversationId)
      .sort((left, right) => left.timestamp - right.timestamp);
    return {
      items,
      hasMore: false,
    };
  }

  async updateMessage(id: string, update: Partial<Message>): Promise<void> {
    const existing = this.messages.get(id);
    if (!existing) {
      return;
    }

    this.messages.set(id, {
      ...existing,
      ...update,
    });
  }

  async deleteMessage(id: string): Promise<void> {
    this.messages.delete(id);
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    this.conversations.set(conversation.id, conversation);
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversations(_query?: ConversationQuery): Promise<CursorPage<Conversation>> {
    return {
      items: [...this.conversations.values()].sort(
        (left, right) => left.updatedAt - right.updatedAt,
      ),
      hasMore: false,
    };
  }

  async updateConversation(id: string, update: Partial<Conversation>): Promise<void> {
    const existing = this.conversations.get(id);
    if (!existing) {
      return;
    }

    this.conversations.set(id, {
      ...existing,
      ...update,
    });
  }

  async deleteConversation(id: string): Promise<void> {
    this.conversations.delete(id);
  }

  async clear(): Promise<void> {
    this.messages.clear();
    this.conversations.clear();
  }
}

class InspectableTransport implements ITransport<
  TransportEvent<'message'>,
  TransportEvent<'message' | 'typing'>
> {
  readonly capabilities: TransportCapabilities = {
    typing: true,
  };

  isPolling = false;

  private readonly messageHandlers = new Set<(event: TransportEvent<'message'>) => void>();
  private readonly stateHandlers = new Set<(state: ConnectionState) => void>();
  private state: ConnectionState = 'disconnected';

  async connect(): Promise<void> {
    this.setState('connecting');
    this.isPolling = true;
    this.setState('connected');
  }

  async disconnect(): Promise<void> {
    this.setState('disconnecting');
    this.isPolling = false;
    this.setState('disconnected');
  }

  async send(_event: TransportEvent<'message' | 'typing'>): Promise<void> {
    return;
  }

  onMessage(handler: (event: TransportEvent<'message'>) => void): Unsubscribe {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onStateChange(handler: (state: ConnectionState) => void): Unsubscribe {
    this.stateHandlers.add(handler);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  getState(): ConnectionState {
    return this.state;
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    for (const handler of this.stateHandlers) {
      handler(state);
    }
  }
}

interface EngineFixture {
  readonly engine: ChatEngine;
  readonly conversation: Conversation;
  readonly plugin: ChatPlugin;
  readonly transport: InspectableTransport;
}

const auditMiddleware: Middleware = async function auditMiddleware(_context, next) {
  return next();
};

function createPlugin(): ChatPlugin {
  return {
    name: 'debug-plugin',
    version: '1.2.3',
    install(): void {
      return;
    },
  };
}

async function createEngineFixture(): Promise<EngineFixture> {
  const storage = new TestStorage();
  const transport = new InspectableTransport();
  const plugin = createPlugin();

  const engine = new ChatEngine({
    storage,
    transport,
    plugins: [plugin],
    middleware: [auditMiddleware],
    sender: {
      id: 'self',
      role: 'user',
      displayName: 'Self',
    },
  });
  await engine.connect();
  const conversation = await engine.createConversation({
    type: 'direct',
    participants: [
      {
        id: 'self',
        role: 'user',
        displayName: 'Self',
      },
      {
        id: 'assistant',
        role: 'assistant',
        displayName: 'Assistant',
      },
    ],
  });

  return {
    engine,
    conversation,
    plugin,
    transport,
  };
}

async function emitCompletedStream(engine: ChatEngine, conversationId: string): Promise<void> {
  engine.emitStreamStart('stream-1', conversationId);
  engine.emitStreamChunk('stream-1', 'Hello', 'Hello');
  await engine.emitStreamEnd({
    id: 'stream-1',
    conversationId,
    sender: {
      id: 'assistant',
      role: 'assistant',
      displayName: 'Assistant',
    },
    timestamp: Date.now(),
    status: 'sent',
    type: 'ai',
    content: 'Hello',
    streamState: 'complete',
  });
}

describe('useChatDevTools', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('captures runtime snapshots, bounded events, streams, middleware, and plugin state', async () => {
    const { engine, conversation, plugin, transport } = await createEngineFixture();

    const { result } = renderHook(() => useChatDevTools(engine, { maxEvents: 2 }));

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });
    expect(result.current.plugins).toEqual([
      expect.objectContaining({
        name: plugin.name,
        version: plugin.version,
        status: 'installed',
      }),
    ]);
    expect(result.current.transport.state).toBe('connected');
    expect(result.current.transport.pollingStatus).toBe('active');

    await act(async () => {
      await engine.sendMessage(conversation.id, {
        type: 'text',
        content: 'hello world',
      });
      await emitCompletedStream(engine, conversation.id);
    });

    await waitFor(() => {
      expect(result.current.messages.some((message) => message.id === 'stream-1')).toBe(true);
    });

    expect(result.current.events).toHaveLength(2);
    expect(result.current.events.map((entry) => entry.type)).toEqual([
      'message:stream:chunk',
      'message:stream:end',
    ]);
    expect(result.current.streams).toEqual([
      expect.objectContaining({
        messageId: 'stream-1',
        status: 'ended',
        chunks: 1,
        accumulated: 'Hello',
      }),
    ]);
    expect(result.current.middlewareFlows).toEqual([
      expect.objectContaining({
        conversationId: conversation.id,
        steps: ['sendMessage()', expect.stringMatching(/^middleware:/), 'transport.send()'],
      }),
    ]);
    expect(transport.getState()).toBe('connected');
  });

  it('clears stale diagnostics when the engine instance changes', async () => {
    const firstFixture = await createEngineFixture();
    const { result, rerender } = renderHook(
      ({ engine }: { readonly engine: ChatEngine }) => useChatDevTools(engine, { maxEvents: 5 }),
      {
        initialProps: { engine: firstFixture.engine },
      },
    );

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    await act(async () => {
      await firstFixture.engine.sendMessage(firstFixture.conversation.id, {
        type: 'text',
        content: 'first',
      });
      firstFixture.engine.emitStreamStart('stream-old', firstFixture.conversation.id);
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
      expect(result.current.streams).toHaveLength(1);
      expect(result.current.events.length).toBeGreaterThan(0);
    });

    const secondFixture = await createEngineFixture();
    await secondFixture.engine.disconnect();

    rerender({ engine: secondFixture.engine });

    await waitFor(() => {
      expect(result.current.connectionState).toBe('disconnected');
      expect(result.current.events).toHaveLength(0);
      expect(result.current.messages).toHaveLength(0);
      expect(result.current.conversations).toHaveLength(0);
      expect(result.current.streams).toHaveLength(0);
      expect(result.current.middlewareFlows).toHaveLength(0);
      expect(result.current.transport.lastNetworkEvent).toBeUndefined();
    });
  });
});

describe('ChatDevTools', () => {
  it('renders panel tabs and context wiring without crashing on runtime state', async () => {
    const { engine, conversation } = await createEngineFixture();

    render(
      <ChatProvider engine={engine}>
        <ChatDevToolsFromContext initiallyOpen />
        <ChatDevTools
          engine={engine}
          initiallyOpen={false}
        />
      </ChatProvider>,
    );

    expect(screen.getByRole('button', { name: 'Chat DevTools' })).toBeTruthy();

    await act(async () => {
      await engine.sendMessage(conversation.id, {
        type: 'text',
        content: 'inspect me',
      });
      await emitCompletedStream(engine, conversation.id);
    });

    await waitFor(() => {
      expect(screen.getAllByLabelText('Chat developer tools')).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Messages' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /inspect me/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /inspect me/i }));
    await waitFor(() => {
      expect(screen.getByText(/"type": "text"/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Streaming' }));
    await waitFor(() => {
      expect(screen.getByText(/stream-1/i)).toBeTruthy();
      expect(screen.getByText(/ended/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Transport' }));
    expect(screen.getByText(/transportState: connected/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Plugins' }));
    expect(screen.getByText(/debug-plugin/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Middleware' }));
    expect(screen.getByText(/transport\.send\(\)/i)).toBeTruthy();
  });
});
