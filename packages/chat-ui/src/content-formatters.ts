import type { LocationMessage } from '@kaira/chat-core';

export const EXTERNAL_LINK_ATTRIBUTES = {
  target: '_blank',
  rel: 'noreferrer noopener',
} as const;

export function formatFileSize(size: number | undefined): string | undefined {
  if (size === undefined) {
    return undefined;
  }

  if (size < 1024) {
    return `${size} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const roundedValue = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${roundedValue} ${units[unitIndex]}`;
}

export function formatDuration(durationSeconds: number | undefined): string | undefined {
  if (durationSeconds === undefined) {
    return undefined;
  }

  const totalSeconds = Math.max(0, Math.round(durationSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function deriveAssetLabel(
  url: string,
  fallbackLabel: string,
  preferredLabel?: string,
): string {
  if (preferredLabel && preferredLabel.trim().length > 0) {
    return preferredLabel;
  }

  const cleanUrl = url.split('#')[0]?.split('?')[0] ?? url;
  const segments = cleanUrl.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  if (!lastSegment) {
    return fallbackLabel;
  }

  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
}

export function formatMimeType(mimeType: string | undefined): string | undefined {
  if (!mimeType || mimeType.trim().length === 0) {
    return undefined;
  }

  return mimeType;
}

export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function buildLocationHref(message: LocationMessage): string {
  if (message.url && message.url.trim().length > 0) {
    return message.url;
  }

  const query = encodeURIComponent(`${message.latitude},${message.longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
