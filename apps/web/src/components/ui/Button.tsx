import { cn } from '../../lib/cn';
import type * as React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export default function Button({ className, variant = 'primary', ...props }: Props) {
  const base =
    'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const styles: Record<NonNullable<Props['variant']>, string> = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200',
    secondary: 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 dark:bg-theme-bg-secondary dark:text-theme-text-primary dark:border-slate-700 dark:hover:bg-theme-bg-primary',
    ghost: 'bg-transparent text-slate-900 hover:bg-slate-100 dark:text-theme-text-primary dark:hover:bg-theme-bg-secondary',
    danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600',
  };
  return <button className={cn(base, styles[variant], className)} {...props} />;
}
