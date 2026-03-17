'use client';

import type { JSX } from 'react';

import { ChevronRight, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Search } from '@/components/docs/search';
import { ThemeToggle } from '@/components/docs/theme-toggle';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface NavItem {
  title: string;
  href: string;
  items?: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Introduction', href: '/' },
      { title: 'Docs Structure', href: '/structure/' },
      { title: 'Architecture', href: '/architecture/' },
      { title: 'Quick Start', href: '/quick-start/' },
    ],
  },
  {
    title: 'Core Concepts',
    items: [
      { title: 'Core API', href: '/core-api/' },
      { title: 'Events', href: '/events/' },
      { title: 'Streaming API', href: '/streaming/' },
      { title: 'Transport API', href: '/transport/' },
      { title: 'Storage API', href: '/storage/' },
    ],
  },
  {
    title: 'Advanced',
    items: [
      { title: 'Plugin System', href: '/plugins/' },
      { title: 'Middleware', href: '/middleware/' },
      { title: 'React Integration', href: '/react/' },
      { title: 'UI Components', href: '/ui/' },
      { title: 'DevTools', href: '/devtools/' },
      { title: 'Examples', href: '/examples/' },
    ],
  },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps): JSX.Element {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string): boolean => {
    // For root path, only match exactly
    if (href === '/') {
      return pathname === '/' || pathname === '';
    }
    // For other paths, check if pathname starts with href (but not root)
    return pathname === href || pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile header with menu button and search */}
      <div className="bg-background fixed top-0 right-0 left-0 z-50 flex items-center gap-2 border-b px-4 py-2 lg:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="bg-background flex h-10 w-10 shrink-0 items-center justify-center rounded-md border shadow-sm"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="flex-1">
          <Search />
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'bg-docs-nav-bg fixed top-[65px] left-0 z-40 h-[calc(100vh-65px)] w-72 border-r lg:sticky lg:top-0 lg:block lg:h-screen',
          mobileOpen ? 'block' : 'hidden',
          className,
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header - hidden on mobile, visible on desktop */}
          <div className="hidden border-b px-6 py-4 lg:block">
            <Link
              href="/"
              className="text-foreground flex items-center gap-2 font-semibold"
              onClick={() => setMobileOpen(false)}
            >
              <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md">
                K
              </div>
              <span>Kaira Chat</span>
            </Link>
          </div>

          {/* Search - hidden on mobile (shown in header), visible on desktop */}
          <div className="hidden px-4 py-3 lg:block">
            <Search />
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 py-2">
            <div className="space-y-6">
              {NAV_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="text-muted-foreground mb-2 px-2 text-xs font-semibold tracking-wider uppercase">
                    {group.title}
                  </h3>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        {item.items ? (
                          <Collapsible defaultOpen={isActive(item.href)}>
                            <CollapsibleTrigger className="text-foreground hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium transition-colors">
                              <span>{item.title}</span>
                              <ChevronRight className="h-4 w-4 transition-transform duration-200 [&[data-state=open]]:rotate-90" />
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <ul className="mt-1 space-y-0.5 pl-4">
                                {item.items.map((subItem) => (
                                  <li key={subItem.href}>
                                    <Link
                                      href={subItem.href}
                                      onClick={() => setMobileOpen(false)}
                                      className={cn(
                                        'block rounded-md px-2 py-1.5 text-sm transition-colors',
                                        isActive(subItem.href)
                                          ? 'bg-accent text-accent-foreground font-medium'
                                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                                      )}
                                    >
                                      {subItem.title}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </CollapsibleContent>
                          </Collapsible>
                        ) : (
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              'block rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                              isActive(item.href)
                                ? 'bg-accent text-accent-foreground'
                                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                            )}
                          >
                            {item.title}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          {/* Footer */}
          <div className="border-t p-4">
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
}
