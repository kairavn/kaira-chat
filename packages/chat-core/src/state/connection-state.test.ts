import { describe, expect, it, vi } from 'vitest';

import { ConnectionStateMachine } from './connection-state.js';

describe('ConnectionStateMachine', () => {
  it('starts in disconnected state', () => {
    const sm = new ConnectionStateMachine();
    expect(sm.state).toBe('disconnected');
  });

  it('transitions disconnected → connecting → connected', () => {
    const sm = new ConnectionStateMachine();
    sm.transition('connect');
    expect(sm.state).toBe('connecting');
    sm.transition('onOpen');
    expect(sm.state).toBe('connected');
  });

  it('transitions connecting → disconnected on error', () => {
    const sm = new ConnectionStateMachine();
    sm.transition('connect');
    sm.transition('onError');
    expect(sm.state).toBe('disconnected');
  });

  it('transitions connected → reconnecting on unexpected close', () => {
    const sm = new ConnectionStateMachine();
    sm.transition('connect');
    sm.transition('onOpen');
    sm.transition('onClose');
    expect(sm.state).toBe('reconnecting');
  });

  it('transitions connected → disconnecting → disconnected on graceful disconnect', () => {
    const sm = new ConnectionStateMachine();
    sm.transition('connect');
    sm.transition('onOpen');
    sm.transition('disconnect');
    expect(sm.state).toBe('disconnecting');
    sm.transition('onClose');
    expect(sm.state).toBe('disconnected');
  });

  it('transitions reconnecting → connecting on retry', () => {
    const sm = new ConnectionStateMachine();
    sm.transition('connect');
    sm.transition('onOpen');
    sm.transition('onClose');
    sm.transition('retry');
    expect(sm.state).toBe('connecting');
  });

  it('transitions reconnecting → disconnected on maxRetries', () => {
    const sm = new ConnectionStateMachine();
    sm.transition('connect');
    sm.transition('onOpen');
    sm.transition('onClose');
    sm.transition('maxRetries');
    expect(sm.state).toBe('disconnected');
  });

  it('transitions reconnecting → disconnecting on explicit disconnect', () => {
    const sm = new ConnectionStateMachine();
    sm.transition('connect');
    sm.transition('onOpen');
    sm.transition('onClose');
    expect(sm.state).toBe('reconnecting');
    sm.transition('disconnect');
    expect(sm.state).toBe('disconnecting');
  });

  it('throws on invalid transition', () => {
    const sm = new ConnectionStateMachine();
    expect(() => sm.transition('onOpen')).toThrow(/Invalid connection transition/);
  });

  it("throws ChatError with kind 'state'", () => {
    const sm = new ConnectionStateMachine();
    try {
      sm.transition('disconnect');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toMatchObject({ kind: 'state' });
    }
  });

  it('notifies listeners on transition', () => {
    const sm = new ConnectionStateMachine();
    const listener = vi.fn();
    sm.onChange(listener);
    sm.transition('connect');
    expect(listener).toHaveBeenCalledWith('connecting', 'disconnected');
  });

  it('unsubscribe stops notifications', () => {
    const sm = new ConnectionStateMachine();
    const listener = vi.fn();
    const unsub = sm.onChange(listener);
    unsub();
    sm.transition('connect');
    expect(listener).not.toHaveBeenCalled();
  });

  it('listener error does not crash state machine', () => {
    const sm = new ConnectionStateMachine();
    sm.onChange(() => {
      throw new Error('boom');
    });
    expect(() => sm.transition('connect')).not.toThrow();
    expect(sm.state).toBe('connecting');
  });

  it('reset returns to disconnected', () => {
    const sm = new ConnectionStateMachine();
    sm.transition('connect');
    sm.transition('onOpen');
    const listener = vi.fn();
    sm.onChange(listener);
    sm.reset();
    expect(sm.state).toBe('disconnected');
    expect(listener).toHaveBeenCalledWith('disconnected', 'connected');
  });

  it('reset from disconnected is a no-op', () => {
    const sm = new ConnectionStateMachine();
    const listener = vi.fn();
    sm.onChange(listener);
    sm.reset();
    expect(listener).not.toHaveBeenCalled();
  });
});
