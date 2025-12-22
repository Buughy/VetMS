import * as React from 'react';
import ProductTable from './ProductTable';
import ClientManager from './ClientManager';
import BusinessSettings from './BusinessSettings';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = React.useState<'products' | 'clients' | 'settings'>('products');

  const tabs: Array<{ id: typeof activeTab; label: string }> = [
    { id: 'products', label: 'Products' },
    { id: 'clients', label: 'Clients' },
    { id: 'settings', label: 'Business Settings' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="text-lg font-semibold text-slate-900 dark:text-theme-text-primary">Admin Panel</div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.id
              ? 'border-b-2 border-slate-900 text-slate-900 dark:border-theme-text-primary dark:text-theme-text-primary'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-theme-text-primary'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'products' && <ProductTable />}
      {activeTab === 'clients' && <ClientManager />}
      {activeTab === 'settings' && <BusinessSettings />}
    </div>
  );
}
