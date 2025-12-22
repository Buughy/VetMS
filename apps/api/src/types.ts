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

export type Product = {
  id: number;
  name: string;
  price: number;
};

export type InvoiceSummary = {
  id: number;
  friendly_id: string;
  date: string;
  status: 'Draft' | 'Saved';
  total_amount: number;
  client_name: string;
  pet_name: string | null;
};
