import { describe, expect, it, vi } from 'vitest';

import { ConversationStateMachine } from './conversation-state.js';

describe('ConversationStateMachine', () => {
  it('starts in active state by default', () => {
    const sm = new ConversationStateMachine();
    expect(sm.state).toBe('active');
  });

  it('accepts initial state', () => {
    const sm = new ConversationStateMachine('archived');
    expect(sm.state).toBe('archived');
  });

  it('transitions active → archived', () => {
    const sm = new ConversationStateMachine();
    sm.transition('archive');
    expect(sm.state).toBe('archived');
  });

  it('transitions archived → active', () => {
    const sm = new ConversationStateMachine('archived');
    sm.transition('unarchive');
    expect(sm.state).toBe('active');
  });

  it('transitions active → closed', () => {
    const sm = new ConversationStateMachine();
    sm.transition('close');
    expect(sm.state).toBe('closed');
  });

  it('transitions closed → active', () => {
    const sm = new ConversationStateMachine('closed');
    sm.transition('reopen');
    expect(sm.state).toBe('active');
  });

  it('throws on invalid transition', () => {
    const sm = new ConversationStateMachine();
    expect(() => sm.transition('unarchive')).toThrow(/Invalid conversation transition/);
  });

  it("throws ChatError with kind 'state'", () => {
    const sm = new ConversationStateMachine('closed');
    try {
      sm.transition('archive');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toMatchObject({ kind: 'state' });
    }
  });

  it('notifies listeners on transition', () => {
    const sm = new ConversationStateMachine();
    const listener = vi.fn();
    sm.onChange(listener);
    sm.transition('archive');
    expect(listener).toHaveBeenCalledWith('archived', 'active');
  });

  it('unsubscribe stops notifications', () => {
    const sm = new ConversationStateMachine();
    const listener = vi.fn();
    const unsub = sm.onChange(listener);
    unsub();
    sm.transition('archive');
    expect(listener).not.toHaveBeenCalled();
  });

  it('listener error does not crash state machine', () => {
    const sm = new ConversationStateMachine();
    sm.onChange(() => {
      throw new Error('boom');
    });
    expect(() => sm.transition('archive')).not.toThrow();
    expect(sm.state).toBe('archived');
  });
});
