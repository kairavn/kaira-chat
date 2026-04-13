export type DemoId = 'dit-modive' | 'next-backend' | 'streaming' | 'media' | 'persistence';

export interface DemoDefinition {
  readonly id: DemoId;
  readonly route: `/${string}`;
  readonly title: string;
  readonly description: string;
  readonly badges: ReadonlyArray<string>;
  readonly summary: string;
  readonly kind: 'dit' | 'local';
}

export const DEMO_DEFINITIONS: ReadonlyArray<DemoDefinition> = [
  {
    id: 'dit-modive',
    route: '/dit-modive',
    title: 'DIT Provider Demo',
    description: 'The existing DIT-backed chat flow, preserved under its own route.',
    badges: ['DIT transport', 'Polling transport', 'Optimistic send', 'IndexedDB'],
    summary:
      'Shows the current production-like bridge where Next.js keeps DIT credentials server-side and the browser uses the SDK over a local route surface.',
    kind: 'dit',
  },
  {
    id: 'next-backend',
    route: '/next-backend',
    title: 'Next Backend Chat Demo',
    description: 'A local Next.js backend using route handlers and a server-owned ChatEngine.',
    badges: ['Local backend', 'Streaming', 'Typing', 'Optimistic send'],
    summary:
      'Demonstrates a provider-agnostic local backend flow with deterministic quick actions, typing indicators, and streamed AI text.',
    kind: 'local',
  },
  {
    id: 'streaming',
    route: '/streaming',
    title: 'Streaming Demo',
    description: 'Focused stream lifecycle coverage using the local backend.',
    badges: ['SSE stream bridge', 'Chunks', 'Stream error'],
    summary:
      'Lets you trigger normal, long, and failed stream scenarios through explicit quick actions to verify stream preview and final AI message behavior.',
    kind: 'local',
  },
  {
    id: 'media',
    route: '/media',
    title: 'Renderer Demo',
    description:
      'Built-in image, file, audio, video, and location renderers plus fallback content.',
    badges: ['Media renderers', 'Fallback renderer', 'System messages'],
    summary:
      'Combines a seeded conversation with exact quick actions so each built-in renderer and the fallback path can be verified on demand.',
    kind: 'local',
  },
  {
    id: 'persistence',
    route: '/persistence',
    title: 'Persistence Demo',
    description: 'Conversation switching and IndexedDB-backed local persistence.',
    badges: ['IndexedDB', 'Conversation switching', 'Reload verification'],
    summary:
      'Loads multiple demo conversations, mirrors them into the browser storage adapter, and makes it easy to verify persisted history across reloads.',
    kind: 'local',
  },
] as const;

export function getDemoDefinition(id: DemoId): DemoDefinition {
  const definition = DEMO_DEFINITIONS.find((entry) => entry.id === id);
  if (!definition) {
    throw new Error(`Unknown demo id: ${id}`);
  }

  return definition;
}
