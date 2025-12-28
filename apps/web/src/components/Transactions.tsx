import * as React from 'react';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from 'recharts';
import { api } from '../lib/api';
import type { TransactionsStatsResponse, Transaction } from '../lib/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { formatRon } from '../lib/money';
import Badge from './ui/Badge';
import Input from './ui/Input';
import Button from './ui/Button';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { useDarkMode } from '../lib/useDarkMode';

function isoDateOnly(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

function UploadIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
    );
}

function TrendUpIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
            <polyline points="23,6 13.5,15.5 8.5,10.5 1,18" />
            <polyline points="17,6 23,6 23,12" />
        </svg>
    );
}

function TrendDownIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
            <polyline points="23,18 13.5,8.5 8.5,13.5 1,6" />
            <polyline points="17,18 23,18 23,12" />
        </svg>
    );
}

function WalletIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
            <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5z" />
            <path d="M21 12h-5a2 2 0 0 0 0 4h5" />
        </svg>
    );
}

function BankIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
            <path d="M3 21h18" />
            <path d="M3 10h18" />
            <path d="M5 6l7-3 7 3" />
            <path d="M4 10v11" />
            <path d="M20 10v11" />
            <path d="M8 14v3" />
            <path d="M12 14v3" />
            <path d="M16 14v3" />
        </svg>
    );
}

