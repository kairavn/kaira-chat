import type { Conversation } from '../types/conversation.js';
import type { ConnectionState } from '../types/event.js';
import type { Message } from '../types/message.js';
import type { IStorage } from '../types/storage.js';
import type { ITransport, TransportEvent } from '../types/transport.js';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageRegistry } from '../message-registry/message-registry.js';
import { ChatEngine } from './chat-engine.js';

// ---------------------------------------------------------------------------
// Mock transport
// ---------------------------------------------------------------------------
function createMockTransport(supportsTyping: boolean = true): ITransport & {
  simulateMessage(msg: Record<string, unknown>): void;
  simulateTyping(event: TransportEvent<'typing'>['payload']): void;
  simulateStateChange(state: ConnectionState): void;
  getMessageHandlerCount(): number;
} {
  const messageHandlers = new Set<(event: TransportEvent) => void>();
  const stateHandlers = new Set<(state: ConnectionState) => void>();
  let state: ConnectionState = 'disconnected';

  return {
    capabilities: {
      ...(supportsTyping ? { typing: true } : {}),
    },
    connect: vi.fn(async () => {
      state = 'connected';
    }),
    disconnect: vi.fn(async () => {
      state = 'disconnected';
    }),
    send: vi.fn(async () => {}),
    getState: () => state,
    onMessage(handler) {
      messageHandlers.add(handler);
      return () => {
        messageHandlers.delete(handler);
      };
    },
    onStateChange(handler) {
      stateHandlers.add(handler);
      return () => {
        stateHandlers.delete(handler);
      };
    },
    simulateMessage(payload) {
      for (const h of messageHandlers) {
        h({ type: 'message', payload, timestamp: Date.now() });
      }
    },
    simulateTyping(payload) {
      for (const h of messageHandlers) {
        h({ type: 'typing', payload, timestamp: Date.now() });
      }
    },
    simulateStateChange(s) {
      state = s;
      for (const h of stateHandlers) h(s);
    },
    getMessageHandlerCount() {
      return messageHandlers.size;
    },
  };
}

// ---------------------------------------------------------------------------
// Mock storage
// ---------------------------------------------------------------------------
function createMockStorage(): IStorage {
  const messages = new Map<string, Message>();
  const conversations = new Map<string, Conversation>();

  return {
    saveMessage: vi.fn(async (msg) => {
      messages.set(msg.id, msg);
    }),
    getMessage: vi.fn(async (id) => messages.get(id)),
    getMessages: vi.fn(async (q) => ({
      items: [...messages.values()].filter((m) => m.conversationId === q.conversationId),
      hasMore: false,
    })),
    updateMessage: vi.fn(async (id, update) => {
      const existing = messages.get(id);
      if (existing) messages.set(id, { ...existing, ...update } as Message);
    }),
    deleteMessage: vi.fn(async (id) => {
      messages.delete(id);
    }),

    saveConversation: vi.fn(async (c) => {
      conversations.set(c.id, c);
    }),
    getConversation: vi.fn(async (id) => conversations.get(id)),
    getConversations: vi.fn(async () => ({ items: [...conversations.values()], hasMore: false })),
    updateConversation: vi.fn(async (id, update) => {
      const existing = conversations.get(id);
      if (existing) conversations.set(id, { ...existing, ...update } as Conversation);
    }),
    deleteConversation: vi.fn(async (id) => {
      conversations.delete(id);
    }),
    clear: vi.fn(async () => {
      messages.clear();
      conversations.clear();
    }),
  };
}

