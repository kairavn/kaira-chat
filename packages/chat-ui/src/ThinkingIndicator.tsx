import { type JSX } from 'react';

/**
 * Lightweight typing indicator for assistant responses.
 */
export function ThinkingIndicator(): JSX.Element {
  return (
    <span
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <span>AI is thinking</span>
      <span style={{ animation: 'kaira-dot 1s infinite steps(1,end)' }}>.</span>
      <span style={{ animation: 'kaira-dot 1s 0.2s infinite steps(1,end)' }}>.</span>
      <span style={{ animation: 'kaira-dot 1s 0.4s infinite steps(1,end)' }}>.</span>
      <style>{`@keyframes kaira-dot { 0%, 20% { opacity: 0.2; } 50% { opacity: 1; } 100% { opacity: 0.2; } }`}</style>
    </span>
  );
}
