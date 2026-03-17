import type { MessageRendererProps, RendererDefinition } from './renderer-registry';
import type { JSX } from 'react';

import { memo } from 'react';

import {
  isAIMessage,
  isFileMessage,
  isImageMessage,
  isSystemMessage,
  isTextMessage,
} from '@kaira/chat-core';

const TextMessageRenderer = memo(function TextMessageRenderer({
  message,
}: MessageRendererProps): JSX.Element {
  if (!isTextMessage(message)) return <p>Invalid text message</p>;
  return <p>{message.content}</p>;
});

const ImageMessageRenderer = memo(function ImageMessageRenderer({
  message,
}: MessageRendererProps): JSX.Element {
  if (!isImageMessage(message)) return <p>Invalid image message</p>;
  return (
    <img
      src={message.url}
      alt={message.alt ?? 'image message'}
    />
  );
});

const FileMessageRenderer = memo(function FileMessageRenderer({
  message,
}: MessageRendererProps): JSX.Element {
  if (!isFileMessage(message)) return <p>Invalid file message</p>;
  return (
    <a
      href={message.url}
      target="_blank"
      rel="noreferrer"
    >
      {message.name}
    </a>
  );
});

const SystemMessageRenderer = memo(function SystemMessageRenderer({
  message,
}: MessageRendererProps): JSX.Element {
  if (!isSystemMessage(message)) return <p>Invalid system message</p>;
  return (
    <p>
      [{message.eventKind}] {message.content}
    </p>
  );
});

const AIMessageRenderer = memo(function AIMessageRenderer({
  message,
}: MessageRendererProps): JSX.Element {
  if (!isAIMessage(message)) return <p>Invalid ai message</p>;
  return <p>{message.content}</p>;
});

/**
 * Built-in renderer definitions registered by default.
 */
export const DEFAULT_RENDERERS: ReadonlyArray<RendererDefinition> = [
  { type: 'text', component: TextMessageRenderer },
  { type: 'image', component: ImageMessageRenderer },
  { type: 'file', component: FileMessageRenderer },
  { type: 'system', component: SystemMessageRenderer },
  { type: 'ai', component: AIMessageRenderer },
];
