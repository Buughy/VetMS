import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { api } from '../lib/api';
import type { DashboardResponse, StatsResponse } from '../lib/types';
import type { InvoiceDetail } from '../lib/types-extended';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { formatRon } from '../lib/money';
import Badge from './ui/Badge';
import Input from './ui/Input';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { exportInvoicePdf } from '../lib/pdf';
import { useDarkMode } from '../lib/useDarkMode';

function isoDateOnly(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#94a3b8'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { isDark } = useDarkMode();
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#334155' : '#f1f5f9';
  const tooltipStyle = {
    borderRadius: '8px',
    border: 'none',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    backgroundColor: isDark ? '#1e293b' : '#fff',
    color: isDark ? '#f8fafc' : '#0f172a',
  };
  const [data, setData] = React.useState<DashboardResponse | null>(null);
  const [stats, setStats] = React.useState<StatsResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null);
  const [viewMode, setViewMode] = React.useState<'day' | 'month'>('day');
  const [metric, setMetric] = React.useState<'revenue' | 'count'>('revenue');

  // Initialize from localStorage or default
  const [from, setFrom] = React.useState(() => {
    try {
      const stored = localStorage.getItem('analytics_from');
      return stored || isoDateOnly(daysAgo(180));
    } catch {
      return isoDateOnly(daysAgo(180));
    }
  });

  const [to, setTo] = React.useState(() => {
    try {
      const stored = localStorage.getItem('analytics_to');
      return stored || isoDateOnly();
    } catch {
      return isoDateOnly();
    }
  });

  // Persist dates
  React.useEffect(() => {
    localStorage.setItem('analytics_from', from);
    localStorage.setItem('analytics_to', to);
  }, [from, to]);

  const debouncedFrom = useDebouncedValue(from, 250);
  const debouncedTo = useDebouncedValue(to, 250);

  React.useEffect(() => {
    let cancelled = false;
    api
      .dashboard()
      .then((d) => {
        if (cancelled) return;
        setData(d as DashboardResponse);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .stats({ from: debouncedFrom, to: debouncedTo })
      .then((d) => {
        if (cancelled) return;
        setStats(d as StatsResponse);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStats(null);
        setError(e instanceof Error ? e.message : 'Failed to load stats');
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedFrom, debouncedTo]);

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

  const chartData = React.useMemo(() => {
    if (!stats) return [];
    if (viewMode === 'day') {
      return stats.dailyStats.map((s) => ({
        name: s.date,
        value: metric === 'revenue' ? s.revenue : s.count,
      }));
    } else {
      return stats.monthlyStats.map((s) => ({
        name: s.month,
        value: metric === 'revenue' ? s.revenue : s.count,
      }));
    }
  }, [stats, viewMode, metric]);

  const topItemsData = React.useMemo(() =>
    (stats?.topItems ?? []).slice(0, 5).map(i => ({ name: i.name, value: i.revenue, qty: i.qty })),
    [stats]
  );

  const topClientsData = React.useMemo(() =>
    (stats?.topClients ?? []).slice(0, 5).map(c => ({ name: c.name, value: c.revenue })),
    [stats]
  );

  const topPetsData = React.useMemo(() =>
    (stats?.topPets ?? []).slice(0, 5).map(p => ({ name: p.name, value: p.revenue, species: p.species })),
    [stats]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-theme-bg-secondary">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-theme-text-primary">Dashboard</h2>
          <div className="hidden h-6 w-px bg-slate-200 md:block dark:bg-slate-700"></div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'day' | 'month')}
            >
              <option value="day">Daily View</option>
              <option value="month">Monthly View</option>
            </select>
            <select
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              value={metric}
              onChange={(e) => setMetric(e.target.value as 'revenue' | 'count')}
            >
              <option value="revenue">Revenue</option>
              <option value="count">Invoices</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            className="h-9 w-auto border-slate-300 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-slate-400">→</span>
          <Input
            type="date"
            className="h-9 w-auto border-slate-300 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-theme-text-primary">{formatRon(stats?.kpis.totalRevenue ?? 0)}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-theme-text-primary">{stats?.kpis.invoiceCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Avg Invoice (Period)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-theme-text-primary">{formatRon(stats?.kpis.avgInvoice ?? 0)}</div>
            <div className="text-xs text-slate-400 mt-1 dark:text-slate-500">{stats?.kpis.invoiceCount ?? 0} total invoices</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Top Service</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-slate-900 truncate dark:text-theme-text-primary" title={stats?.kpis.topSellingItem ?? ''}>
              {stats?.kpis.topSellingItem || '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid - Stacked Layout */}
      <div className="flex flex-col gap-6">
        {/* Recent Invoices - Full width, above chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-theme-bg-secondary">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-theme-text-primary">Recent Invoices</h3>
          <div className="space-y-4">
            {(data?.recent ?? []).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-200" title={inv.client_name}>
                    {inv.client_name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{inv.friendly_id}</span>
                    <span>•</span>
                    <span>{inv.date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900 dark:text-theme-text-primary">{formatRon(inv.total_amount)}</div>
                    <Badge variant={inv.status === 'Draft' ? 'neutral' : 'success'} className="scale-90 origin-right">{inv.status}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => downloadInvoice(inv.id)}
                      disabled={downloadingId === inv.id}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-emerald-400"
                    >
                      <DownloadIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {(data?.recent?.length ?? 0) === 0 && <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No recent invoices</div>}
          </div>
        </div>

        {/* Main Chart Section - Full width */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-theme-bg-secondary">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-theme-text-primary">Performance Over Time</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {metric === 'revenue' ? 'Total Revenue' : 'Invoice Count'} · {viewMode === 'day' ? 'Daily' : 'Monthly'}
            </p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {metric === 'revenue' ? (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isDark ? '#818cf8' : '#6366f1'} stopOpacity={0.1} />
                      <stop offset="95%" stopColor={isDark ? '#818cf8' : '#6366f1'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: axisColor }}
                    dy={10}
                  />
                  <YAxis
                    width={55}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: axisColor }}
                    tickFormatter={(val) => Math.round(val).toLocaleString('ro-RO')}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [formatRon(value), 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: axisColor }}
                    dy={10}
                  />
                  <YAxis
                    width={50}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: axisColor }}
                  />
                  <Tooltip
                    cursor={{ fill: isDark ? '#334155' : '#f8fafc' }}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} name="Invoices" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Top Items */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-theme-bg-secondary">
          <h3 className="mb-6 text-base font-semibold text-slate-900 dark:text-theme-text-primary">Top Items by Revenue</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topItemsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {topItemsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke={isDark ? '#0f172a' : '#fff'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatRon(value)}
                  contentStyle={tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-3">
            {topItemsData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="truncate text-slate-600 dark:text-slate-300" title={item.name}>{item.name} <span className="text-slate-400 text-xs dark:text-slate-500">({item.qty})</span></span>
                </div>
                <span className="font-medium text-slate-900 shrink-0 dark:text-theme-text-primary">{formatRon(item.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Clients */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-theme-bg-secondary">
          <h3 className="mb-6 text-base font-semibold text-slate-900 dark:text-theme-text-primary">Top Clients</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topClientsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {topClientsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke={isDark ? '#0f172a' : '#fff'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatRon(value)}
                  contentStyle={tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-3">
            {topClientsData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="truncate text-slate-600 dark:text-slate-300" title={item.name}>{item.name}</span>
                </div>
                <span className="font-medium text-slate-900 shrink-0 dark:text-theme-text-primary">{formatRon(item.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Pets */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-theme-bg-secondary">
          <h3 className="mb-6 text-base font-semibold text-slate-900 dark:text-theme-text-primary">Top Pets</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topPetsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {topPetsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke={isDark ? '#0f172a' : '#fff'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatRon(value)}
                  contentStyle={tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-3">
            {topPetsData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="truncate text-slate-600 dark:text-slate-300" title={item.name}>
                    {item.name} {item.species && <span className="text-slate-400 text-xs dark:text-slate-500">({item.species})</span>}
                  </span>
                </div>
                <span className="font-medium text-slate-900 shrink-0 dark:text-theme-text-primary">{formatRon(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
