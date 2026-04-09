import type { CSSProperties } from 'react';

export const contentStackStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
};

export const textContentStyle: CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  lineHeight: 1.55,
  color: 'inherit',
};

export const subtleTextStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(148, 163, 184, 0.95)',
  fontSize: 13,
  lineHeight: 1.45,
};

export const surfaceStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(148, 163, 184, 0.22)',
  background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.16) 0%, rgba(15, 23, 42, 0.04) 100%)',
  minWidth: 0,
};

export const previewImageStyle: CSSProperties = {
  display: 'block',
  maxWidth: '100%',
  width: '100%',
  height: 'auto',
  borderRadius: 12,
  objectFit: 'cover',
  backgroundColor: 'rgba(15, 23, 42, 0.2)',
};

export const previewVideoStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  maxWidth: '100%',
  maxHeight: 360,
  borderRadius: 12,
  backgroundColor: '#020617',
};

export const previewAudioStyle: CSSProperties = {
  width: '100%',
  minWidth: 240,
};

export const metaRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
};

export const metaPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 8px',
  borderRadius: 999,
  backgroundColor: 'rgba(59, 130, 246, 0.12)',
  border: '1px solid rgba(59, 130, 246, 0.28)',
  color: 'rgba(226, 232, 240, 0.98)',
  fontSize: 12,
  lineHeight: 1.2,
};

export const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
};

export const actionLinkStyle: CSSProperties = {
  color: 'inherit',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  fontSize: 13,
};

export const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  lineHeight: 1.35,
  fontWeight: 600,
  color: 'inherit',
};

export const coordinateTextStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  letterSpacing: '0.02em',
  color: 'rgba(226, 232, 240, 0.95)',
};

export const fallbackStyle: CSSProperties = {
  ...surfaceStyle,
  border: '1px solid rgba(248, 113, 113, 0.28)',
  background: 'linear-gradient(180deg, rgba(127, 29, 29, 0.18) 0%, rgba(69, 10, 10, 0.08) 100%)',
};
