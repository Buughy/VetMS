PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  contact_info TEXT
);

CREATE TABLE IF NOT EXISTS pets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  species TEXT,
  client_id INTEGER NOT NULL,
  UNIQUE(name, client_id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  price REAL NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  friendly_id TEXT NOT NULL UNIQUE,
  client_id INTEGER NOT NULL,
  pet_id INTEGER,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Saved',
  total_amount REAL NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (pet_id) REFERENCES pets(id)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  pet_id INTEGER,
  product_id INTEGER,
  product_name_snapshot TEXT NOT NULL,
  quantity REAL NOT NULL,
  price_snapshot REAL NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (pet_id) REFERENCES pets(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Default business settings
INSERT OR IGNORE INTO settings(key, value) VALUES('clinic_name', 'Veterinary Clinic');
INSERT OR IGNORE INTO settings(key, value) VALUES('clinic_address', 'Your Address Here');
INSERT OR IGNORE INTO settings(key, value) VALUES('clinic_phone', '+40 xxx xxx xxx');
INSERT OR IGNORE INTO settings(key, value) VALUES('clinic_cui', 'ROxxxxxx');
INSERT OR IGNORE INTO settings(key, value) VALUES('clinic_iban', 'ROxx XXXX xxxx xxxx xxxx xxxx');
INSERT OR IGNORE INTO settings(key, value) VALUES('clinic_logo', '');

-- Bank statement transactions (ING format)
CREATE TABLE IF NOT EXISTS bank_statement_transactions_ing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT NOT NULL UNIQUE,  -- SHA256 hash for dedup
  account_iban TEXT NOT NULL,
  processed_at TEXT NOT NULL,           -- ISO date
  amount REAL NOT NULL,                 -- positive=income, negative=expense
  currency TEXT NOT NULL DEFAULT 'RON',
  transaction_type TEXT NOT NULL,
  counterparty_name TEXT,
  counterparty_address TEXT,
  counterparty_account TEXT,
  counterparty_bank TEXT,
  transaction_details TEXT,
  running_balance REAL NOT NULL,
  counterparty_tax_id TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_processed_at ON bank_statement_transactions_ing(processed_at);
CREATE INDEX IF NOT EXISTS idx_transactions_amount ON bank_statement_transactions_ing(amount);
