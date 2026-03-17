import type { Conversation, Message } from '@kaira/chat-core';
import type { ComponentType } from 'react';

/**
 * Props passed to all message renderer components.
 */
export interface MessageRendererProps {
  readonly message: Message;
  readonly conversation?: Conversation;
}

/**
 * Definition for a renderer that handles one message type.
 */
export interface RendererDefinition {
  readonly type: string;
  readonly component: ComponentType<MessageRendererProps>;
}

/**
 * Registry for message renderers keyed by message type.
 */
export class RendererRegistry {
  private readonly definitions = new Map<string, RendererDefinition>();

  /**
   * Register or replace a renderer definition by type.
   */
  register(definition: RendererDefinition): void {
    const normalizedType = definition.type.trim();
    if (normalizedType.length === 0) {
      throw new Error('Renderer type must be a non-empty string');
    }

    this.definitions.set(normalizedType, {
      ...definition,
      type: normalizedType,
    });
  }

  /**
   * Get the renderer definition for a message type.
   */
  get(type: string): RendererDefinition | undefined {
    return this.definitions.get(type.trim());
  }

  /**
   * Check if a renderer exists for a message type.
   */
  has(type: string): boolean {
    return this.definitions.has(type.trim());
  }
}
