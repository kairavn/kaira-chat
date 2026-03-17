import type { JSX, ReactNode } from 'react';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

interface CardProps {
  /** Card title */
  title: string;
  /** Card description text */
  description: string;
  /** Optional URL for clickable card */
  href?: string;
  /** Optional icon to display */
  icon?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Card component for displaying feature highlights or navigation links.
 * Can be clickable (with href) or static.
 *
 * @example
 * <Card title="Core API" description="Learn about the core API" href="/core-api/" />
 *
 * <Card title="Feature" description="Description text" icon={<Icon />} />
 */
export function Card({ title, description, href, icon, className }: CardProps): JSX.Element {
  const cardContent = (
    <>
      <div className="flex items-start gap-4">
        {icon && (
          <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <h3 className="leading-none font-semibold tracking-tight">
            {title}
            {href && (
              <ArrowUpRight className="ml-1 inline h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </h3>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{description}</p>
        </div>
      </div>
    </>
  );

  const cardClassName = cn(
    'group relative rounded-lg border bg-card p-6 transition-all',
    href && 'cursor-pointer hover:border-primary/50 hover:bg-accent/50 hover:shadow-md',
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cardClassName}
      >
        {cardContent}
      </Link>
    );
  }

  return <div className={cardClassName}>{cardContent}</div>;
}

interface CardGroupProps {
  /** Card elements to display */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Number of columns (responsive) */
  cols?: 2 | 3 | 4;
}

/**
 * CardGroup component for arranging cards in a grid layout.
 * Automatically responsive based on number of columns.
 *
 * @example
 * <CardGroup cols={2}>
 *   <Card ... />
 *   <Card ... />
 * </CardGroup>
 */
export function CardGroup({ children, className, cols = 2 }: CardGroupProps): JSX.Element {
  const colsClass = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return <div className={cn('grid gap-4', colsClass[cols], className)}>{children}</div>;
}
