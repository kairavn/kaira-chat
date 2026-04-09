import type { TextMessage } from '@kaira/chat-core';
import type { JSX } from 'react';

import { textContentStyle } from './content-styles';

export interface TextMessageContentProps {
  readonly message: TextMessage;
}

export function TextMessageContent({ message }: TextMessageContentProps): JSX.Element {
  return <p style={textContentStyle}>{message.content}</p>;
}
