import { cn } from '../../lib/cn';
import type * as React from 'react';

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-sm', className)} {...props} />;
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('text-left font-semibold text-slate-700 px-3 py-2 border-b border-slate-200 dark:text-theme-text-primary dark:border-slate-800', className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-2 border-b border-slate-100 dark:border-slate-800', className)} {...props} />;
}
