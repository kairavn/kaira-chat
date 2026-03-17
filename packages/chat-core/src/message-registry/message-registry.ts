/**
 * Definition for a message type that can be registered in the message registry.
 */
export interface MessageTypeDefinition {
  readonly type: string;
  readonly validate?: (payload: unknown) => boolean;
  readonly normalize?: (payload: unknown) => unknown;
}

/**
 * Registry for known message types used by ChatEngine.
 */
export class MessageRegistry {
  private readonly definitions = new Map<string, MessageTypeDefinition>();

  /**
   * Register or replace a message type definition.
   */
  register(definition: MessageTypeDefinition): void {
    const normalizedType = definition.type.trim();
    if (normalizedType.length === 0) {
      throw new Error('Message type must be a non-empty string');
    }

    this.definitions.set(normalizedType, {
      ...definition,
      type: normalizedType,
    });
  }

  /**
   * Get a definition by type.
   */
  get(type: string): MessageTypeDefinition | undefined {
    return this.definitions.get(type);
  }

  /**
   * Check whether a type exists.
   */
  has(type: string): boolean {
    return this.definitions.has(type);
  }

  /**
   * List all registered type definitions.
   */
  list(): ReadonlyArray<MessageTypeDefinition> {
    return [...this.definitions.values()];
  }
}
