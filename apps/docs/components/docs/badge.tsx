import type { HTMLAttributes, JSX } from 'react';
import type { VariantProps } from 'tailwind-variants';

import { tv } from 'tailwind-variants';

import { cn } from '@/lib/utils';

const badgeVariants = tv({
  base: 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
      secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
      destructive:
        'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
      outline: 'text-foreground',
      info: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      success:
        'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
      warning:
        'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
      beta: 'border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
      new: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

/**
 * Badge component for displaying status, labels, and metadata.
 * Supports multiple variants for different semantic meanings.
 *
 * @example
 * <Badge>Default</Badge>
 * <Badge variant="info">Info</Badge>
 * <Badge variant="success">Success</Badge>
 * <Badge variant="beta">Beta</Badge>
 */
function Badge({ className, variant, ...props }: BadgeProps): JSX.Element {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
