'use client';

import type { JSX, KeyboardEvent } from 'react';

import Fuse from 'fuse.js';
import { FileText, Loader2, Search as SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { SEARCH_DATA } from '@/lib/search-data';
import { cn } from '@/lib/utils';

interface SearchProps {
  className?: string;
}

/**
 * Search component with Fuse.js-powered fuzzy search.
 * Includes keyboard shortcuts, loading states, and accessibility features.
 */
export function Search({ className }: SearchProps): JSX.Element {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLUListElement>(null);
  const deferredQuery = useDeferredValue(query);

  // Initialize Fuse instance
  const fuse = useMemo(
    () =>
      new Fuse(SEARCH_DATA, {
        keys: ['title', 'description'],
        threshold: 0.3,
      }),
    [],
  );

  const results = useMemo<typeof SEARCH_DATA>(() => {
    if (!deferredQuery.trim()) {
      return [];
    }

    return fuse.search(deferredQuery).map((result) => result.item);
  }, [deferredQuery, fuse]);
  const isLoading = query !== deferredQuery;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent): void => {
      // Cmd/Ctrl + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      // Escape to close
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Handle keyboard navigation in results
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleClose();
          router.push(results[selectedIndex].href);
        }
        break;
    }
  };

  const handleClose = (): void => {
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(-1);
  };

  return (
    <div className={cn('relative', className)}>
      {/* Search trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
        aria-label="Open search"
      >
        <SearchIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search documentation...</span>
        <kbd className="bg-muted hidden rounded px-1.5 py-0.5 font-mono text-xs sm:inline-block">
          ⌘K
        </kbd>
      </button>

      {/* Search modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <div
            className="fixed top-24 left-1/2 z-60 w-full max-w-lg -translate-x-1/2"
            role="dialog"
            aria-modal="true"
            aria-label="Search documentation"
          >
            <div className="bg-background overflow-hidden rounded-lg border shadow-2xl">
              {/* Search input */}
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <SearchIcon className="text-muted-foreground h-5 w-5" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search documentation..."
                  className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
                  autoFocus
                  aria-autocomplete="list"
                  aria-controls="search-results"
                  aria-activedescendant={
                    selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined
                  }
                />
                {isLoading && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
                <button
                  onClick={handleClose}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground rounded p-1"
                  aria-label="Close search"
                >
                  <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">ESC</kbd>
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto py-2">
                {results.length > 0 ? (
                  <ul
                    ref={resultsRef}
                    id="search-results"
                    role="listbox"
                    className="space-y-1 px-2"
                  >
                    {results.map((result, index) => (
                      <li
                        key={result.href}
                        id={`search-result-${index}`}
                        role="option"
                        aria-selected={index === selectedIndex}
                      >
                        <Link
                          href={result.href}
                          onClick={handleClose}
                          className={cn(
                            'flex items-start gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                            index === selectedIndex
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-accent/50',
                          )}
                        >
                          <FileText className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            <p className="font-medium">{result.title}</p>
                            {result.description && (
                              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                                {result.description}
                              </p>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : query ? (
                  isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                      <span className="text-muted-foreground ml-2 text-sm">Searching...</span>
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <p className="text-muted-foreground text-sm">
                        No results found for &quot;{query}&quot;
                      </p>
                    </div>
                  )
                ) : (
                  <div className="px-4 py-4">
                    <p className="text-muted-foreground mb-3 text-xs font-medium">Popular pages</p>
                    <ul
                      className="space-y-1"
                      role="listbox"
                    >
                      {SEARCH_DATA.slice(0, 5).map((item, index) => (
                        <li
                          key={item.href}
                          id={`search-result-${index}`}
                          role="option"
                          aria-selected={index === selectedIndex}
                        >
                          <Link
                            href={item.href}
                            onClick={handleClose}
                            className={cn(
                              'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                              index === selectedIndex
                                ? 'bg-accent text-accent-foreground'
                                : 'hover:bg-accent/50',
                            )}
                          >
                            <FileText className="text-muted-foreground h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-muted/50 text-muted-foreground border-t px-4 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>
                    <kbd className="bg-background rounded px-1 font-mono">↑↓</kbd> to navigate{' '}
                    <kbd className="bg-background rounded px-1 font-mono">↵</kbd> to select
                  </span>
                  <span>
                    <kbd className="bg-background rounded px-1 font-mono">ESC</kbd> to close
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
