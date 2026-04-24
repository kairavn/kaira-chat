# @kaira/chat-ui

UI primitives, built-in content components, and default message renderers for Kaira Chat SDK.

## Installation

```bash
npm install @kaira/chat-ui @kaira/chat-react @kaira/chat-core react react-dom
```

## Built-in Renderers

`createDefaultRendererRegistry()` registers built-in renderers for:

- `text`
- `ai` with built-in text-stream rendering for `streamState: 'streaming'`
- `image`
- `audio`
- `video`
- `file`
- `location`
- `system`

Unknown types and unregistered valid types fall back to `UnsupportedMessageContent`.
`custom` messages intentionally require consumer-owned renderers.

## Quick Start

```tsx
import type { Message } from '@kaira/chat-core';
import type { JSX } from 'react';

import {
  createDefaultRendererRegistry,
  MessageInput,
  MessageRenderer,
  TypingIndicator,
} from '@kaira/chat-ui';

const registry = createDefaultRendererRegistry();

export function ChatSurface(props: { readonly message: Message }): JSX.Element {
  return (
    <>
      <MessageRenderer
        message={props.message}
        registry={registry}
      />
      <TypingIndicator participants={[]} />
      <MessageInput
        onValueChange={(value) => {
          console.log('draft', value);
        }}
        onBlur={() => {
          console.log('composer blurred');
        }}
        onSend={async (content) => {
          console.log('submit', content);
        }}
      />
    </>
  );
}
```

## Reusable Built-in Components

The package also exports typed content components that you can use directly:

- `TextMessageContent`
- `TextStreamMessageContent`
- `ImageMessageContent`
- `FileMessageContent`
- `AudioMessageContent`
- `VideoMessageContent`
- `LocationMessageContent`
- `ThinkingIndicator`
- `TypingIndicator`
- `UnsupportedMessageContent`

## Overriding a Built-in Renderer

```tsx
import type { LocationMessage } from '@kaira/chat-core';
import type { MessageRendererProps } from '@kaira/chat-ui';
import type { JSX } from 'react';

import { createDefaultRendererRegistry, LocationMessageContent } from '@kaira/chat-ui';

const registry = createDefaultRendererRegistry();

function CustomLocationRenderer(props: MessageRendererProps): JSX.Element {
  if (props.message.type !== 'location') {
    throw new Error('CustomLocationRenderer received a non-location message');
  }

  const message: LocationMessage = props.message;
  return <LocationMessageContent message={message} />;
}

registry.register({
  type: 'location',
  component: CustomLocationRenderer,
});
```

## Documentation

- [UI components](../../apps/docs/app/ui/page.mdx)
- [React integration](../../apps/docs/app/react/page.mdx)
- [Examples](../../apps/docs/app/examples/page.mdx)
