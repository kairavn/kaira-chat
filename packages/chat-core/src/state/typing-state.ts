import type { ConversationTypingState, TypingParticipantState } from '../types/typing.js';

interface TypingStateStoreConfig {
  readonly onExpire: (conversationId: string, participantId: string) => void;
}

interface InternalTypingEntry {
  readonly state: TypingParticipantState;
  readonly timeout: ReturnType<typeof setTimeout> | undefined;
}

interface UpsertTypingStateParams {
  readonly conversationId: string;
  readonly participant: TypingParticipantState['participant'];
  readonly source: TypingParticipantState['source'];
  readonly now: number;
  readonly ttlMs?: number;
}

interface TypingStateUpdate {
  readonly didStart: boolean;
  readonly state: TypingParticipantState;
}

/**
 * Ephemeral conversation-scoped typing state with per-participant expiry timers.
 */
export class TypingStateStore {
  private readonly conversations = new Map<string, Map<string, InternalTypingEntry>>();
  private readonly onExpire: TypingStateStoreConfig['onExpire'];

  constructor(config: TypingStateStoreConfig) {
    this.onExpire = config.onExpire;
  }

  upsertLocalState(params: Omit<UpsertTypingStateParams, 'source' | 'ttlMs'>): TypingStateUpdate {
    return this.upsertState({
      ...params,
      source: 'local',
    });
  }

  upsertRemoteState(
    params: Omit<UpsertTypingStateParams, 'source'> & { readonly ttlMs: number },
  ): TypingStateUpdate {
    return this.upsertState({
      ...params,
      source: 'remote',
    });
  }

  getParticipantState(
    conversationId: string,
    participantId: string,
  ): TypingParticipantState | undefined {
    return this.conversations.get(conversationId)?.get(participantId)?.state;
  }

  stopTyping(conversationId: string, participantId: string): TypingParticipantState | undefined {
    const conversation = this.conversations.get(conversationId);
    const entry = conversation?.get(participantId);
    if (!conversation || !entry) {
      return undefined;
    }

    this.clearTimeout(entry.timeout);
    conversation.delete(participantId);
    if (conversation.size === 0) {
      this.conversations.delete(conversationId);
    }

    return entry.state;
  }

  getConversationState(conversationId: string): ConversationTypingState {
    const participants = [...(this.conversations.get(conversationId)?.values() ?? [])].map(
      (entry) => entry.state,
    );

    return {
      conversationId,
      participants,
    };
  }

  isTyping(conversationId: string, participantId?: string): boolean {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return false;
    }

    if (participantId === undefined) {
      return conversation.size > 0;
    }

    return conversation.has(participantId);
  }

  clearAll(): void {
    for (const conversation of this.conversations.values()) {
      for (const entry of conversation.values()) {
        this.clearTimeout(entry.timeout);
      }
    }

    this.conversations.clear();
  }

  private upsertState(params: UpsertTypingStateParams): TypingStateUpdate {
    const conversation = this.getConversationMap(params.conversationId);
    const existing = conversation.get(params.participant.id);
    const startedAt = existing?.state.startedAt ?? params.now;
    const expiresAt = params.ttlMs === undefined ? null : params.now + params.ttlMs;
    const state: TypingParticipantState = {
      conversationId: params.conversationId,
      participant: params.participant,
      startedAt,
      lastUpdatedAt: params.now,
      expiresAt,
      source: params.source,
    };

    this.clearTimeout(existing?.timeout);
    const timeout =
      params.ttlMs === undefined
        ? undefined
        : setTimeout(() => {
            this.onExpire(params.conversationId, params.participant.id);
          }, params.ttlMs);

    conversation.set(params.participant.id, {
      state,
      timeout,
    });

    return {
      didStart: existing === undefined,
      state,
    };
  }

  private getConversationMap(conversationId: string): Map<string, InternalTypingEntry> {
    const existing = this.conversations.get(conversationId);
    if (existing) {
      return existing;
    }

    const conversation = new Map<string, InternalTypingEntry>();
    this.conversations.set(conversationId, conversation);
    return conversation;
  }

  private clearTimeout(timeout: ReturnType<typeof setTimeout> | undefined): void {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}
