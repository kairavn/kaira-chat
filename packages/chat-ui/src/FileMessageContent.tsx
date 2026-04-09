import type { FileMessage } from '@kaira/chat-core';
import type { JSX } from 'react';

import { EXTERNAL_LINK_ATTRIBUTES, formatFileSize } from './content-formatters';
import {
  actionLinkStyle,
  actionRowStyle,
  headingStyle,
  metaPillStyle,
  metaRowStyle,
  subtleTextStyle,
  surfaceStyle,
} from './content-styles';

export interface FileMessageContentProps {
  readonly message: FileMessage;
}

export function FileMessageContent({ message }: FileMessageContentProps): JSX.Element {
  const formattedSize = formatFileSize(message.size);

  return (
    <div style={surfaceStyle}>
      <div>
        <p style={headingStyle}>{message.name}</p>
        <p style={subtleTextStyle}>Shared file attachment</p>
      </div>
      <div style={metaRowStyle}>
        <span style={metaPillStyle}>{message.mimeType}</span>
        {formattedSize ? <span style={metaPillStyle}>{formattedSize}</span> : null}
      </div>
      <div style={actionRowStyle}>
        <a
          {...EXTERNAL_LINK_ATTRIBUTES}
          aria-label="Open file"
          href={message.url}
          style={actionLinkStyle}
        >
          Open file
        </a>
        <a
          aria-label="Download file"
          download={message.name}
          href={message.url}
          style={actionLinkStyle}
        >
          Download file
        </a>
      </div>
    </div>
  );
}
