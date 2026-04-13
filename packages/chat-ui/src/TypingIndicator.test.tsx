import type { TypingParticipantState } from '@kaira/chat-core';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TypingIndicator } from './TypingIndicator';

function buildParticipant(id: string, displayName?: string): TypingParticipantState {
  return {
    conversationId: 'conversation-1',
    participant: {
      id,
      role: 'assistant',
      ...(displayName ? { displayName } : {}),
    },
    startedAt: 1,
    lastUpdatedAt: 1,
    expiresAt: 10,
    source: 'remote',
  };
}

describe('TypingIndicator', () => {
  it('renders nothing when there are no typing participants', () => {
    const { container } = render(<TypingIndicator participants={[]} />);

    expect(container.textContent).toBe('');
  });

  it('renders the default participant-aware label', () => {
    render(
      <TypingIndicator
        participants={[
          buildParticipant('assistant-1', 'Ada'),
          buildParticipant('assistant-2', 'Grace'),
          buildParticipant('assistant-3', 'Linus'),
        ]}
      />,
    );

    expect(screen.getByText('Ada, Grace, and 1 other are typing')).toBeTruthy();
  });

  it('supports a custom label formatter', () => {
    render(
      <TypingIndicator
        participants={[buildParticipant('assistant-1', 'Ada')]}
        formatLabel={(participants) => `${participants.length} agent active`}
      />,
    );

    expect(screen.getByText('1 agent active')).toBeTruthy();
  });
});
