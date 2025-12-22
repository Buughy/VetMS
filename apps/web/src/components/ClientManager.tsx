import * as React from 'react';
import { api } from '../lib/api';
import type { Client } from '../lib/types';
import Button from './ui/Button';
import Input from './ui/Input';
import { Table, Td, Th } from './ui/Table';

export default function ClientManager() {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');

  const [name, setName] = React.useState('');
  const [contactInfo, setContactInfo] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);

  async function refresh() {
    const list = (await api.clients(search)) as Client[];
    setClients(list);
  }

  React.useEffect(() => {
    refresh().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [search]);

  async function upsert() {
    setError(null);
    if (!name.trim()) {
      setError('Client name is required.');
      return;
    }

    const contact = contactInfo.trim();
    const body = {
      name: name.trim(),
      ...(contact ? { contactInfo: contact } : {}),
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.updateClient(editingId, body);
      } else {
        await api.createClient(body);
      }
      setName('');
      setContactInfo('');
      setEditingId(null);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    setError(null);
    setSaving(true);
    try {
      await api.deleteClient(id);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-slate-900 dark:text-theme-text-primary">Clients</div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-theme-bg-secondary">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-400">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-400">Contact Info</label>
            <Input
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Phone, address, notes"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          {editingId && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditingId(null);
                setName('');
                setContactInfo('');
              }}
              disabled={saving}
            >
              Cancel
            </Button>
          )}
          <Button type="button" onClick={upsert} disabled={saving}>
            {editingId ? 'Update Client' : 'Add Client'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-theme-bg-secondary">
        <div className="border-b border-slate-100 p-3 dark:border-slate-800">
          <Input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="overflow-auto">
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Contact Info</Th>
                <Th className="w-[140px]">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, idx) => (
                <tr key={c.id} className={idx % 2 === 0 ? 'bg-white dark:bg-theme-bg-secondary' : 'bg-slate-50 dark:bg-theme-bg-primary/50'}>
                  <Td>{c.name}</Td>
                  <Td>{c.contact_info ?? '—'}</Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="text-sm text-slate-900 underline hover:text-slate-700 dark:text-theme-text-primary dark:hover:text-slate-300"
                        onClick={() => {
                          setEditingId(c.id);
                          setName(c.name);
                          setContactInfo(c.contact_info ?? '');
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-sm text-red-700 underline hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                        onClick={() => remove(c.id)}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  </Td>
                </tr>
              ))
              }
              {
                clients.length === 0 && (
                  <tr>
                    <Td colSpan={3} className="py-8 text-center text-slate-500 dark:text-slate-400">
                      No clients found.
                    </Td>
                  </tr>
                )
              }
            </tbody>
          </Table>
        </div>
      </div>
    </div>
  );
}
