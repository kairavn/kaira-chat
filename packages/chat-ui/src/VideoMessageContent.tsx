import type { VideoMessage } from '@kaira/chat-core';
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
  previewVideoStyle,
  subtleTextStyle,
  surfaceStyle,
} from './content-styles';

export interface VideoMessageContentProps {
  readonly message: VideoMessage;
}

export function VideoMessageContent({ message }: VideoMessageContentProps): JSX.Element {
  const label = deriveAssetLabel(message.url, 'Video clip', message.title);
  const duration = formatDuration(message.durationSeconds);
  const size = formatFileSize(message.size);
  const mimeType = formatMimeType(message.mimeType);
  const dimensionLabel = message.dimensions
    ? `${message.dimensions.width} x ${message.dimensions.height}`
    : undefined;

  return (
    <div style={surfaceStyle}>
      <div>
        <p style={headingStyle}>{label}</p>
        <p style={subtleTextStyle}>Shared video attachment</p>
      </div>
      <video
        controls
        poster={message.posterUrl}
        preload="metadata"
        src={message.url}
        style={previewVideoStyle}
      >
        Your browser does not support video playback.
      </video>
      <div style={metaRowStyle}>
        {mimeType ? <span style={metaPillStyle}>{mimeType}</span> : null}
        {duration ? <span style={metaPillStyle}>{duration}</span> : null}
        {size ? <span style={metaPillStyle}>{size}</span> : null}
        {dimensionLabel ? <span style={metaPillStyle}>{dimensionLabel}</span> : null}
      </div>
      <div style={actionRowStyle}>
        <a
          {...EXTERNAL_LINK_ATTRIBUTES}
          aria-label="Open video"
          href={message.url}
          style={actionLinkStyle}
        >
          Open video
        </a>
        <a
          aria-label="Download video"
          download={label}
          href={message.url}
          style={actionLinkStyle}
        >
          Download video
        </a>
      </div>
    </div>
  );
}
