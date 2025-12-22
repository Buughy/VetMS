export type Settings = Record<string, string>;

export type InvoiceDetail = {
  invoice: {
    id: number;
    friendly_id: string;
    date: string;
    status: 'Draft' | 'Saved';
    total_amount: number;
    client_id: number;
    client_name: string;
    contact_info: string | null;
  };
  items: Array<{
    id: number;
    pet_id: number | null;
    pet_name: string | null;
    pet_species: string | null;
    product_id: number | null;
    product_name_snapshot: string;
    quantity: number;
    price_snapshot: number;
  }>;
};
