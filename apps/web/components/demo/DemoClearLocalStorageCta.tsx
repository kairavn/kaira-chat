'use client';

import type { JSX } from 'react';

import { useState } from 'react';

import { useDemoRuntimeClearPersistedMessages } from './DemoRuntimeProvider';

interface DemoClearLocalStorageCtaProps {
  readonly onClearError?: (message: string) => void;
}

/**
 * Clears the demo IndexedDB namespace and remounts the runtime so in-memory engine state resets.
 */
export function DemoClearLocalStorageCta({
  onClearError,
}: DemoClearLocalStorageCtaProps): JSX.Element {
  const clearPersistedMessages = useDemoRuntimeClearPersistedMessages();
  const [isClearing, setIsClearing] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
      }}
    >
      <span style={{ color: '#64748b', fontSize: 12, marginRight: 'auto' }}>
        Local IndexedDB holds demo messages for this browser.
      </span>
      <button
        type="button"
        disabled={isClearing}
        onClick={() => {
          void (async (): Promise<void> => {
            setIsClearing(true);
            try {
              await clearPersistedMessages();
            } catch (clearError: unknown) {
              const message =
                clearError instanceof Error
                  ? clearError.message
                  : 'Failed to clear persisted demo data.';
              onClearError?.(message);
            } finally {
              setIsClearing(false);
            }
          })();
        }}
        style={{
          borderRadius: 10,
          border: '1px solid #475569',
          background: 'rgba(30, 41, 59, 0.85)',
          color: '#e2e8f0',
          padding: '8px 14px',
          fontSize: 13,
          fontWeight: 600,
          cursor: isClearing ? 'not-allowed' : 'pointer',
          opacity: isClearing ? 0.65 : 1,
        }}
      >
        {isClearing ? 'Clearing…' : 'Clear local storage'}
      </button>
    </div>
  );
}
