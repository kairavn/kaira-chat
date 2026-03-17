import type { JSX, ReactNode } from 'react';

import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

import { cn } from '@/lib/utils';

type CalloutType = 'info' | 'warning' | 'error' | 'success';

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
  className?: string;
}

const icons: Record<CalloutType, ReactNode> = {
  info: <Info className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  error: <AlertCircle className="h-5 w-5" />,
  success: <CheckCircle className="h-5 w-5" />,
};

const styles: Record<CalloutType, string> = {
  info: 'bg-blue-50/50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-100',
  warning:
    'bg-amber-50/50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-100',
  error:
    'bg-red-50/50 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-800 dark:text-red-100',
  success:
    'bg-green-50/50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-800 dark:text-green-100',
};

const iconStyles: Record<CalloutType, string> = {
  info: 'text-blue-600 dark:text-blue-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  success: 'text-green-600 dark:text-green-400',
};

/**
 * Callout component for highlighting important information.
 * Supports multiple types (info, warning, error, success) with appropriate icons and styling.
 *
 * @example
 * <Callout type="info" title="Information">
 *   This is an informational callout.
 * </Callout>
 *
 * <Callout type="warning" title="Warning">
 *   This is a warning callout.
 * </Callout>
 */
export function Callout({ type = 'info', title, children, className }: CalloutProps): JSX.Element {
  return (
    <div className={cn('my-6 rounded-lg border px-4 py-4', styles[type], className)}>
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 shrink-0', iconStyles[type])}>{icons[type]}</div>
        <div className="flex-1">
          {title && <h5 className="mb-2 leading-none font-semibold tracking-tight">{title}</h5>}
          <div className="text-sm leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
