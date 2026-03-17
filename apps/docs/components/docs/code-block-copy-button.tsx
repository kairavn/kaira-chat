'use client';

import type { JSX } from 'react';

import { Check, Copy, FileCode, FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface CodeBlockCopyButtonProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
}

type CopyFormat = 'code' | 'markdown';

export function CodeBlockCopyButton({
  code,
  language = 'text',
  className,
}: CodeBlockCopyButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const copyToClipboard = async (format: CopyFormat): Promise<void> => {
    let content = '';

    if (format === 'markdown') {
      // Copy as markdown code block
      const lang = language || 'text';
      content = ['```' + lang, code, '```'].join('\n');
    } else {
      // Copy just the code
      content = code;
    }

    await navigator.clipboard.writeText(content);
    setCopied(true);
    setShowOptions(false);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
    >
      <button
        onClick={() => copyToClipboard('code')}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowOptions(!showOptions);
        }}
        className={cn(
          'flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-all',
          'bg-background/80 border-border border backdrop-blur-sm',
          'text-muted-foreground hover:text-foreground hover:bg-accent',
          'focus-visible:ring-ring focus:outline-none focus-visible:ring-2',
        )}
        aria-label={copied ? 'Copied!' : 'Copy code'}
        title="Click to copy code. Right-click for options."
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            <span>Copied</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            <span>Copy</span>
          </>
        )}
      </button>

      {/* Dropdown menu for copy options */}
      {showOptions && (
        <div className="bg-popover absolute top-full right-0 z-50 mt-1 w-48 rounded-md border shadow-md">
          <div className="py-1">
            <button
              onClick={() => copyToClipboard('code')}
              className="text-foreground hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4" />
              <span>Copy as text</span>
            </button>
            <button
              onClick={() => copyToClipboard('markdown')}
              className="text-foreground hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-sm"
            >
              <FileCode className="h-4 w-4" />
              <span>Copy as markdown</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
