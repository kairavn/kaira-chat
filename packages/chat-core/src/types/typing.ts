import type { Participant } from './participant.js';

/** Why a typing state ended. */
export type TypingStopReason = 'explicit' | 'expired' | 'message';

/** Source of an active typing state. */
export type TypingStateSource = 'local' | 'remote';

/** Transport-level typing action. */
export type TypingTransportAction = 'start' | 'stop';

/** Configuration for typing debounce/throttle and expiry behavior. */
export interface TypingConfig {
  readonly emitThrottleMs?: number;
  readonly idleTimeoutMs?: number;
  readonly remoteTtlMs?: number;
}

/** Typed transport payload for conversation-scoped typing updates. */
export interface TypingTransportPayload {
  readonly action: TypingTransportAction;
  readonly conversationId: string;
  readonly participant: Participant;
}

/** Resolved runtime state for one active typing participant. */
export interface TypingParticipantState {
  readonly conversationId: string;
  readonly participant: Participant;
  readonly startedAt: number;
  readonly lastUpdatedAt: number;
  readonly expiresAt: number | null;
  readonly source: TypingStateSource;
}

/** Runtime typing state for one conversation. */
export interface ConversationTypingState {
  readonly conversationId: string;
  readonly participants: ReadonlyArray<TypingParticipantState>;
}

/** Selector options for filtering conversation typing state. */
export interface TypingParticipantSelectorOptions {
  readonly excludeParticipantId?: string;
}
