import type { JSX, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface StepsProps {
  children: ReactNode;
  className?: string;
}

export function Steps({ children, className }: StepsProps): JSX.Element {
  return (
    <div className={cn('relative', className)}>
      <div className="bg-border absolute top-0 bottom-0 left-4 w-px" />
      <div className="space-y-8">{children}</div>
    </div>
  );
}

interface StepProps {
  number: number;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Step({ number, title, children, className }: StepProps): JSX.Element {
  return (
    <div className={cn('relative pl-12', className)}>
      <div className="bg-primary text-primary-foreground ring-background absolute top-0 left-0 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ring-4">
        {number}
      </div>
      <div>
        <h3 className="text-lg leading-none font-semibold tracking-tight">{title}</h3>
        <div className="text-muted-foreground mt-3">{children}</div>
      </div>
    </div>
  );
}
