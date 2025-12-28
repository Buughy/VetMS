export type Product = {
  id: number;
  name: string;
  price: number;
};

export type Client = {
  id: number;
  name: string;
  contact_info: string | null;
};

export type Pet = {
  id: number;
  name: string;
  species: string | null;
  client_id: number;
};

export type InvoiceSummary = {
  id: number;
  friendly_id: string;
  date: string;
  status: 'Draft' | 'Paid';
  total_amount: number;
  client_name: string;
  pet_names: string | null;
};

export type DashboardResponse = {
  kpis: {
    totalRevenueToday: number;
    invoicesCreatedToday: number;
    topSellingService: string | null;
  };
  recent: InvoiceSummary[];
};

export type StatsResponse = {
  range: { from: string; to: string };
  kpis: {
    totalRevenue: number;
    invoiceCount: number;
    avgInvoice: number;
    topSellingItem: string | null;
  };
  dailyStats: Array<{ date: string; revenue: number; count: number }>;
  monthlyStats: Array<{ month: string; revenue: number; count: number }>;
  topItems: Array<{ name: string; qty: number; revenue: number }>;
  topClients: Array<{ name: string; revenue: number; invoices: number }>;
  topPets: Array<{ name: string; species: string | null; revenue: number; invoices: number }>;
};

export type Transaction = {
  id: number;
  transaction_id: string;
  account_iban: string;
  processed_at: string;
  amount: number;
  currency: string;
  transaction_type: string;
  counterparty_name: string | null;
  counterparty_address: string | null;
  counterparty_account: string | null;
  counterparty_bank: string | null;
  transaction_details: string | null;
  running_balance: number;
  counterparty_tax_id: string | null;
  imported_at: string;
};

export type TransactionsStatsResponse = {
  kpis: {
    total_income: number;
    total_expenses: number;
    net_balance: number;
    transaction_count: number;
    current_balance: number;
  };
  monthlyStats: Array<{ month: string; income: number; expenses: number; net: number }>;
  byType: Array<{ transaction_type: string; count: number; total: number }>;
  topCounterparties: Array<{ name: string; count: number; total: number }>;
  dailyBalances: Array<{ date: string; balance: number }>;
  transactionTypes: string[];
};

