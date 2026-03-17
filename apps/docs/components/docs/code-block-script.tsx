'use client';

import type { JSX } from 'react';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Debounce function to limit execution frequency
 */
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Store event handlers for cleanup
interface HandlerStore {
  block: HTMLElement;
  mouseEnter: () => void;
  mouseLeave: () => void;
}

/**
 * Adds copy buttons to all Shiki-highlighted code blocks.
 * This runs client-side after hydration and re-runs on page navigation.
 */
export function CodeBlockScript(): JSX.Element | null {
  const pathname = usePathname();
  const handlersRef = useRef<HandlerStore[]>([]);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    // Debounced processing to handle rapid navigation
    const processBlocks = debounce(() => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      // Clean up existing buttons first
      document.querySelectorAll('.shiki-copy-button').forEach((btn) => btn.remove());
      handlersRef.current.forEach(({ block }) => {
        block.onmouseenter = null;
        block.onmouseleave = null;
      });
      handlersRef.current = [];

      // Find all Shiki code blocks
      const codeBlocks = document.querySelectorAll('figure[data-rehype-pretty-code-figure]');

      codeBlocks.forEach((block) => {
        const pre = block.querySelector('pre');
        if (!pre) return;

        // Get code content
        const code = pre.textContent || '';

        // Create copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'shiki-copy-button';
        copyBtn.style.cssText =
          'position: absolute; right: 0.75rem; top: 0.75rem; z-index: 10; opacity: 0; transition: opacity 0.2s; display: flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; font-size: 0.75rem; font-weight: 500; background: var(--background); border: 1px solid var(--border); border-radius: 0.375rem; color: var(--muted-foreground); cursor: pointer;';
        copyBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
          <span>Copy</span>
        `;

        copyBtn.onmouseenter = () => {
          copyBtn.style.color = 'var(--foreground)';
          copyBtn.style.background = 'var(--accent)';
        };
        copyBtn.onmouseleave = () => {
          copyBtn.style.color = 'var(--muted-foreground)';
          copyBtn.style.background = 'var(--background)';
        };

        copyBtn.onclick = async () => {
          await navigator.clipboard.writeText(code);
          copyBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>Copied!</span>';
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
              <span>Copy</span>
            `;
          }, 2000);
        };

        // Make block relative for positioning
        const htmlBlock = block as HTMLElement;
        htmlBlock.style.position = 'relative';
        htmlBlock.appendChild(copyBtn);

        // Add hover effect
        const mouseEnter = () => {
          copyBtn.style.opacity = '1';
        };
        const mouseLeave = () => {
          copyBtn.style.opacity = '0';
        };

        htmlBlock.onmouseenter = mouseEnter;
        htmlBlock.onmouseleave = mouseLeave;

        // Store handlers for cleanup
        handlersRef.current.push({
          block: htmlBlock,
          mouseEnter,
          mouseLeave,
        });
      });

      isProcessingRef.current = false;
    }, 100);

    // Execute immediately
    processBlocks();

    // Cleanup function
    return () => {
      // Remove all copy buttons
      document.querySelectorAll('.shiki-copy-button').forEach((btn) => btn.remove());

      // Remove event handlers from blocks
      handlersRef.current.forEach(({ block }) => {
        block.onmouseenter = null;
        block.onmouseleave = null;
      });

      // Clear handlers ref
      handlersRef.current = [];
      isProcessingRef.current = false;
    };
  }, [pathname]); // Re-run when pathname changes

  return null;
}
