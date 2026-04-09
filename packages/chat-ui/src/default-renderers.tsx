import type { MessageRendererProps, RendererDefinition } from './renderer-registry';
import type { JSX } from 'react';

import {
  isAIMessage,
  isAudioMessage,
  isFileMessage,
  isImageMessage,
  isLocationMessage,
  isSystemMessage,
  isTextMessage,
  isVideoMessage,
} from '@kaira/chat-core';

import { AudioMessageContent } from './AudioMessageContent';
import { subtleTextStyle } from './content-styles';
import { FileMessageContent } from './FileMessageContent';
import { ImageMessageContent } from './ImageMessageContent';
import { LocationMessageContent } from './LocationMessageContent';
import { TextMessageContent } from './TextMessageContent';
import { TextStreamMessageContent } from './TextStreamMessageContent';
import { UnsupportedMessageContent } from './UnsupportedMessageContent';
import { VideoMessageContent } from './VideoMessageContent';

function TextMessageRenderer({ message }: MessageRendererProps): JSX.Element {
  if (!isTextMessage(message)) {
    return (
      <UnsupportedMessageContent
        messageType={message.type}
        reason="The text renderer received a non-text payload."
        title="Unable to render text message"
      />
    );
  }

  return <TextMessageContent message={message} />;
}

function AIMessageRenderer({ message }: MessageRendererProps): JSX.Element {
  if (!isAIMessage(message)) {
    return (
      <UnsupportedMessageContent
        messageType={message.type}
        reason="The stream renderer received a non-AI payload."
        title="Unable to render streamed text"
      />
    );
  }

  return <TextStreamMessageContent message={message} />;
}

function ImageMessageRenderer({ message }: MessageRendererProps): JSX.Element {
  if (!isImageMessage(message)) {
    return (
      <UnsupportedMessageContent
        messageType={message.type}
        reason="The image renderer received a non-image payload."
        title="Unable to render image message"
      />
    );
  }

  return <ImageMessageContent message={message} />;
}

function AudioMessageRenderer({ message }: MessageRendererProps): JSX.Element {
  if (!isAudioMessage(message)) {
    return (
      <UnsupportedMessageContent
        messageType={message.type}
        reason="The audio renderer received a non-audio payload."
        title="Unable to render audio message"
      />
    );
  }

  return <AudioMessageContent message={message} />;
}

function VideoMessageRenderer({ message }: MessageRendererProps): JSX.Element {
  if (!isVideoMessage(message)) {
    return (
      <UnsupportedMessageContent
        messageType={message.type}
        reason="The video renderer received a non-video payload."
        title="Unable to render video message"
      />
    );
  }

  return <VideoMessageContent message={message} />;
}

function FileMessageRenderer({ message }: MessageRendererProps): JSX.Element {
  if (!isFileMessage(message)) {
    return (
      <UnsupportedMessageContent
        messageType={message.type}
        reason="The file renderer received a non-file payload."
        title="Unable to render file message"
      />
    );
  }

  return <FileMessageContent message={message} />;
}

function LocationMessageRenderer({ message }: MessageRendererProps): JSX.Element {
  if (!isLocationMessage(message)) {
    return (
      <UnsupportedMessageContent
        messageType={message.type}
        reason="The location renderer received a non-location payload."
        title="Unable to render location message"
      />
    );
  }

  return <LocationMessageContent message={message} />;
}

function SystemMessageRenderer({ message }: MessageRendererProps): JSX.Element {
  if (!isSystemMessage(message)) {
    return (
      <UnsupportedMessageContent
        messageType={message.type}
        reason="The system renderer received a non-system payload."
        title="Unable to render system message"
      />
    );
  }

  return (
    <p style={subtleTextStyle}>
      [{message.eventKind}] {message.content}
    </p>
  );
}

/**
 * Built-in renderer definitions registered by default.
 */
export const DEFAULT_RENDERERS: ReadonlyArray<RendererDefinition> = [
  { type: 'text', component: TextMessageRenderer },
  { type: 'image', component: ImageMessageRenderer },
  { type: 'audio', component: AudioMessageRenderer },
  { type: 'video', component: VideoMessageRenderer },
  { type: 'file', component: FileMessageRenderer },
  { type: 'location', component: LocationMessageRenderer },
  { type: 'system', component: SystemMessageRenderer },
  { type: 'ai', component: AIMessageRenderer },
];
