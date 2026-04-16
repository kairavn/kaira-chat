'use client';

import type { JSX, MouseEvent } from 'react';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  className?: string;
}

export function TableOfContents({ className }: TableOfContentsProps): JSX.Element {
  const [headings, setHeadings] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const pathname = usePathname();

  // Re-scan headings when pathname changes
  useEffect(() => {
    // Delay to ensure DOM is ready after page transition
    const timer = setTimeout(() => {
      const headingElements = document.querySelectorAll('h2, h3, h4');
      const items: TOCItem[] = Array.from(headingElements)
        .filter((heading) => heading.id) // Only include headings with IDs
        .map((heading) => ({
          id: heading.id,
          text: heading.textContent?.replace('#', '').trim() ?? '',
          level: parseInt(heading.tagName[1] ?? '2'),
        }));
      setHeadings(items);
      setActiveId('');
    }, 150);

    return () => clearTimeout(timer);
  }, [pathname]);

  // Set up intersection observer for scroll spy
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-100px 0px -66%',
        threshold: 0,
      },
    );

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [headings]);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>, id: string): void => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      setActiveId(id);
      window.history.pushState(null, '', `#${id}`);
    }
  };

  if (headings.length === 0) {
    return (
      <div className={cn('hidden xl:block', className)}>
        <div className="sticky top-24">
          <p className="text-muted-foreground mb-3 text-sm font-medium">On this page</p>
          <nav className="text-muted-foreground text-sm">Loading...</nav>
        </div>
      </div>
    );
  }

  return (
    <div
      key={pathname}
      className={cn('hidden xl:block', className)}
    >
      <div className="sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto">
        <p className="text-muted-foreground mb-3 text-sm font-medium">On this page</p>
        <nav>
          <ul className="border-border space-y-1 border-l">
            {headings.map((heading) => (
              <li key={`${pathname}-${heading.id}`}>
                <a
                  href={`#${heading.id}`}
                  onClick={(e) => handleClick(e, heading.id)}
                  className={cn(
                    'block border-l-2 py-1 pr-2 text-sm transition-colors',
                    heading.level === 2 ? 'pl-4' : 'pl-6',
                    activeId === heading.id
                      ? 'border-primary text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground border-transparent',
                  )}
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
