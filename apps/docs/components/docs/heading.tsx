'use client';

import type { JSX, ReactNode } from 'react';

import { Link2 } from 'lucide-react';

import { cn, slugify } from '@/lib/utils';

interface HeadingProps {
  as: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  children: ReactNode;
  className?: string;
  id?: string;
}

export function Heading({ as: Component, children, className, id }: HeadingProps): JSX.Element {
  const generatedId = id ?? (typeof children === 'string' ? slugify(children) : undefined);

  return (
    <Component
      id={generatedId}
      className={cn(
        'group text-foreground scroll-mt-24 font-semibold tracking-tight',
        Component === 'h1' && 'text-3xl md:text-4xl',
        Component === 'h2' && 'border-border mt-10 border-b pb-2 text-2xl',
        Component === 'h3' && 'mt-8 text-xl',
        Component === 'h4' && 'mt-6 text-lg',
        Component === 'h5' && 'mt-4 text-base',
        Component === 'h6' && 'mt-4 text-sm',
        className,
      )}
    >
      {children}
      {generatedId && Component !== 'h1' && (
        <a
          href={`#${generatedId}`}
          className="text-muted-foreground hover:bg-accent hover:text-foreground ml-2 inline-flex items-center justify-center rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          aria-label={`Link to ${generatedId}`}
        >
          <Link2 className="h-4 w-4" />
        </a>
      )}
    </Component>
  );
}
