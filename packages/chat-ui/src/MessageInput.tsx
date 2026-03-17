'use client';

import type { JSX } from 'react';

import { useState } from 'react';

/**
 * Props for generic chat message input.
 */
export interface MessageInputProps {
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly onSend: (text: string) => Promise<void> | void;
}

/**
 * Presentational message input with Enter-to-send behavior.
 */
export function MessageInput({
  disabled = false,
  placeholder = 'Type your message...',
  onSend,
}: MessageInputProps): JSX.Element {
  const [value, setValue] = useState<string>('');

  const submit = async (): Promise<void> => {
    const text = value.trim();
    if (!text || disabled) return;
    setValue('');
    await onSend(text);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      style={{
        display: 'flex',
        gap: 8,
      }}
    >
      <textarea
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          minHeight: 42,
          maxHeight: 140,
          borderRadius: 10,
          border: '1px solid #374151',
          padding: '10px 12px',
          background: '#111827',
          color: '#f8fafc',
          resize: 'vertical',
        }}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        style={{
          height: 42,
          borderRadius: 10,
          border: 'none',
          padding: '0 14px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: disabled ? '#64748b' : '#2563eb',
          color: '#ffffff',
          fontWeight: 600,
        }}
      >
        Send
      </button>
    </form>
  );
}