const COLORS = ['#10b981', '#f43f5e', '#6366f1', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function Transactions() {
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

    const [stats, setStats] = React.useState<TransactionsStatsResponse | null>(null);
    const [transactions, setTransactions] = React.useState<Transaction[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [uploading, setUploading] = React.useState(false);
    const [uploadResult, setUploadResult] = React.useState<{ ok: boolean; inserted: number; updated: number; skipped: number } | null>(null);

    // Filters
    const [from, setFrom] = React.useState(() => isoDateOnly(daysAgo(365)));
    const [to, setTo] = React.useState(() => isoDateOnly());
    const [search, setSearch] = React.useState('');
    const [typeFilter, setTypeFilter] = React.useState('');

    const debouncedSearch = useDebouncedValue(search, 300);
    const debouncedFrom = useDebouncedValue(from, 250);
    const debouncedTo = useDebouncedValue(to, 250);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Fetch stats
    React.useEffect(() => {
        let cancelled = false;
        setError(null);
        api.transactionStats({ from: debouncedFrom, to: debouncedTo })
            .then((data) => {
                if (cancelled) return;
                setStats(data as TransactionsStatsResponse);
            })
            .catch((e: unknown) => {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : 'Failed to load stats');
            });
        return () => { cancelled = true; };
    }, [debouncedFrom, debouncedTo]);

    // Fetch transactions
    React.useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const params: { from: string; to: string; search: string; type?: string } = {
            from: debouncedFrom,
            to: debouncedTo,
            search: debouncedSearch
        };
        if (typeFilter) {
            params.type = typeFilter;
        }
        api.transactions(params)
            .then((data) => {
                if (cancelled) return;
                setTransactions(data as Transaction[]);
            })
            .catch((e: unknown) => {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : 'Failed to load transactions');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [debouncedFrom, debouncedTo, debouncedSearch, typeFilter]);

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError(null);
        setUploadResult(null);

        try {
            const result = await api.uploadTransactions(file);
            setUploadResult(result as { ok: boolean; inserted: number; updated: number; skipped: number });
            // Refresh data
            const [newStats, newTransactions] = await Promise.all([
                api.transactionStats({ from: debouncedFrom, to: debouncedTo }),
                api.transactions({ from: debouncedFrom, to: debouncedTo }),
            ]);
            setStats(newStats as TransactionsStatsResponse);
            setTransactions(newTransactions as Transaction[]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to upload file');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }

    // Chart data
    const monthlyChartData = React.useMemo(() => {
        if (!stats) return [];
        return stats.monthlyStats.map((m) => ({
            name: m.month,
            income: m.income,
            expenses: m.expenses,
            net: m.net,
        }));
    }, [stats]);

    const balanceChartData = React.useMemo(() => {
        if (!stats) return [];
        return stats.dailyBalances.map((d) => ({
            name: d.date,
            balance: d.balance,
        }));
    }, [stats]);

    const typeChartData = React.useMemo(() => {
        if (!stats) return [];
        return stats.byType.slice(0, 6).map((t) => ({
            name: t.transaction_type,
            value: Math.abs(t.total),
            isExpense: t.total < 0,
        }));
    }, [stats]);

    const isPositiveBalance = (stats?.kpis.net_balance ?? 0) >= 0;

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-theme-bg-secondary">
                <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5">
                        <BankIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-theme-text-primary">Bank Transactions</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Financial overview & statement import</p>
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
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2"
                    >
                        <UploadIcon className="h-4 w-4" />
                        {uploading ? 'Uploading...' : 'Import Statement'}
                    </Button>
                </div>
            </div>

            {/* Upload Result */}
            {uploadResult && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-medium">Import successful!</span>
                        <span className="text-sm text-emerald-600 dark:text-emerald-500">
                            {uploadResult.inserted} new, {uploadResult.updated} updated, {uploadResult.skipped} skipped
                        </span>
                        <button
                            onClick={() => setUploadResult(null)}
                            className="ml-auto text-emerald-500 hover:text-emerald-700"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Income</CardTitle>
                        <TrendUpIcon className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            +{formatRon(stats?.kpis.total_income ?? 0)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Expenses</CardTitle>
                        <TrendDownIcon className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                            -{formatRon(stats?.kpis.total_expenses ?? 0)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Net Balance</CardTitle>
                        {isPositiveBalance ? (
                            <TrendUpIcon className="h-4 w-4 text-emerald-500" />
                        ) : (
                            <TrendDownIcon className="h-4 w-4 text-rose-500" />
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${isPositiveBalance ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {isPositiveBalance ? '+' : ''}{formatRon(stats?.kpis.net_balance ?? 0)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Current Balance</CardTitle>
                        <WalletIcon className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900 dark:text-theme-text-primary">
                            {formatRon(stats?.kpis.current_balance ?? 0)}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 dark:text-slate-500">
                            {stats?.kpis.transaction_count ?? 0} transactions
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Monthly Income vs Expenses */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-theme-bg-secondary">
                    <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-theme-text-primary">Monthly Income vs Expenses</h3>
                    <div className="h-[280px] w-full">
                        {monthlyChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: axisColor }}
                                    />
                                    <YAxis
                                        width={60}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: axisColor }}
                                        tickFormatter={(val) => Math.round(val / 1000) + 'k'}
                                    />
                                    <Tooltip
                                        contentStyle={tooltipStyle}
                                        formatter={(value: number, name: string) => [formatRon(value), name === 'income' ? 'Income' : 'Expenses']}
                                    />
                                    <Legend />
                                    <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" />
                                    <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Expenses" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-slate-400">
                                No data available. Import a bank statement to get started.
                            </div>
                        )}
                    </div>
                </div>

                {/* Balance Trend */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-theme-bg-secondary">
                    <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-theme-text-primary">Balance Trend</h3>
                    <div className="h-[280px] w-full">
                        {balanceChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={balanceChartData}>
                                    <defs>
                                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: axisColor }}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        width={60}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: axisColor }}
                                        tickFormatter={(val) => Math.round(val / 1000) + 'k'}
                                    />
                                    <Tooltip
                                        contentStyle={tooltipStyle}
                                        formatter={(value: number) => [formatRon(value), 'Balance']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="balance"
                                        stroke="#6366f1"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorBalance)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-slate-400">
                                No balance data available.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Transaction Types & Top Counterparties */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* By Transaction Type */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-theme-bg-secondary">
                    <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-theme-text-primary">By Transaction Type</h3>
                    <div className="h-[200px] w-full">
                        {typeChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={typeChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {typeChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke={isDark ? '#0f172a' : '#fff'} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatRon(value)} contentStyle={tooltipStyle} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-slate-400">
                                No transaction types available.
                            </div>
                        )}
                    </div>
                    <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                        {stats?.byType.slice(0, 8).map((t, index) => (
                            <div key={t.transaction_type} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                    <span className="truncate text-slate-600 dark:text-slate-300">{t.transaction_type}</span>
                                </div>
                                <span className={`font-medium shrink-0 ${t.total >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {t.total >= 0 ? '+' : ''}{formatRon(t.total)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Counterparties */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-theme-bg-secondary">
                    <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-theme-text-primary">Top Counterparties</h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {stats?.topCounterparties.length ? (
                            stats.topCounterparties.map((c, index) => (
                                <div key={c.name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                            {index + 1}
                                        </div>
                                        <div className="overflow-hidden">
                                            <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-200">{c.name}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">{c.count} transactions</div>
                                        </div>
                                    </div>
                                    <span className={`font-semibold ${c.total >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {c.total >= 0 ? '+' : ''}{formatRon(c.total)}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="text-sm text-slate-400 text-center py-8">No counterparties available.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-theme-bg-secondary">
                <div className="flex flex-col gap-4 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between dark:border-slate-700">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-theme-text-primary">All Transactions</h3>
                    <div className="flex items-center gap-3">
                        <Input
                            type="text"
                            placeholder="Search counterparty or details..."
                            className="h-9 w-64 text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <select
                            className="h-9 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                        >
                            <option value="">All Types</option>
                            {stats?.transactionTypes.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Counterparty</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Details</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Amount</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                        Loading transactions...
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                        No transactions found. Import a bank statement to get started.
                                    </td>
                                </tr>
                            ) : (
                                transactions.slice(0, 100).map((t, index) => (
                                    <tr key={t.id} className={index % 2 === 0 ? 'bg-white dark:bg-theme-bg-secondary' : 'bg-slate-50/50 dark:bg-slate-800/30'}>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900 dark:text-slate-200">
                                            {t.processed_at}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <Badge variant="neutral" className="text-xs">
                                                {t.transaction_type}
                                            </Badge>
                                        </td>
                                        <td className="max-w-[200px] truncate px-4 py-3 text-sm text-slate-700 dark:text-slate-300" title={t.counterparty_name ?? undefined}>
                                            {t.counterparty_name || '—'}
                                        </td>
                                        <td className="max-w-[250px] truncate px-4 py-3 text-sm text-slate-500 dark:text-slate-400" title={t.transaction_details ?? undefined}>
                                            {t.transaction_details || '—'}
                                        </td>
                                        <td className={`whitespace-nowrap px-4 py-3 text-right text-sm font-semibold ${t.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                            }`}>
                                            {t.amount >= 0 ? '+' : ''}{formatRon(t.amount)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-300">
                                            {formatRon(t.running_balance)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {transactions.length > 100 && (
                    <div className="border-t border-slate-200 px-4 py-3 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Showing 100 of {transactions.length} transactions
                    </div>
                )}
            </div>
        </div>
    );
}
