'use client';

import type { ReactNode } from 'react';

interface ScrollContainerProps {
  readonly children: ReactNode;
  readonly onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  readonly scrollRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Scrollable message viewport for chat timeline.
 */
export function ScrollContainer({
  children,
  onScroll,
  scrollRef,
}: ScrollContainerProps): React.JSX.Element {
  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      style={{
        border: '1px solid #1f2937',
        borderRadius: 12,
        padding: 12,
        minHeight: 360,
        maxHeight: 520,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: '#0f172a',
      }}
    >
      {children}
    </div>
  );
}
