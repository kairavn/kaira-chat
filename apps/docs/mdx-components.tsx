import type { MDXComponents } from 'mdx/types';

import Link from 'next/link';

import { Badge } from '@/components/docs/badge';
import { Callout } from '@/components/docs/callout';
import { Card, CardGroup } from '@/components/docs/card';
import { CodeBlock } from '@/components/docs/code-block';
import { Heading } from '@/components/docs/heading';
import { Step, Steps } from '@/components/docs/steps';
import { Tab, Tabs, TabsList } from '@/components/docs/tabs';

// Note: We don't override pre/code here because rehype-pretty-code
// transforms them into figure[data-rehype-pretty-code-figure] elements
// with proper Shiki syntax highlighting. The CSS in globals.css handles
// styling for those transformed blocks.

const isInternalPathHref = (href: string): boolean =>
  href.startsWith('/') && !href.startsWith('//');

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Headings with anchor links
    h1: ({ children, ...props }) => (
      <Heading
        as="h1"
        {...props}
      >
        {children}
      </Heading>
    ),
    h2: ({ children, ...props }) => (
      <Heading
        as="h2"
        {...props}
      >
        {children}
      </Heading>
    ),
    h3: ({ children, ...props }) => (
      <Heading
        as="h3"
        {...props}
      >
        {children}
      </Heading>
    ),
    h4: ({ children, ...props }) => (
      <Heading
        as="h4"
        {...props}
      >
        {children}
      </Heading>
    ),
    h5: ({ children, ...props }) => (
      <Heading
        as="h5"
        {...props}
      >
        {children}
      </Heading>
    ),
    h6: ({ children, ...props }) => (
      <Heading
        as="h6"
        {...props}
      >
        {children}
      </Heading>
    ),

    // Note: Shiki-processed code blocks are handled by CSS.
    // We don't override pre/code to avoid conflicts.
    a: ({ children, href, ...props }) => {
      if (typeof href === 'string' && isInternalPathHref(href)) {
        return (
          <Link
            href={href}
            {...props}
          >
            {children}
          </Link>
        );
      }

      return (
        <a
          href={href}
          {...props}
        >
          {children}
        </a>
      );
    },

    // Custom MDX components
    Callout,
    Badge,
    Card,
    CardGroup,
    CodeBlock,
    Step,
    Steps,
    Tabs,
    TabsList,
    Tab,

    // Merge with any custom components passed in
    ...components,
  };
}
