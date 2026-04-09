import type { AudioMessage } from '@kaira/chat-core';
import type { JSX } from 'react';

import {
  deriveAssetLabel,
  EXTERNAL_LINK_ATTRIBUTES,
  formatDuration,
  formatFileSize,
  formatMimeType,
} from './content-formatters';
import {
  actionLinkStyle,
  actionRowStyle,
  headingStyle,
  metaPillStyle,
  metaRowStyle,
  previewAudioStyle,
  subtleTextStyle,
  surfaceStyle,
} from './content-styles';

export interface AudioMessageContentProps {
  readonly message: AudioMessage;
}

export function AudioMessageContent({ message }: AudioMessageContentProps): JSX.Element {
  const label = deriveAssetLabel(message.url, 'Audio clip', message.title);
  const duration = formatDuration(message.durationSeconds);
  const size = formatFileSize(message.size);
  const mimeType = formatMimeType(message.mimeType);

  return (
    <div style={surfaceStyle}>
      <div>
        <p style={headingStyle}>{label}</p>
        <p style={subtleTextStyle}>Shared audio attachment</p>
      </div>
      <audio
        controls
        preload="metadata"
        src={message.url}
        style={previewAudioStyle}
      >
        Your browser does not support audio playback.
      </audio>
      <div style={metaRowStyle}>
        {mimeType ? <span style={metaPillStyle}>{mimeType}</span> : null}
        {duration ? <span style={metaPillStyle}>{duration}</span> : null}
        {size ? <span style={metaPillStyle}>{size}</span> : null}
      </div>
      <div style={actionRowStyle}>
        <a
          {...EXTERNAL_LINK_ATTRIBUTES}
          aria-label="Open audio"
          href={message.url}
          style={actionLinkStyle}
        >
          Open audio
        </a>
        <a
          aria-label="Download audio"
          download={label}
          href={message.url}
          style={actionLinkStyle}
        >
          Download audio
        </a>
      </div>
    </div>
  );
}
