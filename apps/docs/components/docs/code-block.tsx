'use client';

import type { JSX, ReactNode } from 'react';

import { Check, Copy } from 'lucide-react';
import { isValidElement, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface CodeBlockProps {
  /** Code content to display */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Programming language for syntax highlighting */
  language?: string;
  /** Optional filename to display in header */
  filename?: string;
}

/**
 * CodeBlock component for displaying code with optional filename header and copy button.
 * Note: For Shiki-highlighted code blocks, use fenced code blocks in MDX instead.
 * This component is for advanced use cases requiring custom headers.
 *
 * @example
 * <CodeBlock language="typescript" filename="config.ts">
 *   {`const config = { debug: true };`}
 * </CodeBlock>
 */
export function CodeBlock({
  children,
  className,
  language,
  filename,
}: CodeBlockProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);

  const handleCopy = async (): Promise<void> => {
    let textToCopy = '';

    // Try to get text from the pre element
    if (codeRef.current) {
      textToCopy = codeRef.current.textContent || '';
    } else if (isValidElement(children)) {
      // Fallback: try to extract from children props
      const childProps = children.props as { children?: string; className?: string };
      textToCopy = childProps.children || '';
    }

    if (textToCopy) {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      data-code-block
      className={cn('group bg-card relative my-6 overflow-hidden rounded-lg border', className)}
    >
      {/* Header with filename/language and copy button */}
      <div className="bg-muted/50 flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          {filename ? (
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="text-foreground text-sm font-medium">{filename}</span>
            </div>
          ) : (
            language && (
              <span className="bg-accent text-muted-foreground rounded px-2 py-0.5 text-xs font-semibold tracking-wider uppercase">
                {language}
              </span>
            )
          )}
        </div>
        <button
          onClick={handleCopy}
          className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2"
          aria-label="Copy code"
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
      </div>

      {/* Code content */}
      <div className="relative">
        <div className="overflow-x-auto p-4">
          <pre
            ref={codeRef}
            className="m-0 bg-transparent p-0 font-mono text-sm leading-relaxed"
            style={{
              whiteSpace: 'pre',
              wordWrap: 'normal',
              wordBreak: 'normal',
            }}
          >
            <code
              className="block bg-transparent p-0 font-mono text-sm"
              style={{
                whiteSpace: 'pre',
                wordWrap: 'normal',
                wordBreak: 'normal',
              }}
            >
              {children}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
