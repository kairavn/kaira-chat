import type { ChatEvent, Message } from '@kaira/chat-core';
import type { DemoRuntimeRequestContext } from './runtime-registry';

import { describe, expect, it } from 'vitest';

import {
  buildMediaDemoContent,
  getDemoRuntime,
  resolveLocalDemoAction,
  toDemoTransportEvent,
} from './runtime-registry';

const sender = {
  id: 'user-1',
  role: 'user',
  displayName: 'User One',
} as const;

const baseMessage = {
  id: 'message-1',
  conversationId: 'conversation-1',
  sender,
  timestamp: 100,
  status: 'sent',
  type: 'text',
  content: 'hello',
} satisfies Message;

function createRequestContext(sessionId: string): DemoRuntimeRequestContext {
  return { sessionId };
}

async function waitForMessages(
  loadMessages: () => Promise<ReadonlyArray<Message>>,
  predicate: (messages: ReadonlyArray<Message>) => boolean,
): Promise<ReadonlyArray<Message>> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 4000) {
    const messages = await loadMessages();
    if (predicate(messages)) {
      return messages;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  }

  throw new Error('Timed out waiting for demo messages.');
}

describe('toDemoTransportEvent', () => {
  it('maps received messages into polling events', () => {
    const event = {
      type: 'message:received',
      timestamp: 100,
      message: baseMessage,
    } satisfies ChatEvent<'message:received'>;

    expect(toDemoTransportEvent(event)).toEqual({
      type: 'message',
      payload: baseMessage,
      timestamp: 100,
    });
  });

  it('does not expose server message:sent echoes to the browser runtime', () => {
    const event = {
      type: 'message:sent',
      timestamp: 100,
      message: baseMessage,
    } satisfies ChatEvent<'message:sent'>;

    expect(toDemoTransportEvent(event)).toBeNull();
  });
});

describe('resolveLocalDemoAction', () => {
  it('prefers explicit metadata over prompt fallback for streaming demos', () => {
    expect(
      resolveLocalDemoAction('streaming', 'run the normal stream scenario', {
        demoAction: 'streaming:error',
      }),
    ).toBe('streaming:error');
  });

  it('defaults freeform streaming prompts to the normal stream path', () => {
    expect(resolveLocalDemoAction('streaming', 'hello there')).toBe('streaming:normal');
  });

  it('maps media prompt keywords to the exact renderer action', () => {
    expect(resolveLocalDemoAction('media', 'Please show the video renderer')).toBe('media:video');
  });
});

describe('buildMediaDemoContent', () => {
  it('returns the exact media content type for each quick action', () => {
    expect(buildMediaDemoContent('media:image').type).toBe('image');
    expect(buildMediaDemoContent('media:audio').type).toBe('audio');
    expect(buildMediaDemoContent('media:video').type).toBe('video');
    expect(buildMediaDemoContent('media:file').type).toBe('file');
    expect(buildMediaDemoContent('media:location').type).toBe('location');
    expect(buildMediaDemoContent('media:fallback').type).toBe('custom');
  });
});

describe('local demo runtimes', () => {
  it('stores the final next-backend AI reply in normal message history', async () => {
    const runtime = getDemoRuntime('next-backend');
    const requestContext = createRequestContext(`next-backend-${crypto.randomUUID()}`);
    const bootstrap = await runtime.ensureConversation(requestContext);
    const beforeMessages = await runtime.getMessages(bootstrap.conversationId, requestContext);

    await runtime.sendMessage(
      bootstrap.conversationId,
      'Trace the local backend transport path.',
      {
        demoAction: 'next-backend:transport',
      },
      requestContext,
    );

    const messages = await waitForMessages(
      () => runtime.getMessages(bootstrap.conversationId, requestContext),
      (items) =>
        items.length > beforeMessages.length &&
        items.some(
          (message) =>
            message.type === 'ai' &&
            message.content.includes('The browser posts to the Next.js route handlers'),
        ),
    );

    expect(
      messages.some(
        (message) =>
          message.type === 'ai' &&
          message.content.includes('The browser posts to the Next.js route handlers'),
      ),
    ).toBe(true);
  });

  it('stores a terminal system message when the streaming demo fails', async () => {
    const runtime = getDemoRuntime('streaming');
    const requestContext = createRequestContext(`streaming-${crypto.randomUUID()}`);
    const bootstrap = await runtime.ensureConversation(requestContext);
    const beforeMessages = await runtime.getMessages(bootstrap.conversationId, requestContext);

    await runtime.sendMessage(
      bootstrap.conversationId,
      'Run the failing stream scenario.',
      {
        demoAction: 'streaming:error',
      },
      requestContext,
    );

    const messages = await waitForMessages(
      () => runtime.getMessages(bootstrap.conversationId, requestContext),
      (items) =>
        items.length > beforeMessages.length &&
        items.some(
          (message) =>
            message.type === 'system' &&
            message.content.includes('failed intentionally for this demo'),
        ),
    );

    expect(
      messages.some(
        (message) =>
          message.type === 'system' &&
          message.content.includes('failed intentionally for this demo'),
      ),
    ).toBe(true);
  });

  it('returns the exact requested media type for media quick actions', async () => {
    const runtime = getDemoRuntime('media');
    const requestContext = createRequestContext(`media-${crypto.randomUUID()}`);
    const bootstrap = await runtime.ensureConversation(requestContext);
    const beforeMessages = await runtime.getMessages(bootstrap.conversationId, requestContext);

    await runtime.sendMessage(
      bootstrap.conversationId,
      'Show an audio example.',
      {
        demoAction: 'media:audio',
      },
      requestContext,
    );

    const messages = await waitForMessages(
      () => runtime.getMessages(bootstrap.conversationId, requestContext),
      (items) =>
        items.length > beforeMessages.length &&
        items.some((message) => message.type === 'audio' && message.sender.role === 'assistant'),
    );

    expect(
      messages.some((message) => message.type === 'audio' && message.sender.role === 'assistant'),
    ).toBe(true);
  });

  it('isolates local demo state between different session ids', async () => {
    const runtime = getDemoRuntime('next-backend');
    const sessionA = createRequestContext(`next-backend-a-${crypto.randomUUID()}`);
    const sessionB = createRequestContext(`next-backend-b-${crypto.randomUUID()}`);

    const bootstrapA = await runtime.ensureConversation(sessionA);
    const bootstrapB = await runtime.ensureConversation(sessionB);
    const beforeMessagesB = await runtime.getMessages(bootstrapB.conversationId, sessionB);

    expect(bootstrapA.conversationId).not.toBe(bootstrapB.conversationId);

    await runtime.sendMessage(
      bootstrapA.conversationId,
      'Trace the local backend transport path.',
      {
        demoAction: 'next-backend:transport',
      },
      sessionA,
    );

    await waitForMessages(
      () => runtime.getMessages(bootstrapA.conversationId, sessionA),
      (items) =>
        items.some(
          (message) =>
            message.type === 'ai' &&
            message.content.includes('The browser posts to the Next.js route handlers'),
        ),
    );

    const messagesB = await runtime.getMessages(bootstrapB.conversationId, sessionB);
    expect(messagesB).toEqual(beforeMessagesB);
    expect(
      messagesB.some(
        (message) =>
          message.type === 'text' &&
          message.content.includes('Trace the local backend transport path.'),
      ),
    ).toBe(false);
    expect(
      messagesB.some(
        (message) =>
          message.type === 'ai' &&
          message.content.includes('The browser posts to the Next.js route handlers'),
      ),
    ).toBe(false);
  });
});
