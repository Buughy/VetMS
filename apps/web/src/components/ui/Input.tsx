import { cn } from '../../lib/cn';
import type * as React from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className, ...props }: Props) {
  return (
    <input
      className={cn(
        'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400',
        'focus:border-slate-400 focus:ring-2 focus:ring-slate-200',
        'dark:border-slate-700 dark:bg-theme-bg-primary dark:text-theme-text-primary dark:placeholder:text-slate-500 dark:focus:border-slate-600 dark:focus:ring-slate-800',
        className
      )}
      {...props}
    />
  );
}
