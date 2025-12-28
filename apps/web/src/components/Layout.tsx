import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/cn';
import type * as React from 'react';
import DarkModeToggle from './DarkModeToggle';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const nav = [
    { to: '/', label: 'Dashboard' },
    { to: '/invoice', label: 'New Invoice' },
    { to: '/invoices', label: 'Invoices' },
    { to: '/products', label: 'Products' },
    { to: '/transactions', label: 'Transactions' },
    { to: '/admin', label: 'Admin' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-theme-bg-primary dark:text-theme-text-primary transition-colors">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-theme-bg-secondary">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-slate-900 dark:text-theme-text-primary">VetMS</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Local-first</div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1">
              {nav.map((n) => {
                const active = location.pathname === n.to;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={cn(
                      'rounded-md px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' // Keeping active state high contrast for now
                        : 'text-slate-700 hover:bg-slate-100 dark:text-theme-text-primary dark:hover:bg-slate-800'
                    )}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <DarkModeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
