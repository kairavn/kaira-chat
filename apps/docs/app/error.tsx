'use client';

import type { JSX } from 'react';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Error boundary for MDX and runtime errors in the docs site.
 * Catches errors in the route segment and displays a user-friendly message.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    // Log error to console in development
    console.error('Docs error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12">
      <div className="bg-destructive/10 flex h-16 w-16 items-center justify-center rounded-full">
        <AlertTriangle className="text-destructive h-8 w-8" />
      </div>

      <h2 className="mt-6 text-2xl font-semibold tracking-tight">Something went wrong</h2>

      <p className="text-muted-foreground mt-2 max-w-md text-center">
        An error occurred while loading this page. You can try refreshing or go back to the
        documentation home.
      </p>

      {error.message && (
        <div className="bg-muted mt-4 max-w-md rounded-lg p-4">
          <p className="text-muted-foreground font-mono text-sm">{error.message}</p>
          {error.digest && (
            <p className="text-muted-foreground mt-1 text-xs">Error ID: {error.digest}</p>
          )}
        </div>
      )}

      <div className="mt-8 flex items-center gap-4">
        <Button
          onClick={reset}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>

        <Button asChild>
          <a href="/">Go home</a>
        </Button>
      </div>
    </div>
  );
}
