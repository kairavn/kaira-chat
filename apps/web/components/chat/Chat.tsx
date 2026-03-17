'use client';

import type { Message } from '@kaira/chat-core';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  useConnectionState,
  useConversation,
  useMessages,
  useOptimisticMessages,
  useSendMessage,
  useStreamingMessage,
} from '@kaira/chat-react';
import { MessageInput } from '@kaira/chat-ui';

import { demoConfig } from '@/config/demo';
import { getRendererRegistry } from '@/lib/chat/renderers';

import { ChatErrorBanner } from './ChatErrorBanner';
import { ChatStatusBar } from './ChatStatusBar';
import { MessageList } from './MessageList';
import { ScrollContainer } from './ScrollContainer';

const AUTO_SCROLL_THRESHOLD_PX = 120;
const AI_THINKING_TIMEOUT_MS = 30_000;

export function Chat() {
  const connectionState = useConnectionState();
  const sendMessage = useSendMessage();
  const conversationId = demoConfig.chatroomId;
  const senderId = demoConfig.senderId;
  const messages = useMessages(conversationId);
  const conversation = useConversation(conversationId);
  const { message: streamingPreview, isStreaming } = useStreamingMessage(conversationId);
  const { mergedMessages, addOptimisticMessage, reconcileMessage } =
    useOptimisticMessages(messages);
  const rendererRegistry = useMemo(() => getRendererRegistry(), []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef<boolean>(true);

  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [thinkingSince, setThinkingSince] = useState<number | null>(null);

  const scrollToBottom = useCallback((force: boolean = false): void => {
    const container = scrollRef.current;
    if (!container) return;
    if (!force && !shouldAutoScrollRef.current) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    for (const message of messages) {
      reconcileMessage(message);
    }
  }, [messages, reconcileMessage]);

  useEffect(() => {
    if (!isStreaming || !isThinking) return;
    setIsThinking(false);
    setThinkingSince(null);
  }, [isStreaming, isThinking]);

  useEffect(() => {
    if (!isThinking || !thinkingSince) return;
    const hasAssistantResponse = mergedMessages.some(
      (message) => message.sender.role === 'assistant' && message.timestamp >= thinkingSince,
    );
    if (!hasAssistantResponse) return;
    setIsThinking(false);
    setThinkingSince(null);
  }, [mergedMessages, isThinking, thinkingSince]);

  useEffect(() => {
    if (!isThinking) return;
    const timer = setTimeout(() => {
      setIsThinking(false);
      setThinkingSince(null);
      setError('AI response timed out. Please try again.');
    }, AI_THINKING_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [isThinking]);

  useEffect(() => {
    scrollToBottom();
  }, [mergedMessages, streamingPreview?.content, isThinking, scrollToBottom]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>): void => {
    const element = event.currentTarget;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < AUTO_SCROLL_THRESHOLD_PX;
  }, []);

  const sendUserMessage = useCallback(
    async (text: string): Promise<void> => {
      const content = text.trim();
      if (!content) {
        return;
      }

      const nonce = `nonce-${crypto.randomUUID()}`;
      const optimisticTimestamp = Date.now();

      const optimisticMessage: Message = {
        id: `optimistic-${nonce}`,
        conversationId,
        sender: {
          id: senderId,
          role: 'user',
        },
        timestamp: optimisticTimestamp,
        status: 'pending',
        type: 'text',
        content,
        metadata: { clientNonce: nonce },
      };

      addOptimisticMessage(optimisticMessage, nonce);
      setError(null);
      setIsThinking(true);
      setThinkingSince(optimisticTimestamp);
      setIsSending(true);
      scrollToBottom(true);

      try {
        await sendMessage(conversationId, {
          type: 'text',
          content,
          metadata: { clientNonce: nonce },
        });
      } catch (sendError) {
        setIsThinking(false);
        setThinkingSince(null);
        setError(sendError instanceof Error ? sendError.message : 'Failed to send message');
      } finally {
        setIsSending(false);
      }
    },
    [addOptimisticMessage, conversationId, scrollToBottom, sendMessage, senderId],
  );

  return (
    <section
      style={{
        width: '100%',
        maxWidth: 900,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        borderRadius: 16,
        border: '1px solid #1f2937',
        background: '#020617',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>DIT Chat Demo</h1>
        <p style={{ color: '#94a3b8', fontSize: 14 }}>conversationId: {conversationId}</p>
      </header>

      {error ? (
        <ChatErrorBanner
          error={error}
          onDismiss={() => setError(null)}
        />
      ) : null}

      <ChatStatusBar
        connectionState={connectionState}
        isSending={isSending}
        hasConversation={Boolean(conversation)}
        isThinking={isThinking}
      />

      <ScrollContainer
        scrollRef={scrollRef}
        onScroll={handleScroll}
      >
        <MessageList
          messages={mergedMessages}
          conversation={conversation}
          streamingPreview={streamingPreview}
          showThinkingIndicator={isThinking && !isStreaming}
          registry={rendererRegistry}
        />
      </ScrollContainer>

      <MessageInput
        disabled={isSending}
        onSend={sendUserMessage}
      />
    </section>
  );
}
