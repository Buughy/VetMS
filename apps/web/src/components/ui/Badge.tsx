import { cn } from '../../lib/cn';
import type * as React from 'react';

export default function Badge({
  className,
  variant = 'neutral',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'neutral' | 'success';
}) {
  const styles =
    variant === 'success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900'
      : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-theme-bg-secondary dark:text-theme-text-primary dark:border-slate-700';
  return (
    <span
      className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', styles, className)}
      {...props}
    />
  );
}
