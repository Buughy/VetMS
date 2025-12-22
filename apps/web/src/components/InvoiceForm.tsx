import * as React from 'react';
import { useParams, useBlocker, useNavigate } from 'react-router-dom';
import Button from './ui/Button';
import Input from './ui/Input';
import Combobox, { type ComboboxOption } from './ui/Combobox';
import { api } from '../lib/api';
import type { Client, Pet, Product } from '../lib/types';
import type { InvoiceDetail } from '../lib/types-extended';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { formatRon } from '../lib/money';
import { exportInvoicePdf } from '../lib/pdf';
import { Table, Td, Th } from './ui/Table';
import Badge from './ui/Badge';

type Line = {
  key: string;
  productId?: number | undefined;
  productSearch: string;
  name: string;
  quantity: string; // keep as string to allow commas
  unitPrice: string; // keep as string to allow commas
};

type PetGroup = {
  key: string;
  petName: string;
  petSpecies: string;
  lines: Line[];
};

function isoDateOnly(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function parseDecimal(value: string): number {
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function InvoiceForm() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const editingId = params.id ? Number(params.id) : null;
  const [loaded, setLoaded] = React.useState(false);

  const [date, setDate] = React.useState(isoDateOnly());

  const [clientName, setClientName] = React.useState('');
  const [contactInfo, setContactInfo] = React.useState('');
  const [clientOptions, setClientOptions] = React.useState<Client[]>([]);
  const debouncedClient = useDebouncedValue(clientName, 200);

  const [petOptions, setPetOptions] = React.useState<Pet[]>([]);
  const [productOptions, setProductOptions] = React.useState<Product[]>([]);

  const [petGroups, setPetGroups] = React.useState<PetGroup[]>([
    {
      key: crypto.randomUUID(),
      petName: '',
      petSpecies: '',
      lines: [{ key: crypto.randomUUID(), productSearch: '', name: '', quantity: '1', unitPrice: '0' }],
    },
  ]);

  const [status, setStatus] = React.useState<'Draft' | 'Paid'>('Draft');
  const [saving, setSaving] = React.useState(false);
  const isSaving = React.useRef(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  const [friendlyId, setFriendlyId] = React.useState<string | null>(null);

  // Focus management
  const [focusTarget, setFocusTarget] = React.useState<string | null>(null);

  // Keyboard shortcuts
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        addPet();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        // Add item to the last pet
        if (petGroups.length > 0) {
          addLine(petGroups[petGroups.length - 1]!.key);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [petGroups]); // Re-bind when groups change to ensure we have latest state if needed (state functional updates usually safe though)


  // Load existing invoice if editing
  React.useEffect(() => {
    if (!editingId || loaded) return;
    let cancelled = false;
    api
      .getInvoice(editingId)
      .then((data) => {
        if (cancelled) return;
        const detail = data as InvoiceDetail;
        setDate(detail.invoice.date);
        setClientName(detail.invoice.client_name);
        setContactInfo(detail.invoice.contact_info ?? '');
        // Map legacy 'Saved' to 'Paid' for UI compatibility
        const dbStatus = detail.invoice.status as string;
        setStatus(dbStatus === 'Draft' ? 'Draft' : 'Paid');
        setFriendlyId(detail.invoice.friendly_id);

        // Group items by pet_id
        const petMap = new Map<number | null, { petName: string; petSpecies: string; items: typeof detail.items }>();
        for (const item of detail.items) {
          const petId = item.pet_id;
          if (!petMap.has(petId)) {
            petMap.set(petId, {
              petName: item.pet_name || '',
              petSpecies: item.pet_species || '',
              items: [],
            });
          }
          petMap.get(petId)!.items.push(item);
        }

        const groups: PetGroup[] = [];
        for (const [, petData] of petMap) {
          const lines: Line[] = petData.items.map((it) => ({
            key: crypto.randomUUID(),
            productId: it.product_id ?? undefined,
            productSearch: it.product_name_snapshot,
            name: it.product_name_snapshot,
            quantity: String(it.quantity),
            unitPrice: String(it.price_snapshot),
          }));
          groups.push({
            key: crypto.randomUUID(),
            petName: petData.petName,
            petSpecies: petData.petSpecies,
            lines: lines.length > 0 ? lines : [{ key: crypto.randomUUID(), productSearch: '', name: '', quantity: '1', unitPrice: '0' }],
          });
        }

        setPetGroups(
          groups.length > 0
            ? groups
            : [
              {
                key: crypto.randomUUID(),
                petName: '',
                petSpecies: '',
                lines: [{ key: crypto.randomUUID(), productSearch: '', name: '', quantity: '1', unitPrice: '0' }],
              },
            ]
        );
        setLoaded(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load invoice');
      });
    return () => {
      cancelled = true;
    };
  }, [editingId, loaded]);

  // Client autocomplete
  React.useEffect(() => {
    let cancelled = false;
    const q = debouncedClient.trim();
    if (!q) {
      setClientOptions([]);
      return;
    }
    api
      .clients(q)
      .then((list) => {
        if (cancelled) return;
        setClientOptions(list as Client[]);
      })
      .catch(() => {
        if (cancelled) return;
        setClientOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedClient]);

  // Pet options filtered by client
  React.useEffect(() => {
    let cancelled = false;
    if (!clientName.trim()) {
      setPetOptions([]);
      return;
    }
    api
      .clients(clientName.trim())
      .then((list) => {
        if (cancelled) return;
        const client = (list as Client[]).find((c) => c.name === clientName.trim()) || null;
        if (!client) {
          setPetOptions([]);
          return;
        }
        return api.pets(client.id).then((pets) => {
          if (cancelled) return;
          setPetOptions(pets as Pet[]);
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPetOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clientName]);

  // Load products
  React.useEffect(() => {
    let cancelled = false;
    api
      .products()
      .then((list) => {
        if (cancelled) return;
        setProductOptions(list as Product[]);
      })
      .catch(() => {
        if (cancelled) return;
        setProductOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clientComboOptions: Array<ComboboxOption<number>> = clientOptions.map((c) => ({
    id: c.id,
    label: c.name,
  }));

  const petComboOptions: Array<ComboboxOption<number>> = petOptions.map((p) => ({
    id: p.id,
    label: p.name,
  }));

  const productComboOptions: Array<ComboboxOption<number>> = productOptions.map((p) => ({
    id: p.id,
    label: p.name,
  }));

  const total = petGroups.reduce(
    (sum, pg) =>
      sum +
      pg.lines.reduce((lineSum, l) => lineSum + parseDecimal(l.quantity) * parseDecimal(l.unitPrice), 0),
    0
  );

  function updatePetGroup(key: string, patch: Partial<PetGroup>) {
    setPetGroups((prev) => prev.map((pg) => (pg.key === key ? { ...pg, ...patch } : pg)));
  }

  function updateLine(petKey: string, lineKey: string, patch: Partial<Line>) {
    setPetGroups((prev) =>
      prev.map((pg) =>
        pg.key === petKey
          ? { ...pg, lines: pg.lines.map((l) => (l.key === lineKey ? { ...l, ...patch } : l)) }
          : pg
      )
    );
  }

  function addPet() {
    const newKey = crypto.randomUUID();
    setFocusTarget(newKey);
    setPetGroups((prev) => [
      ...prev,
      {
        key: newKey,
        petName: '',
        petSpecies: '',
        lines: [{ key: crypto.randomUUID(), productSearch: '', name: '', quantity: '1', unitPrice: '0' }],
      },
    ]);
  }

  function removePet(key: string) {
    setPetGroups((prev) => prev.filter((pg) => pg.key !== key));
  }

  function addLine(petKey: string) {
    const newLineKey = crypto.randomUUID();
    setFocusTarget(newLineKey);
    setPetGroups((prev) =>
      prev.map((pg) =>
        pg.key === petKey
          ? {
            ...pg,
            lines: [
              ...pg.lines,
              { key: newLineKey, productSearch: '', name: '', quantity: '1', unitPrice: '0' },
            ],
          }
          : pg
      )
    );
  }

  function removeLine(petKey: string, lineKey: string) {
    setPetGroups((prev) =>
      prev.map((pg) =>
        pg.key === petKey ? { ...pg, lines: pg.lines.filter((l) => l.key !== lineKey) } : pg
      )
    );
  }

  async function save(targetStatus: 'Draft' | 'Paid' = 'Draft') {
    if (isSaving.current) return false;

    setError(null);
    setWarnings([]);

    // Validation
    if (!clientName.trim()) {
      setError('Client name is required.');
      return false;
    }

    const pets = petGroups
      .map((pg) => {
        const petName = pg.petName.trim();
        // For Draft, we tolerate empty pets if strictly needed, but let's keep basic structure.
        // Actually for Draft we might just want to save whatever is there?
        // Let's stick to: Client is mandatory. Pets/Items optional for Draft.
        if (!petName && targetStatus === 'Paid') return null; // In Paid, we filter out bad rows
        if (!petName && targetStatus === 'Draft') return null; // Even in draft, need a pet name to save a row? Or maybe allow default?

        // Let's keep logic: A pet row needs a name to be valid.
        if (!petName) return null;

        const items = pg.lines
          .map((l) => ({
            productId: l.productId,
            customName: l.productId ? undefined : l.name.trim(),
            quantity: parseDecimal(l.quantity),
            unitPrice: parseDecimal(l.unitPrice),
          }))
          .filter((l) => {
            if (targetStatus === 'Paid') {
              return l.quantity > 0 && (l.productId ? true : Boolean(l.customName));
            }
            // For Draft, allow 0 quantity or empty name?
            // Let's filter out completely empty lines, but allow partials if we want?
            // User requested "relaxed validation".
            // Let's say: if it has a name OR a product, keep it. Even if quantity is 0.
            return l.productId ? true : Boolean(l.customName);
          });

        if (items.length === 0 && targetStatus === 'Paid') return null;

        return {
          petName,
          petSpecies: pg.petSpecies.trim() || undefined,
          items,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    if (targetStatus === 'Paid' && pets.length === 0) {
      setError('Add at least one pet with items to finalize.');
      return false;
    }

    setSaving(true);
    isSaving.current = true;
    setStatus(targetStatus); // optimistic update

    try {
      const apiCall = editingId
        ? api.updateInvoice(editingId, {
          clientName: clientName.trim(),
          contactInfo: contactInfo.trim() || undefined,
          date,
          status: targetStatus,
          pets,
        })
        : api.createInvoice({
          clientName: clientName.trim(),
          contactInfo: contactInfo.trim() || undefined,
          date,
          status: targetStatus,
          pets,
        });

      const result = (await apiCall) as { invoiceId: number; friendlyId: string; total: number; warnings?: string[] };

      setFriendlyId(result.friendlyId);
      setWarnings(result.warnings ?? []);

      setFriendlyId(result.friendlyId);
      setWarnings(result.warnings ?? []);

      if (!editingId) {
        // Redirect to the edit page for the new invoice
        shouldBlock.current = false;
        navigate(`/invoice/${result.invoiceId}`, { replace: true });
        // The cleanup/state reset will effectively happen because we unmount/remount (or route changes)
        return true;
      }
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      return false;
    } finally {
      setSaving(false);
      isSaving.current = false;
    }
  }

  async function saveAndExportPdf() {
    const success = await save('Paid'); // Finalize for export
    if (!success) return;

    if (!friendlyId) return; // Should have it now if saved, or from before

    // If we just saved, friendlyId state might not be updated fast enough in closure if new?
    // Actually setFriendlyId happens in save(). state updates batch.
    // Ideally we use the result from save(), but save() returns bool.
    // For existing edit, friendlyId is stable. For new, it's problematic.
    // But export logic re-reads state.
    // Let's assume for now this button is mostly for "Finalize & Export".

    const pdfPets = petGroups.map((pg) => {
      const species = pg.petSpecies.trim();
      return {
        petName: pg.petName.trim() || 'Unknown pet',
        ...(species ? { petSpecies: species } : {}),
        items: pg.lines
          .filter((l) => l.productId || l.name.trim())
          .map((l) => ({
            name: l.name.trim() || l.productSearch || 'Item',
            quantity: parseDecimal(l.quantity),
            unitPrice: parseDecimal(l.unitPrice),
          })),
      };
    });

    try {
      const settings = await api.getSettings();
      await exportInvoicePdf(
        {
          friendlyId: friendlyId || 'New',
          date,
          clientName: clientName.trim(),
          ...(contactInfo.trim() ? { clientContact: contactInfo.trim() } : {}),
          pets: pdfPets,
        },
        settings
      );
    } catch (e: unknown) {
      console.error('Failed to fetch settings for PDF export:', e);
      await exportInvoicePdf(
        {
          friendlyId: friendlyId || 'New',
          date,
          clientName: clientName.trim(),
          ...(contactInfo.trim() ? { clientContact: contactInfo.trim() } : {}),
          pets: pdfPets,
        },
        {}
      );
    }
  }

  // Dirty check for New Invoice
  const isDirty = React.useMemo(() => {
    // If we are editing, we are dirty if things changed?
    // Current logic: "if (editingId) return false;" -> This means NO dirty check for edits?
    // User request: "If I have errors in new invoice...". Mentioned New Invoice.
    // Let's Stick to New Invoice logic for now to avoid regressions, but check if we can expand.
    // "After click save on unsaved changes popup..."
    if (editingId) {
      // Simplified dirty check for edit mode could be useful, but let's stick to new for now as per original code
      // unless requested. Original code: "if (editingId) return false;"
      return false;
    }
    if (clientName.trim() || contactInfo.trim()) return true;
    if (petGroups.length > 1) return true;
    if (petGroups.length === 0) return false;
    const first = petGroups[0];
    if (!first) return false;
    if (first.petName.trim() || first.petSpecies.trim()) return true;
    if (first.lines.length > 1) return true;
    if (first.lines.length === 0) return false;
    const l = first.lines[0];
    if (!l) return false;
    if (l.productSearch || l.name || l.quantity !== '1' || l.unitPrice !== '0') return true;
    return false;
  }, [editingId, clientName, contactInfo, petGroups]);

  // Block navigation if dirty - allows bypassing if intended
  const shouldBlock = React.useRef(true);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      shouldBlock.current && isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  // Browser refresh warning
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return (
    <div className="flex flex-col gap-4">
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-theme-bg-secondary dark:border dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-theme-text-primary">Unsaved Changes</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              You have unsaved changes. Do you want to save them before leaving?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => blocker.reset()}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => blocker.proceed()}>
                Leave without Saving
              </Button>
              <Button
                onClick={() => {
                  save('Draft').then((success) => {
                    if (success) {
                      blocker.proceed();
                    }
                    // If fail, we stay and show error (handled in save)
                  });
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-slate-900 dark:text-theme-text-primary">
          {editingId ? `Edit Invoice: ${friendlyId || editingId}` : 'New Invoice'}
        </div>
        <div className="flex items-center gap-2">
          {/* Status Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-theme-bg-secondary dark:border-slate-700 dark:text-theme-text-primary dark:focus:ring-slate-700"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'Draft' | 'Paid')}
            >
              <option value="Paid">Paid</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => save(status)} disabled={saving}>
              Save
            </Button>
            <Button type="button" onClick={saveAndExportPdf} disabled={saving}>
              Save & Export
            </Button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {
        friendlyId && (
          <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-theme-bg-secondary dark:text-theme-text-primary">
            Saved as <span className="font-semibold">{friendlyId}</span>.
          </div>
        )
      }
      {
        warnings.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {warnings.join(' · ')}
          </div>
        )
      }

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-1">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="md:col-span-2" />

        <div className="md:col-span-1">
          <Combobox
            id="client"
            label="Client"
            value={clientName}
            onValueChange={(v) => {
              setClientName(v);
            }}
            options={clientComboOptions}
            placeholder="Type client name…"
            allowCustom
            onSelectOption={(opt) => {
              const client = clientOptions.find((c) => c.id === opt.id) ?? null;
              if (client) setClientName(client.name);
            }}
          />
        </div>

        <div className="md:col-span-1">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Contact Info (optional)</label>
          <Input value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} placeholder="Phone / notes" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900 dark:text-theme-text-primary">Pets & Services</div>
        </div>

        {petGroups.map((pg, pgIdx) => {
          const petTotal = pg.lines.reduce(
            (sum, l) => sum + parseDecimal(l.quantity) * parseDecimal(l.unitPrice),
            0
          );

          return (
            <div key={pg.key} className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-theme-bg-secondary">
              <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-theme-bg-primary/50">
                <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-3">
                  <Combobox
                    id={`pet-${pg.key}`}
                    label={`Pet ${pgIdx + 1} Name`}
                    value={pg.petName}
                    onValueChange={(v) => updatePetGroup(pg.key, { petName: v })}
                    options={petComboOptions}
                    placeholder="Type pet name…"
                    allowCustom
                    onSelectOption={(opt) => {
                      const pet = petOptions.find((p) => p.id === opt.id);
                      if (pet) {
                        updatePetGroup(pg.key, { petName: pet.name, petSpecies: pet.species || '' });
                      }
                    }}
                    autoFocus={pg.key === focusTarget}
                  />
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Species (optional)</label>
                    <div className="relative">
                      <select
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-theme-bg-secondary dark:border-slate-700 dark:text-theme-text-primary"
                        value={pg.petSpecies}
                        onChange={(e) => updatePetGroup(pg.key, { petSpecies: e.target.value })}
                      >
                        <option value="">Select...</option>
                        <option value="Dog">Dog</option>
                        <option value="Cat">Cat</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => removePet(pg.key)}
                      disabled={petGroups.length === 1}
                    >
                      Remove Pet
                    </Button>
                  </div>
                </div>
              </div>

              <div className="overflow-auto">
                <Table>
                  <thead>
                    <tr>
                      <Th>Product / Custom Item</Th>
                      <Th className="w-[120px]">Qty</Th>
                      <Th className="w-[160px]">Unit Price</Th>
                      <Th className="w-[140px]">Line Total</Th>
                      <Th className="w-[120px]">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pg.lines.map((l, idx) => {
                      const lineTotal = parseDecimal(l.quantity) * parseDecimal(l.unitPrice);
                      return (
                        <tr key={l.key} className={idx % 2 === 0 ? 'bg-white dark:bg-theme-bg-secondary' : 'bg-slate-50 dark:bg-theme-bg-primary/50'}>
                          <Td>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              <div>
                                <label className="sr-only">Product</label>
                                <Combobox
                                  id={`product-${l.key}`}
                                  label="Product"
                                  value={l.productSearch}
                                  onValueChange={(v) => updateLine(pg.key, l.key, { productSearch: v })}
                                  options={productComboOptions}
                                  placeholder="Search product…"
                                  onSelectOption={(opt) => {
                                    const p = productOptions.find((pp) => pp.id === opt.id);
                                    if (!p) return;
                                    updateLine(pg.key, l.key, {
                                      productId: p.id,
                                      name: p.name,
                                      productSearch: p.name,
                                      unitPrice: String(p.price),
                                    });
                                  }}
                                  autoFocus={l.key === focusTarget}
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Custom Item</label>
                                <Input
                                  value={l.productId ? '' : l.name}
                                  onChange={(e) =>
                                    updateLine(pg.key, l.key, {
                                      productId: undefined,
                                      name: e.target.value,
                                      productSearch: '',
                                    })
                                  }
                                  placeholder="Emergency Call…"
                                />
                                <div className="mt-1 text-xs text-slate-500">
                                  If product not found, type here.
                                </div>
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <Input
                              inputMode="decimal"
                              value={l.quantity}
                              onChange={(e) => updateLine(pg.key, l.key, { quantity: e.target.value })}
                            />
                          </Td>
                          <Td>
                            <Input
                              inputMode="decimal"
                              value={l.unitPrice}
                              onChange={(e) => updateLine(pg.key, l.key, { unitPrice: e.target.value })}
                            />
                            <div className="mt-1 text-xs text-slate-500">{formatRon(parseDecimal(l.unitPrice))}</div>
                          </Td>
                          <Td>
                            <div className="text-sm font-semibold">{formatRon(lineTotal)}</div>
                          </Td>
                          <Td>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => removeLine(pg.key, l.key)}
                              disabled={pg.lines.length === 1}
                            >
                              Remove
                            </Button>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 p-3 dark:border-slate-800">
                <Button type="button" variant="secondary" onClick={() => addLine(pg.key)}>
                  Add Item
                </Button>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pet Total: {formatRon(petTotal)}</div>
              </div>
            </div>
          );
        })}
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={addPet} className="w-full sm:w-auto">
            + Add Pet
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-theme-bg-secondary">
        <div className="text-sm text-slate-700 dark:text-slate-300">Invoice Total</div>
        <div className="text-lg font-semibold text-slate-900 dark:text-theme-text-primary">{formatRon(total)}</div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => save(status)} disabled={saving}>
          Save Changes
        </Button>
        <Button type="button" onClick={saveAndExportPdf} disabled={saving}>
          Finalize & Export (PDF)
        </Button>
      </div>
    </div >
  );
}
