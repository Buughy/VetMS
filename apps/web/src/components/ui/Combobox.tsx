import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';

export type ComboboxOption<TId extends string | number> = {
  id: TId;
  label: string;
};

type Props<TId extends string | number> = {
  id?: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<ComboboxOption<TId>>;
  placeholder?: string;
  onSelectOption?: (opt: ComboboxOption<TId>) => void;
  allowCustom?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
};

export default function Combobox<TId extends string | number>({
  id,
  label,
  value,
  onValueChange,
  options,
  placeholder,
  onSelectOption,
  allowCustom,
  disabled,
  autoFocus,
}: Props<TId>) {
  const listboxId = id ? `${id}-listbox` : `${label}-listbox`;
  const [open, setOpen] = React.useState<boolean>(false);
  const [activeIndex, setActiveIndex] = React.useState<number>(0);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const [coords, setCoords] = React.useState({ top: 0, left: 0, width: 0 });

  const filtered = React.useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, value]);

  // Handle outside clicks
  React.useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!open) return;
      // If clicking inside the input, do nothing (handled by input events)
      if (rootRef.current?.contains(e.target as Node)) return;

      // If clicking inside the portal dropdown (we need a way to detect this since it's in body)
      // Convention: check if target is inside the listbox element
      const listbox = document.getElementById(listboxId);
      if (listbox?.contains(e.target as Node)) return;

      setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open, listboxId]);

  // Update position when opening
  React.useEffect(() => {
    if (open && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY, // Actually for fixed we use rect.bottom, but let's stick to fixed
        left: rect.left,
        width: rect.width,
      });
    }
  }, [open, value, filtered.length]);

  // Close on scroll/resize to avoid detachment
  React.useEffect(() => {
    if (!open) return;
    function onScrollOrResize(e: Event) {
      // If we are scrolling inside the listbox, don't close
      const listbox = document.getElementById(listboxId);
      if (e.type === 'scroll' && listbox && (e.target === listbox || listbox.contains(e.target as Node))) {
        return;
      }
      setOpen(false);
    }
    window.addEventListener('scroll', onScrollOrResize, { capture: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, { capture: true });
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, listboxId]);

  function commitSelection(opt: ComboboxOption<TId>) {
    onValueChange(opt.label);
    onSelectOption?.(opt);
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }

    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i: number) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i: number) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const opt = filtered[activeIndex];
      if (opt) {
        e.preventDefault();
        commitSelection(opt);
      } else if (allowCustom) {
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-1" ref={rootRef}>
      <label className="text-xs font-medium text-slate-700 dark:text-theme-text-primary">{label}</label>
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm',
            'focus:border-slate-400 focus:ring-2 focus:ring-slate-200',
            'dark:border-slate-700 dark:bg-theme-bg-primary dark:text-theme-text-primary dark:placeholder:text-slate-500 dark:focus:border-slate-600 dark:focus:ring-slate-800',
            disabled && 'opacity-60'
          )}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          autoComplete="off"
          autoFocus={autoFocus}
        />

        {open && filtered.length > 0 && createPortal(
          <div
            id={listboxId}
            role="listbox"
            style={{
              position: 'fixed',
              top: inputRef.current ? inputRef.current.getBoundingClientRect().bottom + 4 : 0,
              left: inputRef.current ? inputRef.current.getBoundingClientRect().left : 0,
              width: inputRef.current ? inputRef.current.getBoundingClientRect().width : 'auto',
            }}
            className="z-[9999] max-h-56 overflow-auto rounded-md border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-theme-bg-secondary"
          >
            {filtered.map((opt, idx) => (
              <button
                type="button"
                key={String(opt.id)}
                role="option"
                aria-selected={idx === activeIndex}
                className={cn(
                  'block w-full text-left px-3 py-2 text-sm',
                  idx === activeIndex ? 'bg-slate-100 dark:bg-theme-bg-primary' : 'bg-white dark:bg-theme-bg-secondary',
                  'hover:bg-slate-100 dark:hover:bg-theme-bg-primary',
                  'text-slate-900 dark:text-theme-text-primary'
                )}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
                onClick={() => commitSelection(opt)}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
