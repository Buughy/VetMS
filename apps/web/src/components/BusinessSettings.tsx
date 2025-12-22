import * as React from 'react';
import { api } from '../lib/api';
import type { Settings } from '../lib/types-extended';
import Button from './ui/Button';
import Input from './ui/Input';
import ThemeSettings from './ThemeSettings';

export default function BusinessSettings() {
  const [settings, setSettings] = React.useState<Settings>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'business' | 'theme'>('business');

  React.useEffect(() => {
    let cancelled = false;
    api
      .getSettings()
      .then((data) => {
        if (cancelled) return;
        setSettings(data as Settings);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        await api.updateSetting(key, value);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function update(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('business')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'business'
            ? 'border-b-2 border-slate-900 text-slate-900 dark:border-theme-text-primary dark:text-theme-text-primary'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-theme-text-primary'
            }`}
        >
          Business Settings
        </button>
        <button
          onClick={() => setActiveTab('theme')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'theme'
            ? 'border-b-2 border-slate-900 text-slate-900 dark:border-theme-text-primary dark:text-theme-text-primary'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-theme-text-primary'
            }`}
        >
          Theme Settings
        </button>
      </div>

      {/* Business Settings Tab */}
      {activeTab === 'business' && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold text-slate-900 dark:text-theme-text-primary">Business Information</div>
            <Button onClick={save} disabled={saving}>
              Save Changes
            </Button>
          </div>

          {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700 dark:text-theme-text-primary">Clinic Name</label>
              <Input
                value={settings.clinic_name ?? ''}
                onChange={(e) => update('clinic_name', e.target.value)}
                placeholder="Veterinary Clinic"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700 dark:text-theme-text-primary">CUI (Tax ID)</label>
              <Input
                value={settings.clinic_cui ?? ''}
                onChange={(e) => update('clinic_cui', e.target.value)}
                placeholder="ROxxxxxx"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700 dark:text-theme-text-primary">Address</label>
              <Input
                value={settings.clinic_address ?? ''}
                onChange={(e) => update('clinic_address', e.target.value)}
                placeholder="Street, City, Country"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700 dark:text-theme-text-primary">Phone</label>
              <Input
                value={settings.clinic_phone ?? ''}
                onChange={(e) => update('clinic_phone', e.target.value)}
                placeholder="+40 xxx xxx xxx"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700 dark:text-theme-text-primary">IBAN</label>
              <Input
                value={settings.clinic_iban ?? ''}
                onChange={(e) => update('clinic_iban', e.target.value)}
                placeholder="ROxx XXXX xxxx xxxx xxxx xxxx"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700 dark:text-theme-text-primary">SWIFT/BIC</label>
              <Input
                value={settings.clinic_swift ?? ''}
                onChange={(e) => update('clinic_swift', e.target.value)}
                placeholder="XXXXXXXXXX"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700 dark:text-theme-text-primary">Logo URL (optional)</label>
              <Input
                value={settings.clinic_logo ?? ''}
                onChange={(e) => update('clinic_logo', e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <div className="text-xs text-slate-500">
                For now, provide a public URL. Future: upload directly.
              </div>
            </div>
          </div>
        </>
      )}

      {/* Theme Settings Tab */}
      {activeTab === 'theme' && <ThemeSettings />}
    </div>
  );
}
