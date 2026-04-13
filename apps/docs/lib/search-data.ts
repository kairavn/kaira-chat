/**
 * Search data for documentation pages.
 * This is auto-generated from MDX files at build time.
 * To regenerate, run: node -e "[generation script]" > lib/search-data.ts
 */

export interface SearchResult {
  title: string;
  href: string;
  description?: string;
}

/**
 * Auto-generated search index from MDX page files.
 * Updated: 2026-04-13
 */
export const SEARCH_DATA: SearchResult[] = [
  {
    title: 'Introduction',
    href: '/',
    description:
      'The Kaira Chat SDK is a modular toolkit for building chat experiences with predictable runtime behavior, pluggable infrastructure, and framework-friendly...',
  },
  {
    title: 'Architecture Overview',
    href: '/architecture/',
    description:
      'The SDK is centered around ChatEngine and composes optional transport, storage, plugins, and middleware.',
  },
  {
    title: 'Component Examples',
    href: '/components/',
    description:
      'This page demonstrates all the available MDX components for the Kaira Chat SDK documentation.',
  },
  {
    title: 'Core API',
    href: '/core-api/',
    description: 'ChatEngine implements IChatEngine and adds streaming helper methods.',
  },
  {
    title: 'DevTools',
    href: '/devtools/',
    description:
      '@kaira/chat-devtools provides runtime inspection for events, messages, streams, transport, plugins, and middleware.',
  },
  {
    title: 'Events',
    href: '/events/',
    description: 'Events are emitted by ChatEngine and consumed through engine.on(...).',
  },
  {
    title: 'Examples',
    href: '/examples/',
    description:
      'Server route layer owns DitTransport and server-only credentials. Client runtime uses ChatProvider with a client ChatEngine backed by PollingTransport. Client...',
  },
  {
    title: 'Middleware',
    href: '/middleware/',
    description: 'Middleware runs in order and receives immutable context for each event.',
  },
  {
    title: 'Plugin System',
    href: '/plugins/',
    description: 'Plugins extend ChatEngine behavior without changing engine internals.',
  },
  {
    title: 'Quick Start',
    href: '/quick-start/',
    description:
      'Build a minimal chat app with Next.js App Router, chat-core, chat-react, and polling transport.',
  },
  {
    title: 'React Integration',
    href: '/react/',
    description: '@kaira/chat-react wraps ChatEngine with a provider + focused hooks.',
  },
  {
    title: 'Storage API',
    href: '/storage/',
    description: 'IStorage abstracts persistence for conversations and messages.',
  },
  {
    title: 'Streaming API',
    href: '/streaming/',
    description: 'Streaming helpers let you model token/chunk generation from AI providers.',
  },
  {
    title: 'Documentation Structure',
    href: '/structure/',
    description: 'This site is built with Next.js App Router + MDX.',
  },
  {
    title: 'Transport API',
    href: '/transport/',
    description: 'ITransport abstracts realtime communication from ChatEngine.',
  },
  {
    title: 'UI Components',
    href: '/ui/',
    description: '@kaira/chat-ui contains composable primitives, not a monolithic chat shell.',
  },
];
