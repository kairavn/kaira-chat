'use client';

import { createDefaultRendererRegistry } from '@kaira/chat-ui';

const rendererRegistry = createDefaultRendererRegistry();

/**
 * Returns a singleton renderer registry used by the demo UI.
 */
export function getRendererRegistry() {
  return rendererRegistry;
}
