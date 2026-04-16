import type {
  AIMessage,
  AudioMessage,
  CustomMessage,
  FileMessage,
  ImageMessage,
  LocationMessage,
  Message,
  SystemMessage,
  TextMessage,
  VideoMessage,
} from '../types/message.js';

/** Narrows a Message to TextMessage. */
export function isTextMessage(msg: Message): msg is TextMessage {
  return msg.type === 'text';
}

/** Narrows a Message to ImageMessage. */
export function isImageMessage(msg: Message): msg is ImageMessage {
  return msg.type === 'image';
}

/** Narrows a Message to AudioMessage. */
export function isAudioMessage(msg: Message): msg is AudioMessage {
  return msg.type === 'audio';
}

/** Narrows a Message to VideoMessage. */
export function isVideoMessage(msg: Message): msg is VideoMessage {
  return msg.type === 'video';
}

/** Narrows a Message to FileMessage. */
export function isFileMessage(msg: Message): msg is FileMessage {
  return msg.type === 'file';
}

/** Narrows a Message to LocationMessage. */
export function isLocationMessage(msg: Message): msg is LocationMessage {
  return msg.type === 'location';
}

/** Narrows a Message to SystemMessage. */
export function isSystemMessage(msg: Message): msg is SystemMessage {
  return msg.type === 'system';
}

/** Narrows a Message to AIMessage. */
export function isAIMessage(msg: Message): msg is AIMessage {
  return msg.type === 'ai';
}

/** Narrows a Message to CustomMessage. */
export function isCustomMessage(msg: Message): msg is CustomMessage {
  return msg.type === 'custom';
}
