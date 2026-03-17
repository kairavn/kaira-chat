import type { ConversationState } from '../types/event.js';

import { createChatError } from '../types/error.js';

type ConversationAction = 'archive' | 'unarchive' | 'close' | 'reopen';

const VALID_TRANSITIONS: Record<
  ConversationState,
  Partial<Record<ConversationAction, ConversationState>>
> = {
  active: { archive: 'archived', close: 'closed' },
  archived: { unarchive: 'active' },
  closed: { reopen: 'active' },
};

/**
 * Deterministic state machine for conversation lifecycle.
 *
 * Invalid transitions throw a typed `ChatError` with kind `"state"`.
 */
export class ConversationStateMachine {
  private _state: ConversationState;
  private readonly listeners = new Set<
    (state: ConversationState, prev: ConversationState) => void
  >();

  constructor(initial: ConversationState = 'active') {
    this._state = initial;
  }

  /** Current conversation state. */
  get state(): ConversationState {
    return this._state;
  }

  /** Attempt a transition. Throws on invalid transitions. */
  transition(action: ConversationAction): ConversationState {
    const nextState = VALID_TRANSITIONS[this._state][action];
    if (!nextState) {
      throw createChatError(
        'state',
        `Invalid conversation transition: "${action}" from "${this._state}"`,
        { metadata: { currentState: this._state, action } },
      );
    }

    const prev = this._state;
    this._state = nextState;
    this.notifyListeners(nextState, prev);
    return nextState;
  }

  /** Subscribe to state changes. */
  onChange(listener: (state: ConversationState, prev: ConversationState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(state: ConversationState, prev: ConversationState): void {
    for (const listener of this.listeners) {
      try {
        listener(state, prev);
      } catch {
        // Listener errors must not break the state machine
      }
    }
  }
}
