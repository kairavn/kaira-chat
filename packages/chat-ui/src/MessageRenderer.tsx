import type { Message } from '@kaira/chat-core';
import type { MessageRendererProps, RendererRegistry } from './renderer-registry';
import type { ComponentType, JSX } from 'react';

import { memo } from 'react';

/**
 * Props for rendering a message through a renderer registry.
 */
export interface DynamicMessageRendererProps extends MessageRendererProps {
  readonly registry: RendererRegistry;
  readonly fallback?: ComponentType<{ readonly message: Message }>;
}

function DefaultFallbackRenderer({ message }: { readonly message: Message }): JSX.Element {
  return <p>Unsupported message type: {message.type}</p>;
}

/**
 * Renders one message using the renderer registered for its type.
 * Wrapped in React.memo to avoid unnecessary re-renders in long lists.
 */
export const MessageRenderer = memo(function MessageRenderer({
  message,
  conversation,
  registry,
  fallback: FallbackRenderer = DefaultFallbackRenderer,
}: DynamicMessageRendererProps): JSX.Element {
  const definition = registry.get(message.type);
  if (!definition) {
    return <FallbackRenderer message={message} />;
  }

  const RendererComponent = definition.component;
  return (
    <RendererComponent
      message={message}
      conversation={conversation}
    />
  );
});
