'use client';

import type { Message, MessageMetadata } from '@kaira/chat-core';
import type { DemoQuickAction } from '@/lib/demo/contracts';
import type { JSX, ReactNode } from 'react';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { getMessageClientNonce, mergeMessageSets } from '@kaira/chat-core';
import {
  useChatEngine,
  useConnectionState,
  useMessages,
  useOptimisticMessages,
  useSendMessage,
  useStreamingMessage,
  useTypingController,
  useTypingParticipants,
} from '@kaira/chat-react';
import { MessageInput } from '@kaira/chat-ui';

import { useDemoRuntime, useDemoRuntimeReadiness } from '@/components/demo/DemoRuntimeProvider';
import { getRendererRegistry } from '@/lib/chat/renderers';

import { ChatErrorBanner } from './ChatErrorBanner';
import { ChatStatusBar } from './ChatStatusBar';
import { MessageList } from './MessageList';
import { ScrollContainer } from './ScrollContainer';

const AUTO_SCROLL_THRESHOLD_PX = 120;
const AI_THINKING_TIMEOUT_MS = 30_000;
const LOAD_OLDER_HISTORY_THRESHOLD_PX = 24;

export interface ChatSurfaceHistoryWindow {
  readonly initialVisibleCount: number;
  readonly incrementCount: number;
}

interface PendingHistoryRestore {
  readonly previousScrollHeight: number;
  readonly previousScrollTop: number;
}

interface VisibleMessageCountState {
  readonly conversationId: string;
  readonly initialVisibleMessageCount: number;
  readonly count: number;
}

interface LoadedHistoryMessagesState {
  readonly conversationId: string;
  readonly messages: ReadonlyArray<Message>;
  readonly hasMoreRemoteHistory: boolean;
}

interface ChatSurfaceProps {
  readonly title: string;
  readonly description: string;
  readonly conversationId: string;
  readonly quickActions?: ReadonlyArray<DemoQuickAction>;
  readonly helperPanel?: ReactNode;
  readonly historyWindow?: ChatSurfaceHistoryWindow;
}

function scopedVisibleMessageCount(
  conversationId: string,
  initialVisibleMessageCount: number,
  count: number,
): VisibleMessageCountState {
  return {
    conversationId,
    initialVisibleMessageCount,
    count,
  };
}

function getVisibleMessageCount(
  state: VisibleMessageCountState,
  conversationId: string,
  initialVisibleMessageCount: number,
): number {
  return state.conversationId === conversationId &&
    state.initialVisibleMessageCount === initialVisibleMessageCount
    ? state.count
    : initialVisibleMessageCount;
}

function createOptimisticTextMessage({
  conversationId,
  content,
  metadata,
  sender,
}: {
  readonly conversationId: string;
  readonly content: string;
  readonly metadata?: MessageMetadata;
  readonly sender: Message['sender'];
}): {
  readonly messageMetadata: MessageMetadata;
  readonly nonce: string;
  readonly optimisticMessage: Message;
} {
  const nonce = `nonce-${crypto.randomUUID()}`;
  const messageMetadata = {
    ...(metadata ?? {}),
    clientNonce: nonce,
  } satisfies MessageMetadata;

  return {
    messageMetadata,
    nonce,
    optimisticMessage: {
      id: `optimistic-${nonce}`,
      conversationId,
      sender,
      timestamp: Date.now(),
      status: 'pending',
      type: 'text',
      content,
      metadata: messageMetadata,
    },
  };
}

