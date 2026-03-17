/** Role a participant plays in a conversation. */
export type ParticipantRole = 'user' | 'assistant' | 'system' | 'custom';

/** A participant in a conversation (user, assistant, or system actor). */
export interface Participant {
  readonly id: string;
  readonly role: ParticipantRole;
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly metadata?: Record<string, unknown>;
}
