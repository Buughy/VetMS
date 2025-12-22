import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { InvoiceSummary } from '../lib/types';
import type { InvoiceDetail } from '../lib/types-extended';
import { formatRon } from '../lib/money';
import Badge from './ui/Badge';
import { Table, Td, Th } from './ui/Table';
import { exportInvoicePdf } from '../lib/pdf';

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default function InvoiceList() {
  const [invoices, setInvoices] = React.useState<InvoiceSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    let cancelled = false;
    api
      .allInvoices()
      .then((data) => {
        if (cancelled) return;
        setInvoices(data as InvoiceSummary[]);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openInvoice(id: number) {
    navigate(`/invoice/${id}`);
  }

  async function downloadInvoice(id: number) {
    setError(null);
    setDownloadingId(id);
    try {
      const [detail, settings] = await Promise.all([api.getInvoice(id), api.getSettings()]);
      const d = detail as InvoiceDetail;

      const petMap = new Map<number | null, { petName: string; petSpecies?: string; items: Array<{ name: string; quantity: number; unitPrice: number }> }>();

      for (const it of d.items) {
        const petId = it.pet_id;
        if (!petMap.has(petId)) {
          const species = it.pet_species || undefined;
          petMap.set(petId, {
            petName: it.pet_name || 'Unknown pet',
            ...(species ? { petSpecies: species } : {}),
            items: [],
          });
        }
        petMap.get(petId)!.items.push({
          name: it.product_name_snapshot,
          quantity: it.quantity,
          unitPrice: it.price_snapshot,
        });
      }

      await exportInvoicePdf(
        {
          friendlyId: d.invoice.friendly_id,
          date: d.invoice.date,
          clientName: d.invoice.client_name,
          pets: Array.from(petMap.values()),
        },
        settings
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  }

  async function deleteInvoice(id: number) {
    if (!window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }
    setError(null);
    try {
      await api.deleteInvoice(id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete invoice');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-slate-900 dark:text-theme-text-primary">All Invoices</div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-theme-bg-secondary">
        <div className="overflow-auto">
          <Table>
            <thead>
              <tr>
                <Th>Invoice ID</Th>
                <Th>Date</Th>
                <Th>Client / Pet</Th>
                <Th>Total</Th>
                <Th>Status</Th>
                <Th className="w-[160px]">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, idx) => (
                <tr key={inv.id} className={idx % 2 === 0 ? 'bg-white dark:bg-theme-bg-secondary' : 'bg-slate-50 dark:bg-theme-bg-primary/50'}>
                  <Td className="font-medium">{inv.friendly_id}</Td>
                  <Td>{inv.date}</Td>
                  <Td>
                    {inv.client_name}
                  </Td>
                  <Td className="font-semibold">{formatRon(inv.total_amount)}</Td>
                  <Td>
                    <Badge variant={inv.status === 'Draft' ? 'neutral' : 'success'}>
                      {inv.status}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openInvoice(inv.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-theme-bg-secondary dark:text-theme-text-primary dark:hover:bg-theme-bg-primary"
                        aria-label="View / Edit"
                        title="View / Edit"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadInvoice(inv.id)}
                        disabled={downloadingId === inv.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-theme-bg-secondary dark:text-theme-text-primary dark:hover:bg-theme-bg-primary"
                        aria-label="Download"
                        title="Download"
                      >
                        <DownloadIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteInvoice(inv.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-theme-bg-secondary dark:text-red-400 dark:hover:bg-red-900/20"
                        aria-label="Delete"
                        title="Delete"
                      >
                        <DeleteIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <Td colSpan={6} className="py-8 text-center text-slate-500">
                    No invoices yet.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </div>
    </div>
  );
}
