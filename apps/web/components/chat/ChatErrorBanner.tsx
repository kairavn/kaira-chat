'use client';

interface ChatErrorBannerProps {
  readonly error: string;
  readonly onDismiss: () => void;
}

/**
 * Demo-only error banner for send/connect failures.
 */
export function ChatErrorBanner({ error, onDismiss }: ChatErrorBannerProps): React.JSX.Element {
  return (
    <div
      style={{
        borderRadius: 10,
        border: '1px solid #7f1d1d',
        background: '#450a0a',
        color: '#fecaca',
        padding: '10px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span>{error}</span>
      <button
        onClick={onDismiss}
        style={{
          border: 'none',
          borderRadius: 8,
          padding: '6px 10px',
          cursor: 'pointer',
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
