'use client';

import type { Conversation } from '@kaira/chat-core';
import type { JSX } from 'react';

import { useEffect, useState } from 'react';

import { ChatSurface } from '@/components/chat/ChatSurface';

import { useDemoRuntime } from './DemoRuntimeProvider';

const ACTIVE_CONVERSATION_STORAGE_KEY = 'kaira-chat-demo:persistence:active-conversation-id';

function getInitialConversationId(
  conversations: ReadonlyArray<Conversation>,
  storedConversationId: string | null,
): string | null {
  if (
    storedConversationId &&
    conversations.some((conversation) => conversation.id === storedConversationId)
  ) {
    return storedConversationId;
  }

  return conversations[0]?.id ?? null;
}

export function PersistenceDemo(): JSX.Element {
  const runtime = useDemoRuntime();
  const [conversations, setConversations] = useState<ReadonlyArray<Conversation>>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedConversations, setHasLoadedConversations] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadConversations(): Promise<void> {
      try {
        const nextConversations = await runtime.listConversations();
        if (!isMounted) {
          return;
        }

        setConversations(nextConversations);
        setActiveConversationId(
          getInitialConversationId(
            nextConversations,
            window.localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY),
          ),
        );
        setHasLoadedConversations(true);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load persistence demo conversations.',
        );
      }
    }

    void loadConversations();

    return () => {
      isMounted = false;
    };
  }, [runtime]);

  useEffect(() => {
    if (!hasLoadedConversations) {
      return;
    }

    runtime.setActiveConversationId(activeConversationId);
    if (activeConversationId) {
      window.localStorage.setItem(ACTIVE_CONVERSATION_STORAGE_KEY, activeConversationId);
      return;
    }

    window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
  }, [activeConversationId, hasLoadedConversations, runtime]);

  if (error) {
    return (
      <section
        style={{
          borderRadius: 18,
          border: '1px solid #7f1d1d',
          background: '#450a0a',
          color: '#fecaca',
          padding: 20,
        }}
      >
        {error}
      </section>
    );
  }

  if (!activeConversationId) {
    return (
      <section
        style={{
          borderRadius: 18,
          border: '1px solid #1e293b',
          background: '#0f172a',
          color: '#cbd5e1',
          padding: 20,
        }}
      >
        Loading persisted conversations…
      </section>
    );
  }

  return (
    <ChatSurface
      title="Persistence Demo"
      description="Switch conversations, send a few messages, reload the page, and confirm that the IndexedDB-backed client runtime restores the fetched history."
      conversationId={activeConversationId}
      helperPanel={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2 style={{ fontSize: 16 }}>Conversations</h2>
            <p style={{ color: '#94a3b8', fontSize: 13 }}>
              The browser runtime mirrors these server conversations into the IndexedDB storage
              adapter. Switch threads, then reload to verify persisted history.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {conversations.map((conversation) => {
              const label =
                typeof conversation.metadata?.['title'] === 'string'
                  ? conversation.metadata['title']
                  : conversation.id;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  aria-pressed={conversation.id === activeConversationId}
                  onClick={() => {
                    setActiveConversationId(conversation.id);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    borderRadius: 12,
                    border:
                      conversation.id === activeConversationId
                        ? '1px solid #60a5fa'
                        : '1px solid #334155',
                    background:
                      conversation.id === activeConversationId
                        ? 'rgba(37, 99, 235, 0.18)'
                        : 'rgba(15, 23, 42, 0.72)',
                    color: '#e2e8f0',
                    padding: '12px 14px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{label}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>{conversation.id}</div>
                </button>
              );
            })}
          </div>
          <div
            style={{
              borderRadius: 12,
              border: '1px solid #334155',
              background: 'rgba(15, 23, 42, 0.72)',
              padding: '12px 14px',
              color: '#cbd5e1',
              fontSize: 13,
            }}
          >
            Storage namespace: <code>kaira-chat-demo:persistence</code>
          </div>
        </div>
      }
    />
  );
}