async function flushAsyncHandlers(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function getPrivateMessageRegistry(engine: object): MessageRegistry {
  const registry = Reflect.get(engine, 'messageRegistry');
  if (!(registry instanceof MessageRegistry)) {
    throw new Error('ChatEngine private message registry is unavailable');
  }

  return registry;
}

// ---------------------------------------------------------------------------
// Standalone mode tests
// ---------------------------------------------------------------------------
describe('ChatEngine — standalone mode', () => {
  let engine: ChatEngine;

  beforeEach(() => {
    engine = new ChatEngine();
  });

  it('creates and retrieves a conversation', async () => {
    const conv = await engine.createConversation({
      type: 'direct',
      participants: [{ id: 'u1', role: 'user' }],
    });
    expect(conv.id).toBeDefined();
    expect(conv.type).toBe('direct');

    const fetched = await engine.getConversation(conv.id);
    expect(fetched).toEqual(conv);
  });

  it('lists conversations', async () => {
    await engine.createConversation({ type: 'direct', participants: [] });
    await engine.createConversation({ type: 'group', participants: [] });
    const page = await engine.getConversations();
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(false);
  });

  it('sends and retrieves messages', async () => {
    const conv = await engine.createConversation({ type: 'direct', participants: [] });
    const msg = await engine.sendMessage(conv.id, { type: 'text', content: 'hi' });
    expect(msg.status).toBe('sent');

    const page = await engine.getMessages({ conversationId: conv.id });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.id).toBe(msg.id);
  });

  it('uses cursor as an exclusive pagination anchor', async () => {
    const conv = await engine.createConversation({ type: 'direct', participants: [] });
    const first = await engine.sendMessage(conv.id, { type: 'text', content: 'first' });
    const second = await engine.sendMessage(conv.id, { type: 'text', content: 'second' });
    await engine.sendMessage(conv.id, { type: 'text', content: 'third' });

    const page = await engine.getMessages({
      conversationId: conv.id,
      direction: 'asc',
      cursor: first.id,
      limit: 1,
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.id).toBe(second.id);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(second.id);
  });

  it('returns the newest page when requested in descending order', async () => {
    const conv = await engine.createConversation({ type: 'direct', participants: [] });
    await engine.sendMessage(conv.id, { type: 'text', content: 'first' });
    const second = await engine.sendMessage(conv.id, { type: 'text', content: 'second' });
    const third = await engine.sendMessage(conv.id, { type: 'text', content: 'third' });

    const page = await engine.getMessages({
      conversationId: conv.id,
      direction: 'desc',
      limit: 2,
    });

    expect(page.items).toEqual([
      expect.objectContaining({ id: third.id }),
      expect.objectContaining({ id: second.id }),
    ]);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(second.id);
  });

  it('updates a message', async () => {
    const conv = await engine.createConversation({ type: 'direct', participants: [] });
    const msg = await engine.sendMessage(conv.id, { type: 'text', content: 'draft' });
    const updated = await engine.updateMessage(msg.id, { type: 'text', content: 'final' });
    expect((updated as { content: string }).content).toBe('final');
  });

  it('creates built-in audio, video, and location messages', async () => {
    const conv = await engine.createConversation({ type: 'direct', participants: [] });

    const audioMessage = await engine.sendMessage(conv.id, {
      type: 'audio',
      url: 'https://example.com/audio.mp3',
      mimeType: 'audio/mpeg',
      title: 'Launch note',
      durationSeconds: 32,
      size: 2048,
    });
    const videoMessage = await engine.sendMessage(conv.id, {
      type: 'video',
      url: 'https://example.com/video.mp4',
      mimeType: 'video/mp4',
      title: 'Product walkthrough',
      posterUrl: 'https://example.com/poster.jpg',
      dimensions: { width: 1280, height: 720 },
      durationSeconds: 95,
      size: 8192,
    });
    const locationMessage = await engine.sendMessage(conv.id, {
      type: 'location',
      latitude: 10.77689,
      longitude: 106.70081,
      label: 'Ho Chi Minh City',
      address: 'District 1',
    });

    expect(audioMessage).toMatchObject({
      type: 'audio',
      title: 'Launch note',
      durationSeconds: 32,
    });
    expect(videoMessage).toMatchObject({
      type: 'video',
      title: 'Product walkthrough',
      posterUrl: 'https://example.com/poster.jpg',
    });
    expect(locationMessage).toMatchObject({
      type: 'location',
      latitude: 10.77689,
      longitude: 106.70081,
    });
  });

  it('updates built-in media and location messages without changing type', async () => {
    const conv = await engine.createConversation({ type: 'direct', participants: [] });

    const videoMessage = await engine.sendMessage(conv.id, {
      type: 'video',
      url: 'https://example.com/video.mp4',
      title: 'Draft walkthrough',
    });
    const locationMessage = await engine.sendMessage(conv.id, {
      type: 'location',
      latitude: 10.77689,
      longitude: 106.70081,
    });

    const updatedVideo = await engine.updateMessage(videoMessage.id, {
      type: 'video',
      title: 'Final walkthrough',
      durationSeconds: 120,
    });
    const updatedLocation = await engine.updateMessage(locationMessage.id, {
      type: 'location',
      label: 'Updated pin',
      url: 'https://maps.example.com/pin',
    });

    expect(updatedVideo).toMatchObject({
      type: 'video',
      title: 'Final walkthrough',
      durationSeconds: 120,
    });
    expect(updatedLocation).toMatchObject({
      type: 'location',
      label: 'Updated pin',
      url: 'https://maps.example.com/pin',
    });
  });

  it('registers built-in audio, video, and location message types by default', () => {
    const registry = getPrivateMessageRegistry(engine);

    expect(registry.has('audio')).toBe(true);
    expect(registry.has('video')).toBe(true);
    expect(registry.has('location')).toBe(true);
  });

  it('rejects invalid built-in payloads at send time', async () => {
    const conv = await engine.createConversation({ type: 'direct', participants: [] });

    await expect(
      engine.sendMessage(conv.id, {
        type: 'location',
        latitude: 120,
        longitude: 106.70081,
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      message: expect.stringContaining('Message.latitude'),
    });
  });

  it('rejects invalid built-in payloads during update', async () => {
    const conv = await engine.createConversation({ type: 'direct', participants: [] });
    const message = await engine.sendMessage(conv.id, {
      type: 'audio',
      url: 'https://example.com/audio.mp3',
      durationSeconds: 10,
    });

    await expect(
      engine.updateMessage(message.id, {
        type: 'audio',
        durationSeconds: -1,
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      message: expect.stringContaining('Message.durationSeconds'),
    });
  });

  it('deletes a message', async () => {
    const conv = await engine.createConversation({ type: 'direct', participants: [] });
    const msg = await engine.sendMessage(conv.id, { type: 'text', content: 'bye' });
    await engine.deleteMessage(msg.id);
    const page = await engine.getMessages({ conversationId: conv.id });
    expect(page.items).toHaveLength(0);
  });

  it('throws on update of non-existent message', async () => {
    await expect(engine.updateMessage('nope', { type: 'text', content: '' })).rejects.toMatchObject(
      {
        kind: 'validation',
      },
    );
  });

  it('throws on delete of non-existent message', async () => {
    await expect(engine.deleteMessage('nope')).rejects.toMatchObject({
      kind: 'validation',
    });
  });

  it('emits message:sent event', async () => {
    const handler = vi.fn();
    engine.on('message:sent', handler);
    const conv = await engine.createConversation({ type: 'direct', participants: [] });
    await engine.sendMessage(conv.id, { type: 'text', content: 'hi' });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('emits conversation:created event', async () => {
    const handler = vi.fn();
    engine.on('conversation:created', handler);
    await engine.createConversation({ type: 'direct', participants: [] });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('getConnectionState returns disconnected without transport', () => {
    expect(engine.getConnectionState()).toBe('disconnected');
  });

  it('getConversationState returns active for new conversations', async () => {
    const conv = await engine.createConversation({ type: 'direct', participants: [] });
    expect(engine.getConversationState(conv.id)).toBe('active');
  });

  it('off() removes event handler', async () => {
    const handler = vi.fn();
    engine.on('message:sent', handler);
    engine.off('message:sent', handler);

    const conv = await engine.createConversation({ type: 'direct', participants: [] });
    await engine.sendMessage(conv.id, { type: 'text', content: 'ignored' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('connect() and disconnect() work without transport', async () => {
    await engine.connect();
    expect(engine.getConnectionState()).toBe('disconnected');
    await engine.disconnect();
    expect(engine.getConnectionState()).toBe('disconnected');
  });
});

// ---------------------------------------------------------------------------
// With transport and storage
// ---------------------------------------------------------------------------
describe('ChatEngine — with transport & storage', () => {
  it('connects and disconnects via transport', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({ transport });

    await engine.connect();
    expect(transport.connect).toHaveBeenCalled();
    expect(engine.getConnectionState()).toBe('connected');

    await engine.disconnect();
    expect(transport.disconnect).toHaveBeenCalled();
    expect(engine.getConnectionState()).toBe('disconnected');
  });

  it('persists messages via storage', async () => {
    const storage = createMockStorage();
    const engine = new ChatEngine({ storage });

    const conv = await engine.createConversation({ type: 'direct', participants: [] });
    await engine.sendMessage(conv.id, { type: 'text', content: 'stored' });

    expect(storage.saveMessage).toHaveBeenCalled();
    expect(storage.saveConversation).toHaveBeenCalled();
  });

  it('sends messages over transport', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({ transport });
    await engine.connect();

    const conv = await engine.createConversation({ type: 'direct', participants: [] });
    await engine.sendMessage(conv.id, { type: 'text', content: 'hi' });

    expect(transport.send).toHaveBeenCalled();
  });

  it('receives messages from transport', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({ transport });
    await engine.connect();

    const handler = vi.fn();
    engine.on('message:received', handler);

    transport.simulateMessage({
      id: 'm-remote',
      conversationId: 'c1',
      sender: { id: 'u2', role: 'user' },
      timestamp: Date.now(),
      status: 'sent',
      type: 'text',
      content: 'hello from remote',
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(handler).toHaveBeenCalledOnce();
    await engine.disconnect();
  });

  it('delegates getConversations to storage', async () => {
    const storage = createMockStorage();
    const page = { items: [], hasMore: false };
    (storage.getConversations as ReturnType<typeof vi.fn>).mockResolvedValue(page);
    const engine = new ChatEngine({ storage });
    const result = await engine.getConversations();
    expect(result).toBe(page);
    expect(storage.getConversations).toHaveBeenCalled();
  });

  it('delegates getConversation to storage', async () => {
    const storage = createMockStorage();
    (storage.getConversation as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const engine = new ChatEngine({ storage });
    const result = await engine.getConversation('c-missing');
    expect(result).toBeUndefined();
    expect(storage.getConversation).toHaveBeenCalledWith('c-missing');
  });

  it('delegates getMessages to storage', async () => {
    const storage = createMockStorage();
    const page = { items: [], hasMore: false };
    (storage.getMessages as ReturnType<typeof vi.fn>).mockResolvedValue(page);
    const engine = new ChatEngine({ storage });
    const result = await engine.getMessages({ conversationId: 'c1' });
    expect(result).toBe(page);
  });

  it('delegates updateMessage to storage', async () => {
    const storage = createMockStorage();
    const existing = {
      id: 'm1',
      conversationId: 'c1',
      sender: { id: 'u1', role: 'user' },
      timestamp: Date.now(),
      status: 'sent',
      type: 'text',
      content: 'old',
    };
    (storage.getMessage as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    const engine = new ChatEngine({ storage });
    const updated = await engine.updateMessage('m1', { type: 'text', content: 'new' });
    expect(storage.updateMessage).toHaveBeenCalled();
    expect((updated as { content: string }).content).toBe('new');
  });

  it('delegates deleteMessage to storage', async () => {
    const storage = createMockStorage();
    const existing = {
      id: 'm1',
      conversationId: 'c1',
      sender: { id: 'u1', role: 'user' },
      timestamp: Date.now(),
      status: 'sent',
      type: 'text',
      content: 'bye',
    };
    (storage.getMessage as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    const engine = new ChatEngine({ storage });
    await engine.deleteMessage('m1');
    expect(storage.deleteMessage).toHaveBeenCalledWith('m1');
  });
});

// ---------------------------------------------------------------------------
// AI streaming
// ---------------------------------------------------------------------------
describe('ChatEngine — AI streaming', () => {
  it('emits stream lifecycle events', async () => {
    const engine = new ChatEngine();
    const starts = vi.fn();
    const chunks = vi.fn();
    const ends = vi.fn();

    engine.on('message:stream:start', starts);
    engine.on('message:stream:chunk', chunks);
    engine.on('message:stream:end', ends);

    engine.emitStreamStart('m1', 'c1');
    engine.emitStreamChunk('m1', 'He', 'He');
    engine.emitStreamChunk('m1', 'llo', 'Hello');

    const finalMsg = {
      id: 'm1',
      conversationId: 'c1',
      sender: { id: 'ai', role: 'assistant' as const },
      timestamp: Date.now(),
      status: 'sent' as const,
      type: 'ai' as const,
      content: 'Hello',
      streamState: 'complete' as const,
    };
    await engine.emitStreamEnd(finalMsg);

    expect(starts).toHaveBeenCalledOnce();
    expect(chunks).toHaveBeenCalledTimes(2);
    expect(ends).toHaveBeenCalledOnce();
  });

  it('emitStreamEnd saves to storage when available', async () => {
    const storage = createMockStorage();
    const engine = new ChatEngine({ storage });

    const finalMsg = {
      id: 'm1',
      conversationId: 'c1',
      sender: { id: 'ai', role: 'assistant' as const },
      timestamp: Date.now(),
      status: 'sent' as const,
      type: 'ai' as const,
      content: 'Hello',
      streamState: 'complete' as const,
    };
    await engine.emitStreamEnd(finalMsg);

    expect(storage.saveMessage).toHaveBeenCalledWith(finalMsg);
  });

  it('emitStreamError emits error event', () => {
    const engine = new ChatEngine();
    const handler = vi.fn();
    engine.on('message:stream:error', handler);
    engine.emitStreamError('m1', 'c1', { kind: 'transport', message: 'timeout' });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]![0]).toMatchObject({
      messageId: 'm1',
      conversationId: 'c1',
    });
  });
});

describe('ChatEngine — typing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('notifyTyping emits an immediate start, throttles transport sends, and auto-stops after idle', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({
      transport,
      sender: { id: 'user-1', role: 'user' },
      typing: {
        emitThrottleMs: 2000,
        idleTimeoutMs: 1500,
      },
    });
    const startHandler = vi.fn();
    const stopHandler = vi.fn();

    engine.on('typing:start', startHandler);
    engine.on('typing:stop', stopHandler);
    await engine.connect();

    engine.notifyTyping('c1');
    engine.notifyTyping('c1');

    expect(startHandler).toHaveBeenCalledOnce();
    expect(transport.send).toHaveBeenCalledOnce();
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'typing',
        payload: expect.objectContaining({
          action: 'start',
          conversationId: 'c1',
        }),
      }),
    );

    await vi.advanceTimersByTimeAsync(1499);
    expect(stopHandler).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(stopHandler).toHaveBeenCalledOnce();
    expect(stopHandler.mock.calls[0]?.[0]).toMatchObject({
      conversationId: 'c1',
      reason: 'explicit',
    });
    expect(transport.send).toHaveBeenCalledTimes(2);
    expect(transport.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'typing',
        payload: expect.objectContaining({
          action: 'stop',
          conversationId: 'c1',
        }),
      }),
    );
  });

  it('stopTyping emits explicit stop and cancels idle timers', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({
      transport,
      sender: { id: 'user-1', role: 'user' },
    });
    const stopHandler = vi.fn();
    engine.on('typing:stop', stopHandler);

    await engine.connect();
    engine.notifyTyping('c1');
    engine.stopTyping('c1');

    expect(stopHandler).toHaveBeenCalledOnce();
    expect(stopHandler.mock.calls[0]?.[0]).toMatchObject({
      conversationId: 'c1',
      reason: 'explicit',
    });

    await vi.advanceTimersByTimeAsync(2000);
    expect(stopHandler).toHaveBeenCalledOnce();
  });

  it('refreshes remote typing TTL without duplicate typing:start events', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({
      transport,
      sender: { id: 'self', role: 'user' },
      typing: {
        remoteTtlMs: 1000,
      },
    });
    const startHandler = vi.fn();
    engine.on('typing:start', startHandler);

    await engine.connect();
    transport.simulateTyping({
      action: 'start',
      conversationId: 'c1',
      participant: { id: 'remote-1', role: 'user' },
    });
    transport.simulateTyping({
      action: 'start',
      conversationId: 'c1',
      participant: { id: 'remote-1', role: 'user' },
    });

    expect(startHandler).toHaveBeenCalledOnce();
    expect(engine.isTyping('c1', 'remote-1')).toBe(true);
  });

  it('expires remote typing state with expired reason', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({
      transport,
      sender: { id: 'self', role: 'user' },
      typing: {
        remoteTtlMs: 1000,
      },
    });
    const stopHandler = vi.fn();
    engine.on('typing:stop', stopHandler);

    await engine.connect();
    transport.simulateTyping({
      action: 'start',
      conversationId: 'c1',
      participant: { id: 'remote-1', role: 'user' },
    });

    await vi.advanceTimersByTimeAsync(1000);

    expect(stopHandler).toHaveBeenCalledOnce();
    expect(stopHandler.mock.calls[0]?.[0]).toMatchObject({
      conversationId: 'c1',
      reason: 'expired',
    });
    expect(engine.isTyping('c1', 'remote-1')).toBe(false);
  });

  it('clears typing state when matching participant sends a message', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({
      transport,
      sender: { id: 'self', role: 'user' },
    });
    const stopHandler = vi.fn();
    engine.on('typing:stop', stopHandler);

    await engine.connect();
    transport.simulateTyping({
      action: 'start',
      conversationId: 'c1',
      participant: { id: 'remote-1', role: 'user' },
    });
    transport.simulateMessage({
      id: 'm-remote',
      conversationId: 'c1',
      sender: { id: 'remote-1', role: 'user' },
      timestamp: Date.now(),
      status: 'sent',
      type: 'text',
      content: 'hello',
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(stopHandler).toHaveBeenCalledOnce();
    expect(stopHandler.mock.calls[0]?.[0]).toMatchObject({
      conversationId: 'c1',
      reason: 'message',
    });
    expect(engine.isTyping('c1', 'remote-1')).toBe(false);
  });

  it('degrades gracefully when transport typing is unsupported', () => {
    const transport = createMockTransport(false);
    const engine = new ChatEngine({
      transport,
      sender: { id: 'user-1', role: 'user' },
    });
    const startHandler = vi.fn();

    engine.on('typing:start', startHandler);
    engine.notifyTyping('c1');

    expect(engine.supportsTyping()).toBe(false);
    expect(startHandler).toHaveBeenCalledOnce();
    expect(transport.send).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------
describe('ChatEngine — plugins', () => {
  it('installs plugins on connect', async () => {
    const install = vi.fn();
    const plugin = { name: 'test', version: '1.0.0', install };
    const engine = new ChatEngine({ plugins: [plugin] });
    await engine.connect();
    expect(install).toHaveBeenCalledWith(engine);
  });

  it('destroys plugins on disconnect', async () => {
    const destroy = vi.fn();
    const plugin = { name: 'test', version: '1.0.0', install: vi.fn(), destroy };
    const engine = new ChatEngine({ plugins: [plugin] });
    await engine.connect();
    await engine.disconnect();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('emits error event if plugin install fails', async () => {
    const plugin = {
      name: 'bad',
      version: '1.0.0',
      install: () => {
        throw new Error('install fail');
      },
    };
    const engine = new ChatEngine({ plugins: [plugin] });
    const handler = vi.fn();
    engine.on('error', handler);
    await engine.connect();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('use() registers a plugin at runtime', () => {
    const engine = new ChatEngine();
    const plugin = { name: 'late', version: '1.0.0', install: vi.fn() };
    expect(() => engine.use(plugin)).not.toThrow();
  });

  it('silently handles plugin destroy failure', async () => {
    const failing = {
      name: 'exploder',
      version: '1.0.0',
      install: vi.fn(),
      destroy: vi.fn().mockRejectedValue(new Error('destroy boom')),
    };
    const engine = new ChatEngine({ plugins: [failing] });
    await engine.connect();
    await expect(engine.disconnect()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Middleware integration
// ---------------------------------------------------------------------------
describe('ChatEngine — middleware', () => {
  it('runs middleware on sendMessage', async () => {
    const called = vi.fn();
    const engine = new ChatEngine({
      middleware: [
        async (ctx, next) => {
          called(ctx.event.type);
          return next();
        },
      ],
    });

    const conv = await engine.createConversation({ type: 'direct', participants: [] });
    await engine.sendMessage(conv.id, { type: 'text', content: 'mw test' });
    expect(called).toHaveBeenCalledWith('message:sent');
  });

  it('middleware receives engine in context', async () => {
    let receivedEngine: unknown;
    const engine = new ChatEngine({
      middleware: [
        async (ctx, next) => {
          receivedEngine = ctx.engine;
          return next();
        },
      ],
    });

    const conv = await engine.createConversation({ type: 'direct', participants: [] });
    await engine.sendMessage(conv.id, { type: 'text', content: 'ctx' });
    expect(receivedEngine).toBe(engine);
  });
});

// ---------------------------------------------------------------------------
// Configurable sender
// ---------------------------------------------------------------------------
describe('ChatEngine — sender config', () => {
  it('uses default sender when none configured', async () => {
    const engine = new ChatEngine();
    const conv = await engine.createConversation({ type: 'direct', participants: [] });
    const msg = await engine.sendMessage(conv.id, { type: 'text', content: 'hi' });
    expect(msg.sender.id).toBe('anonymous');
  });

  it('uses configured sender', async () => {
    const engine = new ChatEngine({
      sender: { id: 'user-42', role: 'user', displayName: 'Alice' },
    });
    const conv = await engine.createConversation({ type: 'direct', participants: [] });
    const msg = await engine.sendMessage(conv.id, { type: 'text', content: 'hi' });
    expect(msg.sender.id).toBe('user-42');
  });
});

// ---------------------------------------------------------------------------
// Transport edge cases
// ---------------------------------------------------------------------------
describe('ChatEngine — transport edge cases', () => {
  it('emits error on malformed transport message', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({ transport });
    await engine.connect();

    const errorHandler = vi.fn();
    engine.on('error', errorHandler);

    transport.simulateMessage({ badPayload: true });

    await flushAsyncHandlers();
    expect(errorHandler).toHaveBeenCalledOnce();
    expect(errorHandler.mock.calls[0]![0].error.kind).toBe('transport');
    await engine.disconnect();
  });

  it('handles transport connection failure', async () => {
    const transport = createMockTransport();
    (transport.connect as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('network down'),
    );

    const engine = new ChatEngine({ transport });

    await expect(engine.connect()).rejects.toMatchObject({ kind: 'transport' });
    expect(engine.getConnectionState()).toBe('disconnected');
  });

  it('emits connection:state on transport state change', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({ transport });
    await engine.connect();

    const handler = vi.fn();
    engine.on('connection:state', handler);

    transport.simulateStateChange('reconnecting');

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        previousState: 'connected',
        state: 'reconnecting',
      }),
    );
    await engine.disconnect();
  });

  it('emits connecting and connected during connect', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({ transport });
    const handler = vi.fn();

    engine.on('connection:state', handler);
    await engine.connect();

    expect(handler).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        previousState: 'disconnected',
        state: 'connecting',
      }),
    );
    expect(handler).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        previousState: 'connecting',
        state: 'connected',
      }),
    );
    await engine.disconnect();
  });

  it('removes transport listeners after a failed connect attempt', async () => {
    const transport = createMockTransport();
    (transport.connect as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(undefined);

    const engine = new ChatEngine({ transport });

    await expect(engine.connect()).rejects.toMatchObject({ kind: 'transport' });
    expect(transport.getMessageHandlerCount()).toBe(0);

    await engine.connect();
    expect(transport.getMessageHandlerCount()).toBe(1);
    await engine.disconnect();
  });

  it('stores received messages in storage when available', async () => {
    const transport = createMockTransport();
    const storage = createMockStorage();
    const engine = new ChatEngine({ transport, storage });
    await engine.connect();

    transport.simulateMessage({
      id: 'm-remote',
      type: 'text',
      conversationId: 'c1',
      sender: { id: 'u2', role: 'user' },
      timestamp: Date.now(),
      status: 'sent',
      content: 'hello',
    });

    await flushAsyncHandlers();
    expect(storage.saveMessage).toHaveBeenCalled();
    await engine.disconnect();
  });

  it('accepts inbound custom messages since custom is a registered type', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({ transport });
    await engine.connect();

    const receivedHandler = vi.fn();
    engine.on('message:received', receivedHandler);

    transport.simulateMessage({
      id: 'm-custom',
      type: 'custom',
      conversationId: 'c1',
      sender: { id: 'u2', role: 'user' },
      timestamp: Date.now(),
      status: 'sent',
      customType: 'greeting',
      payload: { hello: 'world' },
    });

    await flushAsyncHandlers();
    expect(receivedHandler).toHaveBeenCalledOnce();
    await engine.disconnect();
  });

  it('emits warning and still accepts inbound message with truly unknown type', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({ transport });
    await engine.connect();

    const errorHandler = vi.fn();
    const receivedHandler = vi.fn();
    engine.on('error', errorHandler);
    engine.on('message:received', receivedHandler);

    transport.simulateMessage({
      id: 'm-unknown',
      type: 'totally_unknown_type',
      conversationId: 'c1',
      sender: { id: 'u2', role: 'user' },
      timestamp: Date.now(),
      status: 'sent',
    });

    await flushAsyncHandlers();
    expect(errorHandler).toHaveBeenCalledOnce();
    expect(errorHandler.mock.calls[0]![0].error.kind).toBe('validation');
    expect(receivedHandler).toHaveBeenCalledOnce();
    await engine.disconnect();
  });

  it('ignores duplicate inbound messages and emits received once', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({ transport });
    await engine.connect();

    const handler = vi.fn();
    engine.on('message:received', handler);

    const payload = {
      id: 'm-dup-1',
      type: 'text',
      conversationId: 'c1',
      sender: { id: 'u2', role: 'user' },
      timestamp: Date.now(),
      status: 'sent',
      content: 'hello',
    };
    transport.simulateMessage(payload);
    transport.simulateMessage(payload);

    await flushAsyncHandlers();
    expect(handler).toHaveBeenCalledTimes(1);
    await engine.disconnect();
  });

  it('ignores inbound duplicates for ids already sent by this engine', async () => {
    const transport = createMockTransport();
    const engine = new ChatEngine({ transport });
    await engine.connect();

    const receivedHandler = vi.fn();
    engine.on('message:received', receivedHandler);

    const conversation = await engine.createConversation({ type: 'direct', participants: [] });
    const sentMessage = await engine.sendMessage(conversation.id, {
      type: 'text',
      content: 'local',
    });

    transport.simulateMessage({
      id: sentMessage.id,
      type: 'text',
      conversationId: conversation.id,
      sender: { id: 'u2', role: 'user' },
      timestamp: Date.now(),
      status: 'sent',
      content: 'echo',
    });

    await flushAsyncHandlers();
    expect(receivedHandler).not.toHaveBeenCalled();
    await engine.disconnect();
  });

  it('checks storage for dedupe when index is cold (engine restart)', async () => {
    const transport = createMockTransport();
    const storage = createMockStorage();
    const firstEngine = new ChatEngine({ storage });
    const conversation = await firstEngine.createConversation({ type: 'direct', participants: [] });
    const sentMessage = await firstEngine.sendMessage(conversation.id, {
      type: 'text',
      content: 'persisted',
    });

    const engine = new ChatEngine({ transport, storage });
    await engine.connect();
    const receivedHandler = vi.fn();
    engine.on('message:received', receivedHandler);

    transport.simulateMessage({
      id: sentMessage.id,
      type: 'text',
      conversationId: conversation.id,
      sender: { id: 'u2', role: 'user' },
      timestamp: Date.now(),
      status: 'sent',
      content: 'duplicate after restart',
    });

    await flushAsyncHandlers();
    expect(receivedHandler).not.toHaveBeenCalled();
    expect(storage.getMessage).toHaveBeenCalledWith(sentMessage.id);
    await engine.disconnect();
  });

  it('suppresses own echo via clientNonce when storage is in use', async () => {
    const transport = createMockTransport();
    const storage = createMockStorage();
    const sender = { id: 'user-1', role: 'user' as const };
    const engine = new ChatEngine({ transport, storage, sender });
    await engine.connect();

    const receivedHandler = vi.fn();
    engine.on('message:received', receivedHandler);

    const conversation = await engine.createConversation({ type: 'direct', participants: [] });
    const clientNonce = 'nonce-echo-storage-test';
    await engine.sendMessage(conversation.id, {
      type: 'text',
      content: 'hello from storage mode',
      metadata: { clientNonce },
    });

    transport.simulateMessage({
      id: 'echo-from-server',
      type: 'text',
      conversationId: conversation.id,
      sender,
      timestamp: Date.now(),
      status: 'sent',
      content: 'hello from storage mode',
      metadata: { clientNonce },
    });

    await flushAsyncHandlers();
    expect(receivedHandler).not.toHaveBeenCalled();
    await engine.disconnect();
  });

  it('suppresses own echo via clientNonce after engine restart with same storage (reload simulation)', async () => {
    const transport = createMockTransport();
    const storage = createMockStorage();
    const sender = { id: 'user-1', role: 'user' as const };
    const firstEngine = new ChatEngine({ storage, sender });
    const conversation = await firstEngine.createConversation({ type: 'direct', participants: [] });
    const clientNonce = 'nonce-reload-simulation';
    await firstEngine.sendMessage(conversation.id, {
      type: 'text',
      content: 'persisted before reload',
      metadata: { clientNonce },
    });

    const secondEngine = new ChatEngine({ transport, storage, sender });
    await secondEngine.connect();
    const receivedHandler = vi.fn();
    secondEngine.on('message:received', receivedHandler);

    transport.simulateMessage({
      id: 'dit-echo-id-after-reload',
      type: 'text',
      conversationId: conversation.id,
      sender,
      timestamp: Date.now(),
      status: 'sent',
      content: 'persisted before reload',
      metadata: { clientNonce },
    });

    await flushAsyncHandlers();
    expect(receivedHandler).not.toHaveBeenCalled();
    await secondEngine.disconnect();
  });

  it('does not suppress echo from a different sender with the same clientNonce', async () => {
    const transport = createMockTransport();
    const storage = createMockStorage();
    const sender = { id: 'user-1', role: 'user' as const };
    const engine = new ChatEngine({ transport, storage, sender });
    await engine.connect();

    const receivedHandler = vi.fn();
    engine.on('message:received', receivedHandler);

    const conversation = await engine.createConversation({ type: 'direct', participants: [] });
    const clientNonce = 'nonce-different-sender';
    await engine.sendMessage(conversation.id, {
      type: 'text',
      content: 'my message',
      metadata: { clientNonce },
    });

    transport.simulateMessage({
      id: 'msg-other-sender',
      type: 'text',
      conversationId: conversation.id,
      sender: { id: 'user-2', role: 'user' },
      timestamp: Date.now(),
      status: 'sent',
      content: 'coincidental nonce match',
      metadata: { clientNonce },
    });

    await flushAsyncHandlers();
    expect(receivedHandler).toHaveBeenCalledOnce();
    await engine.disconnect();
  });
});
