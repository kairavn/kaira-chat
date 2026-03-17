import type { Metadata } from 'next';
import type { JSX } from 'react';

import { FileQuestion, Home, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The requested documentation page could not be found.',
};

/**
 * 404 page for documentation routes.
 * Provides helpful navigation back to valid documentation pages.
 */
export default function NotFound(): JSX.Element {
  const suggestedPages = [
    { title: 'Introduction', href: '/' },
    { title: 'Quick Start', href: '/quick-start/' },
    { title: 'Core API', href: '/core-api/' },
    { title: 'Examples', href: '/examples/' },
  ];

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
      <div className="bg-muted flex h-20 w-20 items-center justify-center rounded-full">
        <FileQuestion className="text-muted-foreground h-10 w-10" />
      </div>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">Page Not Found</h1>

      <p className="text-muted-foreground mt-3 max-w-md text-center">
        The documentation page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <div className="mt-8 flex items-center gap-4">
        <Button
          asChild
          variant="outline"
          className="gap-2"
        >
          <a href="/">
            <Home className="h-4 w-4" />
            Go home
          </a>
        </Button>

        <Button
          asChild
          className="gap-2"
        >
          <a href="/">
            <Search className="h-4 w-4" />
            Search docs
          </a>
        </Button>
      </div>

      <div className="mt-12 w-full max-w-md">
        <p className="text-muted-foreground mb-4 text-center text-sm font-medium">Popular pages</p>
        <ul className="space-y-2">
          {suggestedPages.map((page) => (
            <li key={page.href}>
              <a
                href={page.href}
                className="hover:bg-accent flex items-center justify-between rounded-lg border p-3 text-sm transition-colors"
              >
                <span>{page.title}</span>
                <span className="text-muted-foreground">→</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
