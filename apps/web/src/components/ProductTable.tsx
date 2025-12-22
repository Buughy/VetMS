import * as React from 'react';
import { api } from '../lib/api';
import type { Product } from '../lib/types';
import Button from './ui/Button';
import Input from './ui/Input';
import { Table, Td, Th } from './ui/Table';
import { formatRon } from '../lib/money';

type Draft = { name: string; price: string };

export default function ProductTable() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [newProduct, setNewProduct] = React.useState<Draft>({ name: '', price: '' });
  const [csvFile, setCsvFile] = React.useState<File | null>(null);
  const [csvText, setCsvText] = React.useState('');

  async function refresh() {
    const list = (await api.products()) as Product[];
    setProducts(list);
  }

  React.useEffect(() => {
    refresh().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  async function add() {
    setError(null);
    const name = newProduct.name.trim();
    const price = Number(newProduct.price);
    if (!name || !Number.isFinite(price)) {
      setError('Please enter valid name/price.');
      return;
    }
    setSaving(true);
    try {
      await api.upsertProduct({ name, price });
      setNewProduct({ name: '', price: '' });
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function update(id: number, patch: Partial<Product>) {
    const current = products.find((p) => p.id === id);
    if (!current) return;
    const next = { ...current, ...patch };
    setProducts((prev) => prev.map((p) => (p.id === id ? next : p)));
    try {
      await api.updateProduct(id, { name: next.name, price: next.price });
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update');
      await refresh();
    }
  }

  async function remove(id: number) {
    setSaving(true);
    try {
      await api.deleteProduct(id);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  async function importCsv() {
    if (!csvFile) return;
    setSaving(true);
    setError(null);
    try {
      const text = await csvFile.text();
      await api.importProductsCsv(text);
      await refresh();
      setCsvFile(null);
      setCsvText('');
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? `${e.message}. Try saving the file locally (not cloud-only) or use the paste box below.`
          : 'Failed to import CSV'
      );
    } finally {
      setSaving(false);
    }
  }

  async function importCsvFromText() {
    const text = csvText.trim();
    if (!text) return;
    setSaving(true);
    setError(null);
    try {
      await api.importProductsCsv(text);
      await refresh();
      setCsvText('');
      setCsvFile(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to import CSV');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-slate-900 dark:text-theme-text-primary">Products</div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-theme-bg-secondary">
        <div className="border-b border-slate-100 p-3 dark:border-slate-800">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <Input placeholder="Product name" value={newProduct.name} onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))} />
            <Input placeholder="Price (RON)" inputMode="decimal" value={newProduct.price} onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))} />
            <Button onClick={add} disabled={saving}>Add / Update</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept=".csv,text/csv,text/tab-separated-values"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <Button onClick={importCsv} disabled={saving || !csvFile} variant="secondary">
              Import CSV
            </Button>
            <div className="text-xs text-slate-500 dark:text-slate-400">CSV columns: name, price (comma, tab, or semicolon separated)</div>
          </div>
          <div className="mt-3 grid gap-2">
            <textarea
              className="w-full rounded border border-slate-200 p-2 text-sm focus:border-slate-400 focus:outline-none dark:bg-theme-bg-primary dark:border-slate-700 dark:text-theme-text-primary"
              rows={4}
              placeholder="Or paste CSV/TSV here (name, price)"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={importCsvFromText} disabled={saving || !csvText.trim()} variant="secondary">
                Import Pasted CSV
              </Button>
              <div className="text-xs text-slate-500 dark:text-slate-400">Tip: You can copy/paste from Excel/Sheets.</div>
            </div>
          </div>
        </div>

        <div className="overflow-auto">
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Price</Th>
                <Th className="w-[140px]">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => (
                <tr key={p.id} className={idx % 2 === 0 ? 'bg-white dark:bg-theme-bg-secondary' : 'bg-slate-50 dark:bg-theme-bg-primary/50'}>
                  <Td>
                    <Input value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} />
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1">
                      <Input
                        inputMode="decimal"
                        value={String(p.price)}
                        onChange={(e) => update(p.id, { price: Number(e.target.value) })}
                      />
                      <div className="text-xs text-slate-500 dark:text-slate-400">{formatRon(p.price)}</div>
                    </div>
                  </Td>
                  <Td>
                    <Button variant="danger" onClick={() => remove(p.id)} disabled={saving}>
                      Delete
                    </Button>
                  </Td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <Td colSpan={3} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No products yet.
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
