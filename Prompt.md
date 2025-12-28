1) Table schema (what to tell the AI agent)

Suggested table name: bank_statement_transactions_ing

Excel column (as-is)	Normalized column	Type (recommended)	Nullable	Notes
numar cont	account_iban	string	no	Source account IBAN (import as text).
data procesarii	processed_at	date/datetime	no	In file it’s a date-like value (often midnight).
suma	amount	decimal(18,2)	no	Positive/negative amounts; keep sign.
valuta	currency	char(3)	no	e.g., RON.
tip tranzactie  (note trailing space)	transaction_type	string	no	Trim header + values.
nume beneficiar/ordonator	counterparty_name	string	yes	Sometimes missing.
adresa beneficiar/ordonator	counterparty_address	string	yes	Often blank spaces (treat empty/whitespace as null).
cont beneficiar/ordonator	counterparty_account	string	yes	Often missing; IBAN or account-like text.
banca beneficiar/ordonator	counterparty_bank	string	yes	In your file it’s often N (don’t assume it’s a real bank name).
detalii tranzactie	transaction_details	string	yes	Free text; can be long.
sold intermediar	running_balance	decimal(18,2)	no	Balance after the transaction (per row).
CUI Contrapartida	counterparty_tax_id	string	yes	Entirely empty in this file; store as string anyway.

Idempotent import key (important for monthly imports):
	•	Add a computed transaction_id = hash of stable fields, e.g.:
	•	account_iban + processed_at + amount + currency + running_balance + counterparty_account + transaction_details
	•	Then do UPSERT on transaction_id so re-importing the same month doesn’t duplicate rows.

2) Example content (sample row, masked)

Example record (one row), shown as JSON with IBANs masked:

{
  "account_iban": "RO51…7967",
  "processed_at": "2025-12-23",
  "amount": -300.00,
  "currency": "RON",
  "transaction_type": "Transfer ING Business",
  "counterparty_name": "Ana-Maria Pintilie",
  "counterparty_address": null,
  "counterparty_account": "RO15…4707",
  "counterparty_bank": "N",
  "transaction_details": "Prima Craciun Referinta bancii 1acd10eb-2b6f-3474-968b-28bb56d154ca",
  "running_balance": 22568.63,
  "counterparty_tax_id": null
}

3) Import rules the agent should implement (minimal but critical)
	•	Header cleanup: trim column names (there’s a trailing space in tip tranzactie ).
	•	Whitespace-as-null: if a string cell is empty or only spaces, store NULL.
	•	Numbers: parse amount and running_balance as decimals (not floats in DB).
	•	Dates: store processed_at as date (or datetime if you prefer), but normalize to a consistent format.
	•	Dedup: compute transaction_id and upsert.