import type { AIMessage, Message } from '@kaira/chat-core';
import type { JSX } from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createDefaultRendererRegistry } from './default-registry';
import { DEFAULT_RENDERERS } from './default-renderers';
import { MessageRenderer } from './MessageRenderer';
import { RendererRegistry } from './renderer-registry';

const baseMessage = {
  id: 'm1',
  conversationId: 'c1',
  sender: { id: 'u1', role: 'assistant' as const },
  timestamp: 1,
  status: 'sent' as const,
};

function renderMessage(message: Message): JSX.Element {
  return (
    <MessageRenderer
      message={message}
      registry={createDefaultRendererRegistry()}
    />
  );
}

describe('@kaira/chat-ui default renderers', () => {
  it('registers built-in renderer definitions for all supported content types', () => {
    const registry = createDefaultRendererRegistry();

    expect(registry.has('text')).toBe(true);
    expect(registry.has('image')).toBe(true);
    expect(registry.has('audio')).toBe(true);
    expect(registry.has('video')).toBe(true);
    expect(registry.has('file')).toBe(true);
    expect(registry.has('location')).toBe(true);
    expect(registry.has('system')).toBe(true);
    expect(registry.has('ai')).toBe(true);
  });

  it('falls back when no renderer is registered for a valid message type', () => {
    render(
      <>
        <MessageRenderer
          message={{ ...baseMessage, type: 'custom', customType: 'workflow', payload: {} }}
          registry={new RendererRegistry()}
        />
        <MessageRenderer
          message={{
            ...baseMessage,
            id: 'm-tool',
            type: 'tool_call',
            toolCalls: [
              {
                id: 'call-1',
                toolName: 'search',
                arguments: { query: 'docs' },
              },
            ],
          }}
          registry={new RendererRegistry()}
        />
      </>,
    );

    expect(screen.getAllByText(/Unsupported message/i)).toHaveLength(2);
    expect(screen.getByText(/Message type: custom/i)).toBeTruthy();
    expect(screen.getByText(/Message type: tool_call/i)).toBeTruthy();
  });

  it('renders streaming ai messages with a text-stream affordance', () => {
    const message: AIMessage = {
      ...baseMessage,
      type: 'ai',
      content: 'Draft reply',
      streamState: 'streaming',
    };

    render(renderMessage(message));

    expect(screen.getByText('Streaming response')).toBeTruthy();
    expect(screen.getByText('Draft reply')).toBeTruthy();
  });

  it('renders built-in attachment and location controls', () => {
    const { container } = render(
      <>
        {renderMessage({
          ...baseMessage,
          type: 'image',
          url: 'https://example.com/photo.png',
          alt: 'Mountain view',
        })}
        {renderMessage({
          ...baseMessage,
          type: 'file',
          url: 'https://example.com/spec.pdf',
          name: 'spec.pdf',
          mimeType: 'application/pdf',
          size: 2048,
        })}
        {renderMessage({
          ...baseMessage,
          type: 'audio',
          url: 'https://example.com/audio.mp3',
          title: 'Release notes',
          mimeType: 'audio/mpeg',
          durationSeconds: 45,
        })}
        {renderMessage({
          ...baseMessage,
          type: 'video',
          url: 'https://example.com/video.mp4',
          title: 'Walkthrough',
          mimeType: 'video/mp4',
        })}
        {renderMessage({
          ...baseMessage,
          type: 'location',
          latitude: 10.77689,
          longitude: 106.70081,
          label: 'Ho Chi Minh City',
        })}
      </>,
    );

    expect(screen.getByRole('img', { name: 'Mountain view' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open file' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open audio' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open video' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open location in maps' })).toBeTruthy();
    expect(container.querySelector('audio')).toBeTruthy();
    expect(container.querySelector('video')).toBeTruthy();
  });

  it('degrades invalid renderer payloads to the unsupported content fallback', () => {
    const audioRenderer = DEFAULT_RENDERERS.find((definition) => definition.type === 'audio');
    if (!audioRenderer) {
      throw new Error('Missing audio renderer definition');
    }

    const AudioRendererComponent = audioRenderer.component;
    render(
      <AudioRendererComponent
        message={{ ...baseMessage, type: 'text', content: 'wrong payload' }}
      />,
    );

    expect(screen.getByText(/Unable to render audio message/i)).toBeTruthy();
    expect(screen.getByText(/Message type: text/i)).toBeTruthy();
  });
});
