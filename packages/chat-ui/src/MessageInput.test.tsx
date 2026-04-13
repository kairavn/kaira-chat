import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MessageInput } from './MessageInput';

describe('MessageInput', () => {
  it('trims input, calls callbacks, and clears the draft on send', async () => {
    const onSend = vi.fn(async () => {});
    const onValueChange = vi.fn<(text: string) => void>();
    const onBlur = vi.fn();

    render(
      <MessageInput
        onSend={onSend}
        onValueChange={onValueChange}
        onBlur={onBlur}
      />,
    );

    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, {
      target: { value: '  hello world  ' },
    });
    fireEvent.submit(textarea.closest('form') ?? textarea);
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('hello world');
    });
    expect(onValueChange).toHaveBeenNthCalledWith(1, '  hello world  ');
    expect(onValueChange).toHaveBeenLastCalledWith('');
    expect(onBlur).toHaveBeenCalledOnce();
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('Expected a textarea element');
    }
    expect(textarea.value).toBe('');
  });

  it('submits on Enter, preserves newlines with Shift+Enter, and respects disabled state', async () => {
    const onSend = vi.fn(async () => {});

    const disabledRender = render(
      <MessageInput
        onSend={onSend}
        disabled
      />,
    );

    const textarea = disabledRender.container.querySelector('textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('Expected a disabled textarea element');
    }
    fireEvent.change(textarea, {
      target: { value: 'disabled message' },
    });
    fireEvent.keyDown(textarea, {
      key: 'Enter',
    });

    await waitFor(() => {
      expect(onSend).not.toHaveBeenCalled();
    });

    disabledRender.unmount();

    const enabledRender = render(<MessageInput onSend={onSend} />);
    const enabledTextarea = enabledRender.container.querySelector('textarea');
    if (!(enabledTextarea instanceof HTMLTextAreaElement)) {
      throw new Error('Expected an enabled textarea element');
    }

    fireEvent.change(enabledTextarea, {
      target: { value: 'line one' },
    });
    fireEvent.keyDown(enabledTextarea, {
      key: 'Enter',
      shiftKey: true,
    });
    expect(enabledTextarea.value).toBe('line one');

    fireEvent.keyDown(enabledTextarea, {
      key: 'Enter',
    });

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('line one');
    });
  });
});
