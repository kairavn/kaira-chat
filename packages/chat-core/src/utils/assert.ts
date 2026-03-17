import type {
  AIMessage,
  CustomMessage,
  FileMessage,
  ImageMessage,
  Message,
  SystemMessage,
  TextMessage,
  ToolCallMessage,
  ToolResultMessage,
} from '../types/message.js';

/** Narrows a Message to TextMessage. */
export function isTextMessage(msg: Message): msg is TextMessage {
  return msg.type === 'text';
}

/** Narrows a Message to ImageMessage. */
export function isImageMessage(msg: Message): msg is ImageMessage {
  return msg.type === 'image';
}

/** Narrows a Message to FileMessage. */
export function isFileMessage(msg: Message): msg is FileMessage {
  return msg.type === 'file';
}

/** Narrows a Message to SystemMessage. */
export function isSystemMessage(msg: Message): msg is SystemMessage {
  return msg.type === 'system';
}

/** Narrows a Message to AIMessage. */
export function isAIMessage(msg: Message): msg is AIMessage {
  return msg.type === 'ai';
}

/** Narrows a Message to ToolCallMessage. */
export function isToolCallMessage(msg: Message): msg is ToolCallMessage {
  return msg.type === 'tool_call';
}

/** Narrows a Message to ToolResultMessage. */
export function isToolResultMessage(msg: Message): msg is ToolResultMessage {
  return msg.type === 'tool_result';
}

/** Narrows a Message to CustomMessage. */
export function isCustomMessage(msg: Message): msg is CustomMessage {
  return msg.type === 'custom';
}
