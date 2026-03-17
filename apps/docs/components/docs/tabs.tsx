'use client';

import type { JSX, ReactNode } from 'react';

import {
  Tabs as UITabs,
  TabsContent as UITabsContent,
  TabsList as UITabsList,
  TabsTrigger as UITabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface TabsProps {
  children: ReactNode;
  defaultValue?: string;
  className?: string;
}

export function Tabs({ children, defaultValue, className }: TabsProps): JSX.Element {
  return (
    <UITabs
      defaultValue={defaultValue}
      className={className}
    >
      {children}
    </UITabs>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps): JSX.Element {
  return (
    <UITabsList
      className={cn('w-full justify-start rounded-lg border-b bg-transparent p-0', className)}
    >
      {children}
    </UITabsList>
  );
}

interface TabProps {
  value: string;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Tab({ value, title, children, className }: TabProps): JSX.Element {
  return (
    <>
      <UITabsTrigger
        value={value}
        className={cn(
          'text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground relative rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none',
        )}
      >
        {title}
      </UITabsTrigger>
      <UITabsContent
        value={value}
        className={cn('bg-card mt-4 rounded-lg border p-4', className)}
      >
        {children}
      </UITabsContent>
    </>
  );
}
