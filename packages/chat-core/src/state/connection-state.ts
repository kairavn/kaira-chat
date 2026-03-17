import type { ConnectionState } from '../types/event.js';

import { createChatError } from '../types/error.js';

type TransitionAction =
  | 'connect'
  | 'onOpen'
  | 'onError'
  | 'onClose'
  | 'disconnect'
  | 'retry'
  | 'maxRetries';

const VALID_TRANSITIONS: Record<
  ConnectionState,
  Partial<Record<TransitionAction, ConnectionState>>
> = {
  disconnected: { connect: 'connecting' },
  connecting: { onOpen: 'connected', onError: 'disconnected' },
  connected: { onClose: 'reconnecting', disconnect: 'disconnecting' },
  reconnecting: { retry: 'connecting', maxRetries: 'disconnected', disconnect: 'disconnecting' },
  disconnecting: { onClose: 'disconnected' },
};

/**
 * Deterministic state machine for transport connection lifecycle.
 *
 * Invalid transitions throw a typed `ChatError` with kind `"state"`.
 */
export class ConnectionStateMachine {
  private _state: ConnectionState = 'disconnected';
  private readonly listeners = new Set<(state: ConnectionState, prev: ConnectionState) => void>();

  /** Current connection state. */
  get state(): ConnectionState {
    return this._state;
  }

  /** Attempt a transition. Throws on invalid transitions. */
  transition(action: TransitionAction): ConnectionState {
    const nextState = VALID_TRANSITIONS[this._state][action];
    if (!nextState) {
      throw createChatError(
        'state',
        `Invalid connection transition: "${action}" from "${this._state}"`,
        { metadata: { currentState: this._state, action } },
      );
    }

    const prev = this._state;
    this._state = nextState;
    this.notifyListeners(nextState, prev);
    return nextState;
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  onChange(listener: (state: ConnectionState, prev: ConnectionState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Reset to disconnected (for tests / teardown). */
  reset(): void {
    const prev = this._state;
    this._state = 'disconnected';
    if (prev !== 'disconnected') {
      this.notifyListeners('disconnected', prev);
    }
  }

  private notifyListeners(state: ConnectionState, prev: ConnectionState): void {
    for (const listener of this.listeners) {
      try {
        listener(state, prev);
      } catch {
        // Listener errors must not break the state machine
      }
    }
  }
}
