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
