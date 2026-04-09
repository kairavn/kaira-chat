import type { JSX } from 'react';

import { fallbackStyle, headingStyle, subtleTextStyle } from './content-styles';

export interface UnsupportedMessageContentProps {
  readonly messageType: string;
  readonly title?: string;
  readonly reason?: string;
}

export function UnsupportedMessageContent({
  messageType,
  title = 'Unsupported message',
  reason,
}: UnsupportedMessageContentProps): JSX.Element {
  return (
    <div
      role="note"
      aria-label={title}
      style={fallbackStyle}
    >
      <p style={headingStyle}>{title}</p>
      <p style={subtleTextStyle}>Message type: {messageType}</p>
      {reason ? <p style={subtleTextStyle}>{reason}</p> : null}
    </div>
  );
}
