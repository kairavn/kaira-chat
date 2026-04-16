// Types — common
export type { ImageDimensions, SortDirection, Unsubscribe } from './types/common.js';

// Types — participant
export type { Participant, ParticipantRole } from './types/participant.js';

// Types — message
export type {
  AIMessage,
  AIMetadata,
  AIStreamState,
  AudioMessage,
  CustomMessage,
  FileMessage,
  ImageMessage,
  LocationMessage,
  Message,
  MessageContent,
  MessageMetadata,
  MessageStatus,
  MessageType,
  SystemEventKind,
  SystemMessage,
  TextMessage,
  VideoMessage,
} from './types/message.js';

// Types — conversation
export type {
  Conversation,
  ConversationType,
  CreateConversationParams,
} from './types/conversation.js';

// Types — error
export { createChatError } from './types/error.js';
export type { ChatError, ChatErrorKind } from './types/error.js';

// Types — event
export type {
  ChatEvent,
  ChatEventHandler,
  ChatEventMap,
  ChatEventType,
  ConnectionState,
  ConversationState,
} from './types/event.js';

// Types — transport
export type {
  ITransport,
  TransportCapabilities,
  TransportEvent,
  TransportEventMap,
  TransportEventType,
} from './types/transport.js';

// Types — provider
export type {
  IProvider,
  ProviderCapabilities,
  ProviderErrorShape,
  ProviderFeature,
  ProviderNormalizedResponse,
  ProviderRequest,
  ProviderSendResult,
  ProviderStreamEvent,
} from './types/provider.js';

// Types — storage
export type { ConversationQuery, CursorPage, IStorage, MessageQuery } from './types/storage.js';

// Types — middleware
export type { Middleware, MiddlewareContext, NextFn } from './types/middleware.js';

// Types — plugin
export type { ChatPlugin } from './types/plugin.js';

// Types — typing
export type {
  ConversationTypingState,
  TypingConfig,
  TypingParticipantSelectorOptions,
  TypingParticipantState,
  TypingStateSource,
  TypingStopReason,
  TypingTransportAction,
  TypingTransportPayload,
} from './types/typing.js';

// Types — message registry
export type { MessageTypeDefinition } from './message-registry/message-registry.js';

// Types — engine
export type { ChatEngineConfig, IChatEngine } from './types/engine.js';

// Implementations
export { ChatEngine } from './engine/chat-engine.js';
export { EventBus } from './event-bus/event-bus.js';
export { MessageRegistry } from './message-registry/message-registry.js';
export { MiddlewarePipeline } from './middleware/pipeline.js';
export { ChatSerializer } from './serialization/serializer.js';
export { ConnectionStateMachine } from './state/connection-state.js';
export { ConversationStateMachine } from './state/conversation-state.js';

// Utils
export {
  isAIMessage,
  isAudioMessage,
  isCustomMessage,
  isFileMessage,
  isImageMessage,
  isLocationMessage,
  isSystemMessage,
  isTextMessage,
  isVideoMessage,
} from './utils/assert.js';
export { generateId } from './utils/id.js';
export {
  deduplicateMessages,
  getMessageClientNonce,
  mergeMessageSets,
  sortMessagesByTimestamp,
} from './utils/messages.js';
export { selectIsTyping, selectTypingParticipants } from './utils/typing.js';
