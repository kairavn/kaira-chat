import type { ChatEvent } from '../types/event.js';
import type { Message } from '../types/message.js';

import { describe, expect, it, vi } from 'vitest';

import { EventBus } from './event-bus.js';

const makeMessage = (overrides?: Partial<Message>): Message =>
  ({
    id: 'm1',
    conversationId: 'c1',
    sender: { id: 'u1', role: 'user' },
    timestamp: Date.now(),
    status: 'sent',
    type: 'text',
    content: 'hello',
    ...overrides,
  }) as Message;

describe('EventBus', () => {
  it('delivers events to subscribers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('message:sent', handler);

    const event: ChatEvent<'message:sent'> = {
      type: 'message:sent',
      timestamp: Date.now(),
      message: makeMessage(),
    };
    bus.emit('message:sent', event);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('supports multiple subscribers on the same event', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('message:sent', h1);
    bus.on('message:sent', h2);

    bus.emit('message:sent', {
      type: 'message:sent',
      timestamp: Date.now(),
      message: makeMessage(),
    });

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('unsubscribe stops delivery', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on('message:sent', handler);
    unsub();

    bus.emit('message:sent', {
      type: 'message:sent',
      timestamp: Date.now(),
      message: makeMessage(),
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('off removes a specific handler', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('message:sent', h1);
    bus.on('message:sent', h2);
    bus.off('message:sent', h1);

    bus.emit('message:sent', {
      type: 'message:sent',
      timestamp: Date.now(),
      message: makeMessage(),
    });

    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('once fires exactly once', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.once('message:sent', handler);

    const event: ChatEvent<'message:sent'> = {
      type: 'message:sent',
      timestamp: Date.now(),
      message: makeMessage(),
    };
    bus.emit('message:sent', event);
    bus.emit('message:sent', event);

    expect(handler).toHaveBeenCalledOnce();
  });

  it('subscriber error does not crash other subscribers', () => {
    const bus = new EventBus();
    const badHandler = vi.fn(() => {
      throw new Error('boom');
    });
    const goodHandler = vi.fn();
    bus.on('message:sent', badHandler);
    bus.on('message:sent', goodHandler);

    bus.emit('message:sent', {
      type: 'message:sent',
      timestamp: Date.now(),
      message: makeMessage(),
    });

    expect(badHandler).toHaveBeenCalledOnce();
    expect(goodHandler).toHaveBeenCalledOnce();
  });

  it('custom:* wildcard receives all custom events', () => {
    const bus = new EventBus();
    const wildcard = vi.fn();
    const specific = vi.fn();
    bus.on('custom:*', wildcard);
    bus.on('custom:analytics:track', specific);

    const payload = { action: 'click' };
    bus.emit('custom:analytics:track', payload);

    expect(wildcard).toHaveBeenCalledWith(payload);
    expect(specific).toHaveBeenCalledWith(payload);
  });

  it('custom:* does not fire for core events', () => {
    const bus = new EventBus();
    const wildcard = vi.fn();
    bus.on('custom:*', wildcard);

    bus.emit('message:sent', {
      type: 'message:sent',
      timestamp: Date.now(),
      message: makeMessage(),
    });

    expect(wildcard).not.toHaveBeenCalled();
  });

  it('clear removes all handlers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('message:sent', handler);
    bus.clear();

    bus.emit('message:sent', {
      type: 'message:sent',
      timestamp: Date.now(),
      message: makeMessage(),
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('off on non-existent handler is a no-op', () => {
    const bus = new EventBus();
    expect(() => bus.off('message:sent', vi.fn())).not.toThrow();
  });
});
