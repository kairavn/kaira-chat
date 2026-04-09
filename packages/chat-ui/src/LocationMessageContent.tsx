import type { LocationMessage } from '@kaira/chat-core';
import type { JSX } from 'react';

import {
  buildLocationHref,
  EXTERNAL_LINK_ATTRIBUTES,
  formatCoordinates,
} from './content-formatters';
import {
  actionLinkStyle,
  actionRowStyle,
  coordinateTextStyle,
  headingStyle,
  subtleTextStyle,
  surfaceStyle,
} from './content-styles';

export interface LocationMessageContentProps {
  readonly message: LocationMessage;
}

export function LocationMessageContent({ message }: LocationMessageContentProps): JSX.Element {
  const locationLabel = message.label ?? 'Shared location';
  const locationHref = buildLocationHref(message);

  return (
    <div style={surfaceStyle}>
      <div>
        <p style={headingStyle}>{locationLabel}</p>
        {message.address ? <p style={subtleTextStyle}>{message.address}</p> : null}
      </div>
      <p style={coordinateTextStyle}>{formatCoordinates(message.latitude, message.longitude)}</p>
      <div style={actionRowStyle}>
        <a
          {...EXTERNAL_LINK_ATTRIBUTES}
          aria-label="Open location in maps"
          href={locationHref}
          style={actionLinkStyle}
        >
          Open in maps
        </a>
      </div>
    </div>
  );
}
