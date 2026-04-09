import type { ImageMessage } from '@kaira/chat-core';
import type { JSX } from 'react';

import { EXTERNAL_LINK_ATTRIBUTES } from './content-formatters';
import {
  actionLinkStyle,
  actionRowStyle,
  contentStackStyle,
  metaPillStyle,
  metaRowStyle,
  previewImageStyle,
  subtleTextStyle,
  surfaceStyle,
} from './content-styles';

export interface ImageMessageContentProps {
  readonly message: ImageMessage;
}

export function ImageMessageContent({ message }: ImageMessageContentProps): JSX.Element {
  const altText = message.alt ?? 'Shared image';
  const dimensionLabel = message.dimensions
    ? `${message.dimensions.width} x ${message.dimensions.height}`
    : undefined;

  return (
    <figure style={surfaceStyle}>
      <div style={contentStackStyle}>
        <img
          alt={altText}
          src={message.url}
          style={previewImageStyle}
        />
        <figcaption style={subtleTextStyle}>{altText}</figcaption>
      </div>
      {dimensionLabel ? (
        <div style={metaRowStyle}>
          <span style={metaPillStyle}>{dimensionLabel}</span>
        </div>
      ) : null}
      <div style={actionRowStyle}>
        <a
          {...EXTERNAL_LINK_ATTRIBUTES}
          aria-label="Open image"
          href={message.url}
          style={actionLinkStyle}
        >
          Open image
        </a>
        <a
          aria-label="Download image"
          download
          href={message.url}
          style={actionLinkStyle}
        >
          Download image
        </a>
      </div>
    </figure>
  );
}
