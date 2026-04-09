import type { Participant, TypingParticipantState } from '@kaira/chat-core';
import type { JSX } from 'react';

function getParticipantLabel(participant: Participant): string {
  return participant.displayName ?? participant.id;
}

function formatDefaultLabel(participants: ReadonlyArray<TypingParticipantState>): string {
  const labels = participants.map((participantState) =>
    getParticipantLabel(participantState.participant),
  );

  if (labels.length === 0) {
    return 'Someone is typing';
  }

  if (labels.length === 1) {
    return `${labels[0]} is typing`;
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]} are typing`;
  }

  const remainingCount = labels.length - 2;
  return `${labels[0]}, ${labels[1]}, and ${remainingCount} other${remainingCount === 1 ? '' : 's'} are typing`;
}

/**
 * Props for the reusable typing indicator.
 */
export interface TypingIndicatorProps {
  readonly participants: ReadonlyArray<TypingParticipantState>;
  readonly formatLabel?: (participants: ReadonlyArray<TypingParticipantState>) => string;
}

/**
 * Lightweight participant-aware typing indicator.
 */
export function TypingIndicator({
  participants,
  formatLabel,
}: TypingIndicatorProps): JSX.Element | null {
  if (participants.length === 0) {
    return null;
  }

  const label = formatLabel?.(participants) ?? formatDefaultLabel(participants);

  return (
    <span
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <span>{label}</span>
      <span style={{ animation: 'kaira-typing-dot 1s infinite steps(1,end)' }}>.</span>
      <span style={{ animation: 'kaira-typing-dot 1s 0.2s infinite steps(1,end)' }}>.</span>
      <span style={{ animation: 'kaira-typing-dot 1s 0.4s infinite steps(1,end)' }}>.</span>
      <style>{`@keyframes kaira-typing-dot { 0%, 20% { opacity: 0.2; } 50% { opacity: 1; } 100% { opacity: 0.2; } }`}</style>
    </span>
  );
}
