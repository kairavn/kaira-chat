import type { JSX, ReactNode } from 'react';

import { Sidebar } from '@/components/docs/sidebar';
import { TableOfContents } from '@/components/docs/table-of-contents';
import { ThemeProvider } from '@/components/docs/theme-provider';
import { cn } from '@/lib/utils';

interface DocsLayoutProps {
  children: ReactNode;
  className?: string;
}

export function DocsLayout({ children, className }: DocsLayoutProps): JSX.Element {
  return (
    <ThemeProvider defaultTheme="system">
      <div className={cn('flex min-h-screen', className)}>
        <Sidebar />
        <div className="flex-1 pt-[65px] lg:pt-0 lg:pl-0">
          <main className="flex gap-12 px-4 py-8 lg:px-8">
            <div className="min-w-0 flex-1">
              <article className="prose max-w-3xl">{children}</article>
            </div>
            <div className="hidden w-64 shrink-0 xl:block">
              <TableOfContents />
            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
