import type {
  ChatError,
  ChatEvent,
  ChatEventType,
  Conversation,
  Message,
  MessageContent,
  MessageMetadata,
  MessageStatus,
} from '@kaira/chat-core';
import type { DemoId } from '@/config/demo-registry';
import type { DemoAvailability } from '@/config/dit-demo';
import type {
  DemoActionId,
  DemoConversationBootstrap,
  DemoPollEventsResponse,
} from '@/lib/demo/contracts';

import { ChatEngine, createChatError, generateId } from '@kaira/chat-core';

import {
  getChatEventsAfterSequence,
  getLatestChatEventSequence,
  publishChatEvent,
  resetChatEventBroker,
  subscribeChatEvents,
} from '@/lib/chat/event-broker';
import {
  ensureDemoConversationCreated,
  getChatMessages,
  getServerChatEngineContext,
  notifyChatTyping,
  sendChatMessage,
  stopChatTyping,
} from '@/lib/chat/server-chat-engine';
import { getChatDemoAvailability, getChatDemoConfig } from '@/lib/chat/server-config';

import { LocalServerTransport } from './local-server-transport';

type LocalDemoId = Exclude<DemoId, 'dit-modive'>;

type DemoTransportEvent = DemoPollEventsResponse['data'][number];

export interface DemoRuntimeRequestContext {
  readonly sessionId?: string;
}

