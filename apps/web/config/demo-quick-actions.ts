import type { DemoQuickAction } from '@/lib/demo/contracts';

export const NEXT_BACKEND_QUICK_ACTIONS: ReadonlyArray<DemoQuickAction> = [
  {
    id: 'next-backend-transport',
    label: 'Trace Transport',
    description:
      'Stream how the local route-handler backend, polling transport, and browser runtime fit together.',
    prompt: 'Trace the local backend transport path in this demo.',
    metadata: {
      demoAction: 'next-backend:transport',
    },
  },
  {
    id: 'next-backend-persistence',
    label: 'Explain Persistence',
    description: 'Stream how polling and IndexedDB keep the demo history stable across reloads.',
    prompt: 'Explain the persistence path in this demo.',
    metadata: {
      demoAction: 'next-backend:persistence',
    },
  },
  {
    id: 'next-backend-checklist',
    label: 'QA Checklist',
    description: 'Stream a compact checklist for manually verifying the local backend demo.',
    prompt: 'Give me a QA checklist for this demo.',
    metadata: {
      demoAction: 'next-backend:checklist',
    },
  },
] as const;

export const STREAMING_QUICK_ACTIONS: ReadonlyArray<DemoQuickAction> = [
  {
    id: 'streaming-normal',
    label: 'Normal Stream',
    description: 'Run the standard streaming path with a short AI completion.',
    prompt: 'Run the normal stream scenario.',
    metadata: {
      demoAction: 'streaming:normal',
    },
  },
  {
    id: 'streaming-long',
    label: 'Long Stream',
    description: 'Run a longer chunked response so the preview stays visible for inspection.',
    prompt: 'Run the long stream scenario.',
    metadata: {
      demoAction: 'streaming:long',
    },
  },
  {
    id: 'streaming-error',
    label: 'Fail Stream',
    description: 'Trigger a stream failure and confirm the terminal error message is visible.',
    prompt: 'Run the failing stream scenario.',
    metadata: {
      demoAction: 'streaming:error',
    },
  },
] as const;

export const WEBSOCKET_QUICK_ACTIONS: ReadonlyArray<DemoQuickAction> = [
  {
    id: 'websocket-transport',
    label: 'Trace Socket',
    description: 'Ask the local backend to explain the WebSocket transport path.',
    prompt: 'Explain the WebSocket transport path in this demo.',
  },
  {
    id: 'websocket-reconnect',
    label: 'Reconnect Check',
    description: 'Ask for the manual reconnect verification checklist.',
    prompt: 'How should I verify reconnect behavior in this WebSocket demo?',
  },
] as const;

export const MEDIA_QUICK_ACTIONS: ReadonlyArray<DemoQuickAction> = [
  {
    id: 'media-image',
    label: 'Image',
    description: 'Return an assistant image message.',
    prompt: 'Show an image example.',
    metadata: {
      demoAction: 'media:image',
    },
  },
  {
    id: 'media-audio',
    label: 'Audio',
    description: 'Return an assistant audio message.',
    prompt: 'Show an audio example.',
    metadata: {
      demoAction: 'media:audio',
    },
  },
  {
    id: 'media-video',
    label: 'Video',
    description: 'Return an assistant video message.',
    prompt: 'Show a video example.',
    metadata: {
      demoAction: 'media:video',
    },
  },
  {
    id: 'media-file',
    label: 'File',
    description: 'Return an assistant file attachment.',
    prompt: 'Show a file example.',
    metadata: {
      demoAction: 'media:file',
    },
  },
  {
    id: 'media-location',
    label: 'Location',
    description: 'Return an assistant location card.',
    prompt: 'Show a location example.',
    metadata: {
      demoAction: 'media:location',
    },
  },
  {
    id: 'media-fallback',
    label: 'Fallback',
    description: 'Return unsupported custom content and hit the fallback renderer.',
    prompt: 'Show a fallback renderer example.',
    metadata: {
      demoAction: 'media:fallback',
    },
  },
] as const;