export function ChatSurface({
  title,
  description,
  conversationId,
  quickActions = [],
  helperPanel,
  historyWindow,
}: ChatSurfaceProps): JSX.Element {
  const engine = useChatEngine();
  const runtime = useDemoRuntime();
  const connectionState = useConnectionState();
  const runtimeReadiness = useDemoRuntimeReadiness();
  const messages = useMessages(conversationId);
  const sendMessage = useSendMessage();
  const { message: streamingPreview, isStreaming } = useStreamingMessage(conversationId);
  const { mergedMessages, addOptimisticMessage, removeOptimisticMessage, reconcileMessage } =
    useOptimisticMessages(messages);
  const typingParticipants = useTypingParticipants(conversationId);
  const { notifyTyping, stopTyping, isSupported } = useTypingController(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const activeOptimisticNoncesRef = useRef(new Set<string>());
  const pendingAssistantMessageIdsRef = useRef<Set<string> | null>(null);
  const pendingHistoryRestoreRef = useRef<PendingHistoryRestore | null>(null);
  const isLoadingOlderHistoryRef = useRef(false);
  const isSendingRef = useRef(false);
  const isRuntimeReady = runtimeReadiness.status === 'ready';
  const canSend = isRuntimeReady && connectionState !== 'disconnecting';
  const composerPlaceholder =
    runtimeReadiness.status === 'error'
      ? 'Demo runtime unavailable. Retry the connection above.'
      : runtimeReadiness.status === 'connecting'
        ? 'Connecting to the demo runtime...'
        : 'Type your message...';

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thinkingConversationId, setThinkingConversationId] = useState<string | null>(null);
  const [loadingOlderHistoryConversationId, setLoadingOlderHistoryConversationId] = useState<
    string | null
  >(null);
  const hasHistoryWindow = historyWindow !== undefined;
  const initialVisibleMessageCount = historyWindow?.initialVisibleCount ?? 0;
  const [visibleMessageCount, setVisibleMessageCount] = useState<VisibleMessageCountState>(() =>
    scopedVisibleMessageCount(
      conversationId,
      initialVisibleMessageCount,
      initialVisibleMessageCount,
    ),
  );
  const [loadedHistoryMessages, setLoadedHistoryMessages] = useState<LoadedHistoryMessagesState>(
    () => ({
      conversationId,
      messages: [],
      hasMoreRemoteHistory: true,
    }),
  );
  const currentVisibleMessageCount = getVisibleMessageCount(
    visibleMessageCount,
    conversationId,
    initialVisibleMessageCount,
  );
  const hasMoreRemoteHistory =
    loadedHistoryMessages.conversationId === conversationId
      ? loadedHistoryMessages.hasMoreRemoteHistory
      : true;
  const isLoadingOlderHistory = loadingOlderHistoryConversationId === conversationId;
  const isThinking = thinkingConversationId === conversationId;
  const allMessages = useMemo(
    () =>
      mergeMessageSets(
        mergedMessages,
        loadedHistoryMessages.conversationId === conversationId
          ? loadedHistoryMessages.messages
          : [],
      ),
    [conversationId, loadedHistoryMessages, mergedMessages],
  );
  const visibleMessages = historyWindow
    ? allMessages.slice(-Math.max(currentVisibleMessageCount, initialVisibleMessageCount))
    : allMessages;
  const hasHiddenHistory = historyWindow ? visibleMessages.length < allMessages.length : false;

  useEffect(() => {
    pendingHistoryRestoreRef.current = null;
    pendingAssistantMessageIdsRef.current = null;
    shouldAutoScrollRef.current = true;
    lastScrollTopRef.current = 0;
    isLoadingOlderHistoryRef.current = false;

    const animationFrame = requestAnimationFrame(() => setThinkingConversationId(null));

    return () => cancelAnimationFrame(animationFrame);
  }, [conversationId, hasHistoryWindow, initialVisibleMessageCount]);

  useEffect(() => {
    for (const message of messages) {
      const clientNonce = getMessageClientNonce(message);
      if (!clientNonce || !activeOptimisticNoncesRef.current.has(clientNonce)) {
        continue;
      }

      activeOptimisticNoncesRef.current.delete(clientNonce);
      reconcileMessage(message);
    }
  }, [messages, reconcileMessage]);

  useEffect(() => {
    if (!isStreaming || !isThinking) {
      return;
    }

    const animationFrame = requestAnimationFrame(() =>
      setThinkingConversationId((current) => (current === conversationId ? null : current)),
    );

    return () => cancelAnimationFrame(animationFrame);
  }, [conversationId, isStreaming, isThinking]);

  useEffect(() => {
    if (!isThinking) {
      return;
    }

    const pendingAssistantMessageIds = pendingAssistantMessageIdsRef.current;
    if (!pendingAssistantMessageIds) {
      return;
    }

    const assistantResponse = [...mergedMessages]
      .reverse()
      .find(
        (message) =>
          message.sender.role === 'assistant' && !pendingAssistantMessageIds.has(message.id),
      );

    if (!assistantResponse) {
      return;
    }

    pendingAssistantMessageIdsRef.current = null;
    requestAnimationFrame(() => {
      setThinkingConversationId((current) => (current === conversationId ? null : current));

      const container = scrollRef.current;
      if (!container) return;

      const selectorMessageId =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(assistantResponse.id)
          : assistantResponse.id.replaceAll('"', '\\"');
      const messageElement = container.querySelector<HTMLElement>(
        `[data-message-id="${selectorMessageId}"]`,
      );
      messageElement?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  }, [conversationId, isThinking, mergedMessages]);

  useEffect(() => {
    if (!isThinking) {
      return;
    }

    const timer = window.setTimeout(() => {
      pendingAssistantMessageIdsRef.current = null;
      setThinkingConversationId(null);
      setError('AI response timed out. Please try again.');
    }, AI_THINKING_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isThinking]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    const pendingRestore = pendingHistoryRestoreRef.current;
    if (!container || !pendingRestore) {
      return;
    }

    const scrollDelta = container.scrollHeight - pendingRestore.previousScrollHeight;
    const nextScrollTop = pendingRestore.previousScrollTop + scrollDelta;
    container.scrollTop = nextScrollTop;
    lastScrollTopRef.current = nextScrollTop;
    pendingHistoryRestoreRef.current = null;
  }, [visibleMessages.length]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    if (!shouldAutoScrollRef.current) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [visibleMessages, streamingPreview?.content, isThinking, typingParticipants]);

  async function loadOlderHistoryPage(): Promise<void> {
    if (!historyWindow || !hasMoreRemoteHistory || isLoadingOlderHistoryRef.current) {
      pendingHistoryRestoreRef.current = null;
      return;
    }

    const oldestVisibleMessage = visibleMessages[0];
    if (!oldestVisibleMessage) {
      pendingHistoryRestoreRef.current = null;
      return;
    }

    isLoadingOlderHistoryRef.current = true;
    setLoadingOlderHistoryConversationId(conversationId);
    try {
      const page = await runtime.loadMessagesPage(conversationId, {
        direction: 'before',
        cursor: oldestVisibleMessage.id,
        limit: historyWindow.incrementCount,
      });

      if (page.items.length === 0) {
        pendingHistoryRestoreRef.current = null;
        setLoadedHistoryMessages((current) => ({
          conversationId,
          messages: current.conversationId === conversationId ? current.messages : [],
          hasMoreRemoteHistory: page.hasMore,
        }));
        return;
      }

      setLoadedHistoryMessages((current) => ({
        conversationId,
        messages: mergeMessageSets(
          current.conversationId === conversationId ? current.messages : [],
          page.items,
        ),
        hasMoreRemoteHistory: page.hasMore,
      }));
      setVisibleMessageCount((current) =>
        scopedVisibleMessageCount(
          conversationId,
          initialVisibleMessageCount,
          getVisibleMessageCount(current, conversationId, initialVisibleMessageCount) +
            page.items.length,
        ),
      );
    } catch (historyError) {
      pendingHistoryRestoreRef.current = null;
      setError(
        historyError instanceof Error
          ? historyError.message
          : 'Failed to load older message history.',
      );
    } finally {
      isLoadingOlderHistoryRef.current = false;
      setLoadingOlderHistoryConversationId((current) =>
        current === conversationId ? null : current,
      );
    }
  }

  async function sendUserMessage(text: string, metadata?: MessageMetadata): Promise<void> {
    if (isSendingRef.current) {
      return;
    }

    if (!canSend) {
      setError('The demo is still connecting. Wait for the status bar to show Ready.');
      return;
    }

    const content = text.trim();
    if (!content) {
      return;
    }

    const currentParticipant = engine.getCurrentParticipant();
    const { messageMetadata, nonce, optimisticMessage } = createOptimisticTextMessage({
      conversationId,
      sender: currentParticipant,
      content,
      metadata,
    });

    addOptimisticMessage(optimisticMessage, nonce);
    activeOptimisticNoncesRef.current.add(nonce);
    pendingAssistantMessageIdsRef.current = new Set(
      mergedMessages
        .filter((message) => message.sender.role === 'assistant')
        .map((message) => message.id),
    );
    setError(null);
    stopTyping();
    setThinkingConversationId(conversationId);
    isSendingRef.current = true;
    setIsSending(true);

    const container = scrollRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }

    try {
      await sendMessage(conversationId, {
        type: 'text',
        content,
        metadata: messageMetadata,
      });
    } catch (sendError) {
      activeOptimisticNoncesRef.current.delete(nonce);
      pendingAssistantMessageIdsRef.current = null;
      removeOptimisticMessage(nonce);
      setThinkingConversationId(null);
      setError(sendError instanceof Error ? sendError.message : 'Failed to send message');
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }

  return (
    <section
      style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: helperPanel ? 'minmax(0, 1.8fr) minmax(260px, 0.9fr)' : '1fr',
        gap: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 16,
          borderRadius: 18,
          border: '1px solid #1f2937',
          background: '#020617',
          minHeight: 640,
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{title}</h1>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>{description}</p>
          <p style={{ color: '#64748b', fontSize: 12 }}>conversationId: {conversationId}</p>
        </header>

        {error ? (
          <ChatErrorBanner
            error={error}
            onDismiss={() => {
              setError(null);
            }}
          />
        ) : null}

        <ChatStatusBar
          connectionState={connectionState}
          isSending={isSending}
          isThinking={isThinking}
          isRuntimeReady={isRuntimeReady}
          isTypingSupported={isSupported}
        />

        <ScrollContainer
          scrollRef={scrollRef}
          onScroll={(event) => {
            const element = event.currentTarget;
            const previousScrollTop = lastScrollTopRef.current;
            lastScrollTopRef.current = element.scrollTop;
            const distanceFromBottom =
              element.scrollHeight - element.scrollTop - element.clientHeight;
            shouldAutoScrollRef.current = distanceFromBottom < AUTO_SCROLL_THRESHOLD_PX;

            if (
              !historyWindow ||
              pendingHistoryRestoreRef.current ||
              element.scrollTop > LOAD_OLDER_HISTORY_THRESHOLD_PX ||
              element.scrollTop >= previousScrollTop
            ) {
              return;
            }

            pendingHistoryRestoreRef.current = {
              previousScrollHeight: element.scrollHeight,
              previousScrollTop: element.scrollTop,
            };

            if (!hasHiddenHistory) {
              void loadOlderHistoryPage();
              return;
            }

            setVisibleMessageCount((current) =>
              scopedVisibleMessageCount(
                conversationId,
                initialVisibleMessageCount,
                getVisibleMessageCount(current, conversationId, initialVisibleMessageCount) +
                  historyWindow.incrementCount,
              ),
            );
          }}
        >
          {isLoadingOlderHistory ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                alignSelf: 'center',
                borderRadius: 999,
                border: '1px solid #334155',
                background: 'rgba(15, 23, 42, 0.88)',
                color: '#cbd5e1',
                fontSize: 12,
                padding: '6px 10px',
              }}
            >
              Loading older messages...
            </div>
          ) : null}
          <MessageList
            messages={visibleMessages}
            streamingPreview={streamingPreview}
            showThinkingIndicator={isThinking && !isStreaming}
            typingParticipants={typingParticipants}
            registry={getRendererRegistry()}
          />
        </ScrollContainer>

        {quickActions.length > 0 ? (
          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <strong style={{ fontSize: 13, color: '#e2e8f0' }}>Quick actions</strong>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Trigger deterministic demo responses without typing custom prompts.
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 10,
              }}
            >
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={isSending || !canSend}
                  onClick={() => {
                    void sendUserMessage(action.prompt, action.metadata);
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    borderRadius: 12,
                    border: '1px solid #334155',
                    background: 'rgba(15, 23, 42, 0.72)',
                    color: '#e2e8f0',
                    padding: '12px 14px',
                    textAlign: 'left',
                    cursor: isSending || !canSend ? 'not-allowed' : 'pointer',
                    opacity: isSending || !canSend ? 0.6 : 1,
                  }}
                >
                  <strong style={{ fontSize: 13 }}>{action.label}</strong>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{action.description}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <MessageInput
          disabled={isSending || !canSend}
          placeholder={composerPlaceholder}
          onValueChange={(text) => {
            if (!isSupported || !canSend) {
              return;
            }

            if (text.trim()) {
              notifyTyping();
              return;
            }

            stopTyping();
          }}
          onBlur={stopTyping}
          onSend={(text) => sendUserMessage(text)}
        />
      </div>

      {helperPanel ? (
        <aside
          style={{
            borderRadius: 18,
            border: '1px solid #1e293b',
            background: '#0f172a',
            padding: 16,
            color: '#dbe4f0',
            minHeight: 640,
          }}
        >
          {helperPanel}
        </aside>
      ) : null}
    </section>
  );
}