interface DemoServerRuntime {
  readonly demoId: DemoId;
  isAvailable(): DemoAvailability;
  getNamespace(requestContext?: DemoRuntimeRequestContext): string;
  ensureConversation(
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<DemoConversationBootstrap>;
  listConversations(
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<ReadonlyArray<Conversation>>;
  getMessages(
    conversationId: string,
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<ReadonlyArray<Message>>;
  sendMessage(
    conversationId: string,
    text: string,
    metadata?: MessageMetadata,
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<Message>;
  sendTyping(
    action: 'start' | 'stop',
    conversationId: string,
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<void>;
  getEngine(requestContext?: DemoRuntimeRequestContext): Promise<ChatEngine>;
}

interface LocalRuntimeContext {
  readonly engine: ChatEngine;
  readonly transport: LocalServerTransport;
  readonly user: {
    readonly id: string;
    readonly role: 'user';
    readonly displayName: string;
  };
  readonly assistant: {
    readonly id: string;
    readonly role: 'assistant';
    readonly displayName: string;
  };
  defaultConversationId?: string;
  readonly conversations: Map<string, Conversation>;
  seeded: boolean;
}

interface SessionScopedLocalRuntimeContext {
  readonly contextPromise: Promise<LocalRuntimeContext>;
  lastAccessedAt: number;
}

type NextBackendActionId = Extract<DemoActionId, `next-backend:${string}`>;
type StreamingActionId = Extract<DemoActionId, `streaming:${string}`>;
type MediaActionId = Extract<DemoActionId, `media:${string}`>;

const MEDIA_ACTION_KEYWORDS: ReadonlyArray<readonly [MediaActionId, ReadonlyArray<string>]> = [
  ['media:image', ['image', 'photo', 'picture']],
  ['media:audio', ['audio', 'sound']],
  ['media:video', ['video', 'clip']],
  ['media:file', ['file', 'document', 'attachment']],
  ['media:location', ['location', 'map', 'where']],
  ['media:fallback', ['fallback', 'custom', 'unsupported']],
] as const;

const LOCAL_DEMO_SESSION_TTL_MS = 30 * 60 * 1000;

function isLocalDemoId(demoId: DemoId): demoId is LocalDemoId {
  return demoId !== 'dit-modive';
}

function normalizeSessionId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function requiresDemoRuntimeSession(demoId: DemoId): boolean {
  return isLocalDemoId(demoId);
}

export function createDemoRuntimeRequestContext(
  demoId: DemoId,
  sessionIdValue: string | null,
): DemoRuntimeRequestContext {
  const sessionId = normalizeSessionId(sessionIdValue ?? undefined);
  if (!requiresDemoRuntimeSession(demoId)) {
    return {};
  }

  if (!sessionId) {
    throw new Error(`Missing sessionId for demo ${demoId}.`);
  }

  return { sessionId };
}

function chunkText(content: string, chunkSize: number): ReadonlyArray<string> {
  const chunks: string[] = [];
  for (let index = 0; index < content.length; index += chunkSize) {
    chunks.push(content.slice(index, index + chunkSize));
  }
  return chunks;
}

async function sleep(durationMs: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function buildMessage(
  conversationId: string,
  sender: Conversation['participants'][number],
  content: MessageContent,
  timestamp: number,
): Message {
  const status: MessageStatus = 'sent';
  const baseMessage = {
    id: generateId(),
    conversationId,
    sender,
    timestamp,
    status,
    ...(content.metadata ? { metadata: content.metadata } : {}),
  };

  switch (content.type) {
    case 'text':
      return {
        ...baseMessage,
        type: 'text',
        content: content.content,
      };
    case 'image':
      return {
        ...baseMessage,
        type: 'image',
        url: content.url,
        ...(content.alt ? { alt: content.alt } : {}),
        ...(content.dimensions ? { dimensions: content.dimensions } : {}),
      };
    case 'audio':
      return {
        ...baseMessage,
        type: 'audio',
        url: content.url,
        ...(content.mimeType ? { mimeType: content.mimeType } : {}),
        ...(content.title ? { title: content.title } : {}),
        ...(content.durationSeconds ? { durationSeconds: content.durationSeconds } : {}),
        ...(content.size ? { size: content.size } : {}),
      };
    case 'video':
      return {
        ...baseMessage,
        type: 'video',
        url: content.url,
        ...(content.mimeType ? { mimeType: content.mimeType } : {}),
        ...(content.title ? { title: content.title } : {}),
        ...(content.posterUrl ? { posterUrl: content.posterUrl } : {}),
        ...(content.dimensions ? { dimensions: content.dimensions } : {}),
        ...(content.durationSeconds ? { durationSeconds: content.durationSeconds } : {}),
        ...(content.size ? { size: content.size } : {}),
      };
    case 'file':
      return {
        ...baseMessage,
        type: 'file',
        url: content.url,
        name: content.name,
        mimeType: content.mimeType,
        size: content.size,
      };
    case 'location':
      return {
        ...baseMessage,
        type: 'location',
        latitude: content.latitude,
        longitude: content.longitude,
        ...(content.label ? { label: content.label } : {}),
        ...(content.address ? { address: content.address } : {}),
        ...(content.url ? { url: content.url } : {}),
      };
    case 'system':
      return {
        ...baseMessage,
        type: 'system',
        eventKind: content.eventKind,
        content: content.content,
      };
    case 'ai':
      return {
        ...baseMessage,
        type: 'ai',
        content: content.content,
        streamState: 'complete',
        ...(content.aiMetadata ? { aiMetadata: content.aiMetadata } : {}),
      };
    case 'custom':
      return {
        ...baseMessage,
        type: 'custom',
        customType: content.customType,
        payload: content.payload,
      };
  }
}

async function createConversation(
  context: LocalRuntimeContext,
  metadata?: Record<string, unknown>,
): Promise<Conversation> {
  const conversation = await context.engine.createConversation({
    type: 'direct',
    participants: [context.user, context.assistant],
    ...(metadata ? { metadata } : {}),
  });
  context.conversations.set(conversation.id, conversation);
  if (!context.defaultConversationId) {
    context.defaultConversationId = conversation.id;
  }

  return conversation;
}

async function emitRemoteMessage(
  context: LocalRuntimeContext,
  conversationId: string,
  content: MessageContent,
): Promise<Message> {
  const message = buildMessage(conversationId, context.assistant, content, Date.now());
  context.transport.emitInbound({
    type: 'message',
    payload: message,
    timestamp: message.timestamp,
  });

  return message;
}

function emitInboundFinalMessage(context: LocalRuntimeContext, message: Message): void {
  context.transport.emitInbound({
    type: 'message',
    payload: message,
    timestamp: message.timestamp,
  });
}

async function emitRemoteTyping(
  context: LocalRuntimeContext,
  conversationId: string,
  action: 'start' | 'stop',
): Promise<void> {
  context.transport.emitInbound({
    type: 'typing',
    payload: {
      action,
      conversationId,
      participant: context.assistant,
    },
    timestamp: Date.now(),
  });
}

async function emitStreamedAssistantMessage(
  context: LocalRuntimeContext,
  conversationId: string,
  finalContent: string,
  options?: {
    readonly chunkDelayMs?: number;
    readonly chunkSize?: number;
    readonly failAfterChunks?: number;
  },
): Promise<void> {
  const messageId = generateId();
  const chunkDelayMs = options?.chunkDelayMs ?? 150;
  const chunks = chunkText(finalContent, options?.chunkSize ?? 18);

  await emitRemoteTyping(context, conversationId, 'start');
  await sleep(350);
  await emitRemoteTyping(context, conversationId, 'stop');

  context.engine.emitStreamStart(messageId, conversationId);

  let accumulated = '';
  for (const [index, chunk] of chunks.entries()) {
    accumulated += chunk;
    context.engine.emitStreamChunk(messageId, chunk, accumulated);
    await sleep(chunkDelayMs);

    if (options?.failAfterChunks !== undefined && index + 1 >= options.failAfterChunks) {
      const streamError: ChatError = createChatError(
        'transport',
        'Simulated stream failure from the local demo backend.',
      );
      context.engine.emitStreamError(messageId, conversationId, streamError);
      await emitRemoteMessage(context, conversationId, {
        type: 'system',
        eventKind: 'custom',
        content:
          'The assistant stream failed intentionally for this demo. Change the prompt and try again.',
      });
      return;
    }
  }

  const finalMessage: Message & { readonly type: 'ai' } = {
    id: messageId,
    conversationId,
    sender: context.assistant,
    timestamp: Date.now(),
    status: 'sent',
    type: 'ai',
    content: finalContent,
    streamState: 'complete',
    aiMetadata: {
      model: 'local-demo-engine',
      provider: 'next-route-handler',
      finishReason: 'stop',
    },
  };

  await context.engine.emitStreamEnd(finalMessage);
  emitInboundFinalMessage(context, finalMessage);
}

function isDemoActionId(value: unknown): value is DemoActionId {
  return (
    value === 'next-backend:transport' ||
    value === 'next-backend:persistence' ||
    value === 'next-backend:checklist' ||
    value === 'streaming:normal' ||
    value === 'streaming:long' ||
    value === 'streaming:error' ||
    value === 'media:image' ||
    value === 'media:audio' ||
    value === 'media:video' ||
    value === 'media:file' ||
    value === 'media:location' ||
    value === 'media:fallback'
  );
}

function getDemoActionFromMetadata(metadata?: MessageMetadata): DemoActionId | null {
  const demoAction = metadata?.['demoAction'];
  return isDemoActionId(demoAction) ? demoAction : null;
}

function isNextBackendActionId(value: DemoActionId | null): value is NextBackendActionId {
  return (
    value === 'next-backend:transport' ||
    value === 'next-backend:persistence' ||
    value === 'next-backend:checklist'
  );
}

function isStreamingActionId(value: DemoActionId | null): value is StreamingActionId {
  return value === 'streaming:normal' || value === 'streaming:long' || value === 'streaming:error';
}

function isMediaActionId(value: DemoActionId | null): value is MediaActionId {
  return (
    value === 'media:image' ||
    value === 'media:audio' ||
    value === 'media:video' ||
    value === 'media:file' ||
    value === 'media:location' ||
    value === 'media:fallback'
  );
}

function findMediaActionFromPrompt(prompt: string): MediaActionId | null {
  const normalizedPrompt = prompt.trim().toLowerCase();

  const keywordMatch = MEDIA_ACTION_KEYWORDS.find(([, keywords]) =>
    keywords.some((keyword) => normalizedPrompt.includes(keyword)),
  );

  return keywordMatch?.[0] ?? null;
}

export function resolveLocalDemoAction(
  demoId: Extract<LocalDemoId, 'next-backend' | 'streaming' | 'media'>,
  prompt: string,
  metadata?: MessageMetadata,
): DemoActionId | null {
  const actionFromMetadata = getDemoActionFromMetadata(metadata);

  if (demoId === 'next-backend') {
    if (isNextBackendActionId(actionFromMetadata)) {
      return actionFromMetadata;
    }

    const normalizedPrompt = prompt.trim().toLowerCase();
    if (normalizedPrompt.includes('persist')) {
      return 'next-backend:persistence';
    }

    if (normalizedPrompt.includes('checklist') || normalizedPrompt.includes('qa')) {
      return 'next-backend:checklist';
    }

    return null;
  }

  if (demoId === 'streaming') {
    if (isStreamingActionId(actionFromMetadata)) {
      return actionFromMetadata;
    }

    const normalizedPrompt = prompt.trim().toLowerCase();
    if (normalizedPrompt.includes('error') || normalizedPrompt.includes('fail')) {
      return 'streaming:error';
    }

    if (normalizedPrompt.includes('long')) {
      return 'streaming:long';
    }

    return 'streaming:normal';
  }

  if (isMediaActionId(actionFromMetadata)) {
    return actionFromMetadata;
  }

  return findMediaActionFromPrompt(prompt);
}

function getNextBackendStreamContent(actionId: NextBackendActionId | null, prompt: string): string {
  if (actionId === 'next-backend:persistence') {
    return 'The local backend demo persists conversation history in IndexedDB, rehydrates it on reconnect, and keeps the browser runtime aligned through polling-based message sync.';
  }

  if (actionId === 'next-backend:checklist') {
    return 'Verification checklist: send a prompt, confirm assistant typing, confirm chunk preview if SSE is available, confirm the final AI message lands in history, then reload and verify IndexedDB restores the conversation.';
  }

  if (actionId === 'next-backend:transport') {
    return 'The browser posts to the Next.js route handlers, the server-owned ChatEngine emits assistant typing and stream lifecycle events, and polling still delivers the final AI message even if the SSE preview channel is unavailable.';
  }

  return `Local Next.js backend received: "${prompt}". The server owns the ChatEngine, emits assistant typing, and now also completes the final AI message over the normal message transport path.`;
}

function getWebSocketDemoReply(prompt: string): string {
  const normalizedPrompt = prompt.trim().toLowerCase();

  if (
    normalizedPrompt.includes('reconnect') ||
    normalizedPrompt.includes('disconnect') ||
    normalizedPrompt.includes('retry')
  ) {
    return 'Use the helper panel to drop the active socket. The browser transport should switch to reconnecting, reconnect automatically, and continue receiving typing plus final assistant messages over the same local WebSocket bridge.';
  }

  if (normalizedPrompt.includes('typing')) {
    return 'Typing updates in this demo are transport events too. The assistant typing indicator is emitted by the server-owned ChatEngine and delivered over the WebSocket connection before the final assistant message arrives.';
  }

  if (normalizedPrompt.includes('transport') || normalizedPrompt.includes('socket')) {
    return 'This demo bootstraps the conversation over the existing HTTP route handlers, then keeps message and typing traffic on the demo-only WebSocket bridge so you can verify connect, send, receive, and reconnect behavior without touching the polling-first demos.';
  }

  return `The local WebSocket demo received: "${prompt}". Messages and typing stay on the socket after the initial HTTP bootstrap, while the server-owned ChatEngine still manages the actual conversation state.`;
}

export function buildMediaDemoContent(actionId: MediaActionId): MessageContent {
  switch (actionId) {
    case 'media:image':
      return {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1511300636408-a63a89df3482?auto=format&fit=crop&w=1200&q=80',
        alt: 'City skyline',
        dimensions: {
          width: 1200,
          height: 800,
        },
      };
    case 'media:audio':
      return {
        type: 'audio',
        url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
        mimeType: 'audio/mpeg',
        title: 'Assistant audio sample',
        durationSeconds: 4,
      };
    case 'media:video':
      return {
        type: 'video',
        url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        mimeType: 'video/mp4',
        title: 'Assistant video sample',
        durationSeconds: 6,
        posterUrl:
          'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
      };
    case 'media:file':
      return {
        type: 'file',
        url: '/next.svg',
        name: 'sdk-architecture.svg',
        mimeType: 'image/svg+xml',
        size: 3800,
      };
    case 'media:location':
      return {
        type: 'location',
        latitude: 10.776889,
        longitude: 106.700806,
        label: 'Ho Chi Minh City',
        address: 'District 1, Ho Chi Minh City, Vietnam',
        url: 'https://maps.google.com/?q=10.776889,106.700806',
      };
    case 'media:fallback':
      return {
        type: 'custom',
        customType: 'workflow-audit',
        payload: {
          stage: 'renderer-fallback',
          origin: 'quick-action',
        },
      };
  }
}

class DitDemoRuntime implements DemoServerRuntime {
  readonly demoId = 'dit-modive' as const;

  isAvailable(): DemoAvailability {
    return getChatDemoAvailability();
  }

  getNamespace(requestContext?: DemoRuntimeRequestContext): string {
    void requestContext;
    return this.demoId;
  }

  async ensureConversation(
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<DemoConversationBootstrap> {
    void requestContext;
    await ensureDemoConversationCreated();
    const config = getChatDemoConfig();

    return {
      demoId: this.demoId,
      conversationId: config.chatroomId,
      conversation: {
        id: config.chatroomId,
        type: 'direct',
        participants: [
          { id: config.senderId, role: 'user', displayName: config.appContext.username },
          {
            id: config.chatbotNickname,
            role: 'assistant',
            displayName: config.chatbotNickname,
          },
        ],
        metadata: {
          provider: 'dit',
        },
        createdAt: 0,
        updatedAt: 0,
      },
    };
  }

  async listConversations(
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<ReadonlyArray<Conversation>> {
    const bootstrap = await this.ensureConversation(requestContext);
    return [bootstrap.conversation];
  }

  async getMessages(
    conversationId: string,
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<ReadonlyArray<Message>> {
    void requestContext;
    return getChatMessages(conversationId);
  }

  async sendMessage(
    conversationId: string,
    text: string,
    metadata?: MessageMetadata,
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<Message> {
    void requestContext;
    return sendChatMessage(conversationId, text, metadata);
  }

  async sendTyping(
    action: 'start' | 'stop',
    conversationId: string,
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<void> {
    void requestContext;
    if (action === 'start') {
      await notifyChatTyping(conversationId);
      return;
    }

    await stopChatTyping(conversationId);
  }

  async getEngine(requestContext?: DemoRuntimeRequestContext): Promise<ChatEngine> {
    void requestContext;
    const { engine } = await getServerChatEngineContext();
    return engine;
  }
}

class LocalDemoRuntime implements DemoServerRuntime {
  readonly demoId: LocalDemoId;

  private readonly contextsBySessionId = new Map<string, SessionScopedLocalRuntimeContext>();

  constructor(demoId: LocalDemoId) {
    this.demoId = demoId;
  }

  isAvailable(): DemoAvailability {
    return {
      available: true,
      missingEnv: [],
    };
  }

  getNamespace(requestContext?: DemoRuntimeRequestContext): string {
    return `${this.demoId}:${this.requireSessionId(requestContext)}`;
  }

  async ensureConversation(
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<DemoConversationBootstrap> {
    const context = await this.getContext(requestContext);
    await this.ensureSeeded(context);
    const conversation = context.conversations.get(context.defaultConversationId ?? '');
    if (!conversation) {
      throw new Error(`Demo ${this.demoId} did not create a default conversation.`);
    }

    return {
      demoId: this.demoId,
      conversationId: conversation.id,
      conversation,
    };
  }

  async listConversations(
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<ReadonlyArray<Conversation>> {
    const context = await this.getContext(requestContext);
    await this.ensureSeeded(context);
    return [...context.conversations.values()];
  }

  async getMessages(
    conversationId: string,
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<ReadonlyArray<Message>> {
    const context = await this.getContext(requestContext);
    const result = await context.engine.getMessages({
      conversationId,
      direction: 'asc',
      limit: 200,
    });

    return result.items;
  }

  async sendMessage(
    conversationId: string,
    text: string,
    metadata?: MessageMetadata,
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<Message> {
    const context = await this.getContext(requestContext);
    await this.ensureSeeded(context);

    const message = await context.engine.sendMessage(conversationId, {
      type: 'text',
      content: text,
      ...(metadata ? { metadata } : {}),
    });

    void this.handleAssistantResponse(context, conversationId, text, metadata);

    return message;
  }

  async sendTyping(
    action: 'start' | 'stop',
    conversationId: string,
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<void> {
    const context = await this.getContext(requestContext);
    await this.ensureSeeded(context);

    if (action === 'start') {
      context.engine.notifyTyping(conversationId);
      return;
    }

    context.engine.stopTyping(conversationId);
  }

  async getEngine(requestContext?: DemoRuntimeRequestContext): Promise<ChatEngine> {
    const context = await this.getContext(requestContext);
    return context.engine;
  }

  private async getContext(
    requestContext?: DemoRuntimeRequestContext,
  ): Promise<LocalRuntimeContext> {
    const sessionId = this.requireSessionId(requestContext);
    const now = Date.now();

    this.cleanupStaleContexts(now);

    const existingContext = this.contextsBySessionId.get(sessionId);
    if (existingContext) {
      existingContext.lastAccessedAt = now;
      return existingContext.contextPromise;
    }

    const contextPromise = this.buildContext(sessionId);
    const contextEntry: SessionScopedLocalRuntimeContext = {
      contextPromise,
      lastAccessedAt: now,
    };
    this.contextsBySessionId.set(sessionId, contextEntry);

    void contextPromise.catch(() => {
      const currentEntry = this.contextsBySessionId.get(sessionId);
      if (currentEntry === contextEntry) {
        this.contextsBySessionId.delete(sessionId);
      }
    });

    return contextPromise;
  }

  private async buildContext(sessionId: string): Promise<LocalRuntimeContext> {
    const namespace = this.getSessionNamespace(sessionId);
    const transport = new LocalServerTransport();
    const context: LocalRuntimeContext = {
      engine: new ChatEngine({
        transport,
        sender: {
          id: `${this.demoId}:user`,
          role: 'user',
          displayName: 'SDK Explorer',
        },
      }),
      transport,
      user: {
        id: `${this.demoId}:user`,
        role: 'user',
        displayName: 'SDK Explorer',
      },
      assistant: {
        id: `${this.demoId}:assistant`,
        role: 'assistant',
        displayName: 'Kaira Assistant',
      },
      conversations: new Map<string, Conversation>(),
      seeded: false,
    };

    await context.engine.connect();

    const forwardEvent = <TEvent extends ChatEventType>(eventName: TEvent): void => {
      context.engine.on(eventName, (event) => {
        publishChatEvent(namespace, event);
      });
    };

    forwardEvent('message:received');
    forwardEvent('message:stream:start');
    forwardEvent('message:stream:chunk');
    forwardEvent('message:stream:end');
    forwardEvent('message:stream:error');
    forwardEvent('typing:start');
    forwardEvent('typing:stop');
    forwardEvent('connection:state');

    return context;
  }

  private cleanupStaleContexts(now: number): void {
    for (const [sessionId, contextEntry] of this.contextsBySessionId) {
      if (now - contextEntry.lastAccessedAt < LOCAL_DEMO_SESSION_TTL_MS) {
        continue;
      }

      this.contextsBySessionId.delete(sessionId);
      resetChatEventBroker(this.getSessionNamespace(sessionId));
      void contextEntry.contextPromise
        .then(async (context) => {
          await context.engine.disconnect();
        })
        .catch(() => undefined);
    }
  }

  private getSessionNamespace(sessionId: string): string {
    return `${this.demoId}:${sessionId}`;
  }

  private requireSessionId(requestContext?: DemoRuntimeRequestContext): string {
    const sessionId = normalizeSessionId(requestContext?.sessionId);
    if (!sessionId) {
      throw new Error(`Missing sessionId for demo ${this.demoId}.`);
    }

    return sessionId;
  }

  private async ensureSeeded(context: LocalRuntimeContext): Promise<void> {
    if (context.seeded) {
      return;
    }

    if (this.demoId === 'persistence') {
      const onboarding = await createConversation(context, { title: 'Onboarding Flow' });
      const assets = await createConversation(context, { title: 'Asset Review' });
      const incidents = await createConversation(context, { title: 'Incidents' });

      await emitRemoteMessage(context, onboarding.id, {
        type: 'text',
        content: 'Welcome to the persistence demo. Reload the page after sending a few messages.',
      });
      await emitRemoteMessage(context, assets.id, {
        type: 'file',
        url: '/next.svg',
        name: 'next-logo.svg',
        mimeType: 'image/svg+xml',
        size: 3800,
      });
      await emitRemoteMessage(context, incidents.id, {
        type: 'system',
        eventKind: 'custom',
        content: 'Incident review thread created for retry-state verification.',
      });
    } else {
      const conversation = await createConversation(context, { title: this.demoId });

      if (this.demoId === 'media') {
        await emitRemoteMessage(context, conversation.id, {
          type: 'text',
          content: 'This conversation is pre-seeded to exercise the built-in renderer registry.',
        });
        await emitRemoteMessage(context, conversation.id, {
          type: 'image',
          url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
          alt: 'Mountain lake',
          dimensions: {
            width: 1200,
            height: 800,
          },
        });
        await emitRemoteMessage(context, conversation.id, {
          type: 'audio',
          url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
          mimeType: 'audio/mpeg',
          title: 'Sample audio',
          durationSeconds: 4,
        });
        await emitRemoteMessage(context, conversation.id, {
          type: 'video',
          url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
          mimeType: 'video/mp4',
          title: 'Sample video',
          durationSeconds: 6,
          posterUrl:
            'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=80',
        });
        await emitRemoteMessage(context, conversation.id, {
          type: 'file',
          url: '/file-text.svg',
          name: 'roadmap-export.svg',
          mimeType: 'image/svg+xml',
          size: 2210,
        });
        await emitRemoteMessage(context, conversation.id, {
          type: 'location',
          latitude: 10.776889,
          longitude: 106.700806,
          label: 'Ho Chi Minh City',
          address: 'District 1, Ho Chi Minh City, Vietnam',
          url: 'https://maps.google.com/?q=10.776889,106.700806',
        });
        await emitRemoteMessage(context, conversation.id, {
          type: 'custom',
          customType: 'workflow-audit',
          payload: {
            stage: 'renderer-fallback',
          },
        });
      } else if (this.demoId === 'streaming') {
        await emitRemoteMessage(context, conversation.id, {
          type: 'system',
          eventKind: 'custom',
          content:
            'Use the quick actions or send “normal”, “long”, or “error” to trigger different stream lifecycle paths.',
        });
      } else if (this.demoId === 'websocket') {
        await emitRemoteMessage(context, conversation.id, {
          type: 'system',
          eventKind: 'custom',
          content:
            'This demo bootstraps over the existing HTTP routes, then moves message and typing traffic onto a local WebSocket bridge so reconnect behavior is easy to verify.',
        });
      } else {
        await emitRemoteMessage(context, conversation.id, {
          type: 'text',
          content:
            'This local backend runs entirely inside apps/web using route handlers, a server-owned ChatEngine, and deterministic assistant orchestration.',
        });
      }
    }

    context.seeded = true;
  }

  private async handleAssistantResponse(
    context: LocalRuntimeContext,
    conversationId: string,
    prompt: string,
    metadata?: MessageMetadata,
  ): Promise<void> {
    try {
      if (this.demoId === 'media') {
        const actionId = resolveLocalDemoAction('media', prompt, metadata);
        if (isMediaActionId(actionId)) {
          await emitRemoteMessage(context, conversationId, buildMediaDemoContent(actionId));
          return;
        }

        await emitRemoteMessage(context, conversationId, {
          type: 'text',
          content:
            'Use the media quick actions to request an exact renderer type, or mention image, audio, video, file, location, or fallback in your message.',
        });
        return;
      }

      if (this.demoId === 'streaming') {
        const actionId = resolveLocalDemoAction('streaming', prompt, metadata);
        if (actionId === 'streaming:error') {
          await emitStreamedAssistantMessage(
            context,
            conversationId,
            'This response intentionally fails mid-stream to validate error handling.',
            { failAfterChunks: 3, chunkDelayMs: 140 },
          );
          return;
        }

        if (actionId === 'streaming:long') {
          await emitStreamedAssistantMessage(
            context,
            conversationId,
            'This longer stream sends more chunks so the streaming preview remains visible long enough to inspect in devtools and the UI.',
            { chunkDelayMs: 180, chunkSize: 10 },
          );
          return;
        }

        await emitStreamedAssistantMessage(
          context,
          conversationId,
          'This is the standard streaming path: the assistant types, streams a short preview, and then the final AI message lands in the normal conversation history.',
          { chunkDelayMs: 140, chunkSize: 16 },
        );
        return;
      }

      if (this.demoId === 'next-backend') {
        const resolvedActionId = resolveLocalDemoAction('next-backend', prompt, metadata);
        const actionId = isNextBackendActionId(resolvedActionId) ? resolvedActionId : null;
        await emitStreamedAssistantMessage(
          context,
          conversationId,
          getNextBackendStreamContent(actionId, prompt),
        );
        return;
      }

      if (this.demoId === 'websocket') {
        await emitRemoteTyping(context, conversationId, 'start');
        await sleep(250);
        await emitRemoteTyping(context, conversationId, 'stop');
        await emitRemoteMessage(context, conversationId, {
          type: 'text',
          content: getWebSocketDemoReply(prompt),
        });
        return;
      }

      await emitRemoteMessage(context, conversationId, {
        type: 'text',
        content: `Acknowledged: ${prompt}`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The local demo backend failed unexpectedly.';
      await emitRemoteMessage(context, conversationId, {
        type: 'system',
        eventKind: 'custom',
        content: message,
      });
    }
  }
}

const DEMO_RUNTIMES: Record<DemoId, DemoServerRuntime> = {
  'dit-modive': new DitDemoRuntime(),
  'next-backend': new LocalDemoRuntime('next-backend'),
  streaming: new LocalDemoRuntime('streaming'),
  media: new LocalDemoRuntime('media'),
  persistence: new LocalDemoRuntime('persistence'),
  websocket: new LocalDemoRuntime('websocket'),
};

export function getDemoRuntime(demoId: DemoId): DemoServerRuntime {
  return DEMO_RUNTIMES[demoId];
}

export function isDemoId(value: string): value is DemoId {
  return value in DEMO_RUNTIMES;
}

function parseSequence(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

function toTypingTransportEvent(
  participantState: ReturnType<ChatEngine['getTypingState']>['participants'][number],
): DemoTransportEvent {
  return {
    type: 'typing',
    payload: {
      action: 'start',
      conversationId: participantState.conversationId,
      participant: participantState.participant,
    },
    timestamp: participantState.lastUpdatedAt,
  };
}

function isMessageReceivedEvent(event: ChatEvent): event is ChatEvent<'message:received'> {
  return event.type === 'message:received';
}

function isTypingStartEvent(event: ChatEvent): event is ChatEvent<'typing:start'> {
  return event.type === 'typing:start';
}

function isTypingStopEvent(event: ChatEvent): event is ChatEvent<'typing:stop'> {
  return event.type === 'typing:stop';
}

export async function getDemoPollingResponse(
  demoId: DemoId,
  conversationId: string,
  cursorValue: string | null,
  requestContext?: DemoRuntimeRequestContext,
): Promise<DemoPollEventsResponse> {
  const runtime = getDemoRuntime(demoId);
  const namespace = runtime.getNamespace(requestContext);

  const cursor = parseSequence(cursorValue);
  const engine = await runtime.getEngine(requestContext);

  if (cursor === undefined) {
    const latestSequence = getLatestChatEventSequence(namespace);
    const messages = await runtime.getMessages(conversationId, requestContext);
    const typingEvents = engine
      .getTypingState(conversationId)
      .participants.map((participantState) => toTypingTransportEvent(participantState));

    return {
      success: true,
      data: [
        ...messages.map(
          (message): DemoTransportEvent => ({
            type: 'message',
            payload: message,
            timestamp: message.timestamp,
          }),
        ),
        ...typingEvents,
      ],
      nextCursor: String(latestSequence ?? 0),
    };
  }

  const sequencedEvents = getChatEventsAfterSequence(namespace, cursor, conversationId);
  const data = sequencedEvents
    .map((entry) => toDemoTransportEvent(entry.event))
    .filter((event): event is DemoTransportEvent => event !== null);

  return {
    success: true,
    data,
    nextCursor: String(sequencedEvents.at(-1)?.sequence ?? cursor),
  };
}

export async function createDemoSseResponse(
  request: Request,
  demoId: DemoId,
  conversationId: string,
  requestContext?: DemoRuntimeRequestContext,
): Promise<Response> {
  const runtime = getDemoRuntime(demoId);
  const namespace = runtime.getNamespace(requestContext);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false;

      const write = (eventName: string, payload: unknown): void => {
        controller.enqueue(encoder.encode(`event: ${eventName}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const unsubscribe = subscribeChatEvents(namespace, (entry) => {
        const eventConversationId = getEventConversationId(entry.event);

        if (eventConversationId !== conversationId) {
          return;
        }

        write(entry.event.type, entry.event);
      });

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(': keepalive\n\n'));
      }, 15000);

      const cleanup = (): void => {
        if (isClosed) {
          return;
        }

        isClosed = true;
        clearInterval(keepAlive);
        unsubscribe();
        request.signal.removeEventListener('abort', cleanup);
        controller.close();
      };

      write('connected', { ok: true, demoId, conversationId });
      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

function getEventConversationId(event: ChatEvent): string | undefined {
  if ('conversationId' in event && typeof event.conversationId === 'string') {
    return event.conversationId;
  }

  if ('message' in event && typeof event.message.conversationId === 'string') {
    return event.message.conversationId;
  }

  return undefined;
}

export function toDemoTransportEvent(event: ChatEvent): DemoTransportEvent | null {
  if (isMessageReceivedEvent(event)) {
    return {
      type: 'message',
      payload: event.message,
      timestamp: event.timestamp,
    };
  }

  if (isTypingStartEvent(event)) {
    return {
      type: 'typing',
      payload: {
        action: 'start',
        conversationId: event.conversationId,
        participant: event.participant,
      },
      timestamp: event.timestamp,
    };
  }

  if (isTypingStopEvent(event)) {
    return {
      type: 'typing',
      payload: {
        action: 'stop',
        conversationId: event.conversationId,
        participant: event.participant,
      },
      timestamp: event.timestamp,
    };
  }

  return null;
}
