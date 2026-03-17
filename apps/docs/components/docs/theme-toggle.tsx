'use client';

import type { JSX } from 'react';

import { Laptop, Moon, Sun } from 'lucide-react';

import { useTheme } from '@/components/docs/theme-provider';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps): JSX.Element {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <div className={cn('bg-muted flex items-center gap-1 rounded-lg border p-1', className)}>
      <button
        onClick={() => setTheme('light')}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors',
          theme === 'light'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="Light mode"
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors',
          theme === 'dark'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="Dark mode"
      >
        <Moon className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors',
          theme === 'system'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="System theme"
      >
        <Laptop className="h-4 w-4" />
      </button>
    </div>
  );
}
