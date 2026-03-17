import type { IChatEngine } from '../types/engine.js';
import type { ChatEvent } from '../types/event.js';
import type { Message } from '../types/message.js';
import type { Middleware } from '../types/middleware.js';

import { describe, expect, it, vi } from 'vitest';

import { MiddlewarePipeline } from './pipeline.js';

const makeEvent = (): ChatEvent<'message:sent'> => ({
  type: 'message:sent',
  timestamp: Date.now(),
  message: {
    id: 'm1',
    conversationId: 'c1',
    sender: { id: 'u1', role: 'user' },
    timestamp: Date.now(),
    status: 'sent',
    type: 'text',
    content: 'hello',
  } as Message,
});

const mockEngine = {} as IChatEngine;

describe('MiddlewarePipeline', () => {
  it('returns event unchanged when no middleware registered', async () => {
    const pipeline = new MiddlewarePipeline();
    const event = makeEvent();
    const result = await pipeline.run(event, mockEngine);
    expect(result).toBe(event);
  });

  it('executes middleware in registration order', async () => {
    const order: number[] = [];
    const pipeline = new MiddlewarePipeline();

    pipeline.use(async (_ctx, next) => {
      order.push(1);
      return next();
    });
    pipeline.use(async (_ctx, next) => {
      order.push(2);
      return next();
    });
    pipeline.use(async (_ctx, next) => {
      order.push(3);
      return next();
    });

    await pipeline.run(makeEvent(), mockEngine);
    expect(order).toEqual([1, 2, 3]);
  });

  it('supports immutable clone-and-replace via next(modifiedEvent)', async () => {
    const pipeline = new MiddlewarePipeline();
    const original = makeEvent();

    pipeline.use(async (ctx, next) => {
      const modified = {
        ...ctx.event,
        message: { ...(ctx.event as ChatEvent<'message:sent'>).message, id: 'replaced' },
      } as ChatEvent;
      return next(modified);
    });

    pipeline.use(async (ctx, next) => {
      expect((ctx.event as ChatEvent<'message:sent'>).message.id).toBe('replaced');
      return next();
    });

    const result = await pipeline.run(original, mockEngine);
    expect((result as ChatEvent<'message:sent'>).message.id).toBe('replaced');
  });

  it('passes engine reference in context', async () => {
    const pipeline = new MiddlewarePipeline();
    let receivedEngine: unknown;

    pipeline.use(async (ctx, next) => {
      receivedEngine = ctx.engine;
      return next();
    });

    await pipeline.run(makeEvent(), mockEngine);
    expect(receivedEngine).toBe(mockEngine);
  });

  it('short-circuits when next() is not called', async () => {
    const pipeline = new MiddlewarePipeline();
    const reached = vi.fn();

    pipeline.use(async (ctx) => {
      return ctx.event;
    });
    pipeline.use(async (_ctx, next) => {
      reached();
      return next();
    });

    await pipeline.run(makeEvent(), mockEngine);
    expect(reached).not.toHaveBeenCalled();
  });

  it('uses original event when next() called without args after modification', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(async (ctx, next) => {
      const modified = { ...ctx.event, timestamp: 999 } as ChatEvent;
      return next(modified);
    });

    pipeline.use(async (_ctx, next) => {
      return next();
    });

    const original = makeEvent();
    const result = await pipeline.run(original, mockEngine);
    expect(result.timestamp).toBe(999);
  });

  it('wraps middleware errors in ChatError', async () => {
    const pipeline = new MiddlewarePipeline();

    pipeline.use(async () => {
      throw new Error('middleware boom');
    });

    try {
      await pipeline.run(makeEvent(), mockEngine);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toMatchObject({
        kind: 'middleware',
        message: expect.stringContaining('index 0'),
      });
    }
  });

  it('remove() removes middleware', async () => {
    const pipeline = new MiddlewarePipeline();
    const mw: Middleware = async (_ctx, next) => next();
    pipeline.use(mw);
    expect(pipeline.size).toBe(1);
    pipeline.remove(mw);
    expect(pipeline.size).toBe(0);
  });

  it('clear() removes all middleware', async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(async (_ctx, next) => next());
    pipeline.use(async (_ctx, next) => next());
    pipeline.clear();
    expect(pipeline.size).toBe(0);
  });
});
