/** Category of a chat error for exhaustive handling. */
export type ChatErrorKind =
  | 'transport'
  | 'storage'
  | 'middleware'
  | 'validation'
  | 'state'
  | 'plugin'
  | 'unknown';

/** Structured error produced by the chat core. */
export interface ChatError {
  readonly kind: ChatErrorKind;
  readonly message: string;
  readonly cause?: unknown;
  readonly metadata?: Record<string, unknown>;
}

/** Create a typed ChatError. */
export function createChatError(
  kind: ChatErrorKind,
  message: string,
  options?: { cause?: unknown; metadata?: Record<string, unknown> },
): ChatError {
  return {
    kind,
    message,
    cause: options?.cause,
    metadata: options?.metadata,
  };
}
