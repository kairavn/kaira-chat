import type { AIMessage } from '@kaira/chat-core';
import type { JSX } from 'react';

import {
  contentStackStyle,
  metaPillStyle,
  metaRowStyle,
  subtleTextStyle,
  textContentStyle,
} from './content-styles';

export interface TextStreamMessageContentProps {
  readonly message: AIMessage;
}

export function TextStreamMessageContent({ message }: TextStreamMessageContentProps): JSX.Element {
  const isStreaming = message.streamState === 'streaming';
  const isErrored = message.streamState === 'error';
  const hasContent = message.content.trim().length > 0;

  return (
    <div style={contentStackStyle}>
      {isStreaming || isErrored ? (
        <div style={metaRowStyle}>
          <span
            aria-live={isStreaming ? 'polite' : undefined}
            role={isStreaming ? 'status' : undefined}
            style={metaPillStyle}
          >
            {isStreaming ? 'Streaming response' : 'Stream interrupted'}
          </span>
        </div>
      ) : null}
      {hasContent ? (
        <p style={textContentStyle}>{message.content}</p>
      ) : (
        <p style={subtleTextStyle}>
          {isStreaming ? 'Streaming response...' : 'No response content.'}
        </p>
      )}
    </div>
  );
}
