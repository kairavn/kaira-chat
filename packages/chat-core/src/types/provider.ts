import type { Message, MessageContent } from './message.js';

/** Known provider features used for capability negotiation. */
export type ProviderFeature = 'send' | 'stream' | 'tools' | 'attachments' | 'metadata';

/** Provider capability declaration exposed to consumers. */
export interface ProviderCapabilities {
  readonly send: boolean;
  readonly stream: boolean;
  readonly features?: ReadonlyArray<ProviderFeature>;
}

/** Request payload forwarded to a provider implementation. */
export interface ProviderRequest<TInput = MessageContent> {
  readonly conversationId: string;
  readonly input: TInput;
  readonly metadata?: Record<string, unknown>;
}

/** Provider-specific normalized response payload. */
export interface ProviderNormalizedResponse<TMessage extends Message = Message> {
  readonly message: TMessage;
  readonly raw?: unknown;
}

/** Provider-specific error shape for strongly-typed handling. */
export interface ProviderErrorShape {
  readonly provider: string;
  readonly message: string;
  readonly code?: string;
  readonly status?: number;
  readonly retryable?: boolean;
  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;
}

/** Result of a non-streaming provider send operation. */
export interface ProviderSendResult<TMessage extends Message = Message, TRawResponse = unknown> {
  readonly normalized: ProviderNormalizedResponse<TMessage>;
  readonly raw: TRawResponse;
}

/** Streaming lifecycle events emitted by provider stream implementations. */
export type ProviderStreamEvent<
  TMessage extends Message = Message,
  TProviderError extends ProviderErrorShape = ProviderErrorShape,
> =
  | { readonly type: 'start'; readonly timestamp: number }
  | { readonly type: 'chunk'; readonly timestamp: number; readonly chunk: string }
  | { readonly type: 'message'; readonly timestamp: number; readonly message: TMessage }
  | { readonly type: 'error'; readonly timestamp: number; readonly error: TProviderError }
  | { readonly type: 'end'; readonly timestamp: number };

/**
 * Provider contract for capability declaration, send/stream semantics,
 * response normalization, and provider-specific error mapping.
 */
export interface IProvider<
  TInput = MessageContent,
  TRawResponse = unknown,
  TMessage extends Message = Message,
  TProviderError extends ProviderErrorShape = ProviderErrorShape,
> {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  send(request: ProviderRequest<TInput>): Promise<ProviderSendResult<TMessage, TRawResponse>>;
  stream?(
    request: ProviderRequest<TInput>,
  ): AsyncIterable<ProviderStreamEvent<TMessage, TProviderError>>;
  normalizeResponse(raw: TRawResponse): ProviderNormalizedResponse<TMessage>;
  toProviderError?(error: unknown): TProviderError;
}
