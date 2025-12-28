import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db.js';
import * as XLSX from 'xlsx';
import { createHash } from 'node:crypto';

// Column name mapping from Excel (Romanian) to normalized keys
const COLUMN_MAP: Record<string, string> = {
    'numar cont': 'account_iban',
    'data procesarii': 'processed_at',
    'suma': 'amount',
    'valuta': 'currency',
    'tip tranzactie': 'transaction_type',
    'tip tranzactie ': 'transaction_type', // Note: trailing space in original
    'nume beneficiar/ordonator': 'counterparty_name',
    'adresa beneficiar/ordonator': 'counterparty_address',
    'cont beneficiar/ordonator': 'counterparty_account',
    'banca beneficiar/ordonator': 'counterparty_bank',
    'detalii tranzactie': 'transaction_details',
    'sold intermediar': 'running_balance',
    'cui contrapartida': 'counterparty_tax_id',
};

interface RawExcelRow {
    [key: string]: unknown;
}

interface NormalizedTransaction {
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
}

function normalizeString(val: unknown): string | null {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    if (str === '' || /^\s*$/.test(str)) return null;
    return str;
}

function normalizeNumber(val: unknown): number {
    if (typeof val === 'number') return val;
    if (val === null || val === undefined) return 0;
    const str = String(val).replace(',', '.').replace(/\s/g, '');
    const num = parseFloat(str);
    return Number.isFinite(num) ? num : 0;
}

function excelDateToISO(val: unknown): string {
    // XLSX may return dates as JS Date or Excel serial numbers
    if (val instanceof Date) {
        return val.toISOString().slice(0, 10);
    }
    if (typeof val === 'number') {
        // Excel serial date
        const date = XLSX.SSF.parse_date_code(val);
        if (date) {
            return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        }
    }
    // Try to parse as string
    const str = normalizeString(val);
    if (!str) return new Date().toISOString().slice(0, 10);

    // Handle common formats: DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD
    const ddmmyyyy = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (ddmmyyyy) {
        return `${ddmmyyyy[3]}-${ddmmyyyy[2]!.padStart(2, '0')}-${ddmmyyyy[1]!.padStart(2, '0')}`;
    }

    // Already in ISO format
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];

    return str;
}

function computeTransactionId(row: NormalizedTransaction): string {
    const parts = [
        row.account_iban,
        row.processed_at,
        String(row.amount),
        row.currency,
        String(row.running_balance),
        row.counterparty_account ?? '',
        row.transaction_details ?? '',
    ];
    return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

function normalizeRow(raw: RawExcelRow): NormalizedTransaction | null {
    // First, normalize column names
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
        const normalizedKey = COLUMN_MAP[key.toLowerCase().trim()] || key.toLowerCase().trim();
        normalized[normalizedKey] = value;
    }

    const account_iban = normalizeString(normalized['account_iban']);
    const processed_at = excelDateToISO(normalized['processed_at']);
    const amount = normalizeNumber(normalized['amount']);
    const currency = normalizeString(normalized['currency']) ?? 'RON';
    const transaction_type = normalizeString(normalized['transaction_type']);
    const running_balance = normalizeNumber(normalized['running_balance']);

    // Skip invalid rows (missing required fields)
    if (!account_iban || !transaction_type) {
        return null;
    }

    const row: NormalizedTransaction = {
        transaction_id: '', // Will be computed
        account_iban,
        processed_at,
        amount,
        currency,
        transaction_type,
        counterparty_name: normalizeString(normalized['counterparty_name']),
        counterparty_address: normalizeString(normalized['counterparty_address']),
        counterparty_account: normalizeString(normalized['counterparty_account']),
        counterparty_bank: normalizeString(normalized['counterparty_bank']),
        transaction_details: normalizeString(normalized['transaction_details']),
        running_balance,
        counterparty_tax_id: normalizeString(normalized['counterparty_tax_id']),
    };

    row.transaction_id = computeTransactionId(row);
    return row;
}

export function registerTransactions(server: FastifyInstance, db: Db) {
    // Get all transactions with optional filters
    server.get(
        '/api/transactions',
        async (req: FastifyRequest<{ Querystring: { from?: string; to?: string; type?: string; search?: string } }>) => {
            const { from, to, type, search } = req.query;

            let sql = 'SELECT * FROM bank_statement_transactions_ing WHERE 1=1';
            const params: unknown[] = [];

            if (from) {
                sql += ' AND processed_at >= ?';
                params.push(from);
            }
            if (to) {
                sql += ' AND processed_at <= ?';
                params.push(to);
            }
            if (type) {
                sql += ' AND transaction_type = ?';
                params.push(type);
            }
            if (search) {
                sql += ' AND (counterparty_name LIKE ? OR transaction_details LIKE ?)';
                const searchPattern = `%${search}%`;
                params.push(searchPattern, searchPattern);
            }

            sql += ' ORDER BY processed_at DESC, id DESC LIMIT 1000';

            return db.prepare(sql).all(...params);
        }
    );

    // Get transaction statistics
    server.get(
        '/api/transactions/stats',
        async (req: FastifyRequest<{ Querystring: { from?: string; to?: string } }>) => {
            const { from, to } = req.query;

            let whereClause = '1=1';
            const params: unknown[] = [];

            if (from) {
                whereClause += ' AND processed_at >= ?';
                params.push(from);
            }
            if (to) {
                whereClause += ' AND processed_at <= ?';
                params.push(to);
            }

            // KPIs
            const kpis = db.prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_income,
          COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_expenses,
          COALESCE(SUM(amount), 0) as net_balance,
          COUNT(*) as transaction_count
        FROM bank_statement_transactions_ing
        WHERE ${whereClause}
      `).get(...params) as { total_income: number; total_expenses: number; net_balance: number; transaction_count: number };

            // Monthly stats
            const monthlyStats = db.prepare(`
        SELECT 
          strftime('%Y-%m', processed_at) as month,
          COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as income,
          COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as expenses,
          COALESCE(SUM(amount), 0) as net
        FROM bank_statement_transactions_ing
        WHERE ${whereClause}
        GROUP BY month
        ORDER BY month
      `).all(...params) as Array<{ month: string; income: number; expenses: number; net: number }>;

            // Transaction types breakdown
            const byType = db.prepare(`
        SELECT 
          transaction_type,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total
        FROM bank_statement_transactions_ing
        WHERE ${whereClause}
        GROUP BY transaction_type
        ORDER BY ABS(total) DESC
        LIMIT 10
      `).all(...params) as Array<{ transaction_type: string; count: number; total: number }>;

            // Top counterparties by volume
            const topCounterparties = db.prepare(`
        SELECT 
          COALESCE(counterparty_name, 'Unknown') as name,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total
        FROM bank_statement_transactions_ing
        WHERE ${whereClause} AND counterparty_name IS NOT NULL
        GROUP BY counterparty_name
        ORDER BY ABS(total) DESC
        LIMIT 10
      `).all(...params) as Array<{ name: string; count: number; total: number }>;

            // Daily balance trend (last balance of each day)
            const dailyBalances = db.prepare(`
        SELECT 
          processed_at as date,
          running_balance as balance
        FROM bank_statement_transactions_ing t1
        WHERE ${whereClause}
          AND id = (
            SELECT MAX(t2.id) 
            FROM bank_statement_transactions_ing t2 
            WHERE t2.processed_at = t1.processed_at
          )
        ORDER BY processed_at
      `).all(...params) as Array<{ date: string; balance: number }>;

            // Get latest running balance
            const latestBalance = db.prepare(`
        SELECT running_balance 
        FROM bank_statement_transactions_ing 
        ORDER BY processed_at DESC, id DESC 
        LIMIT 1
      `).get() as { running_balance: number } | undefined;

            // Get unique transaction types for filter dropdown
            const transactionTypes = db.prepare(`
        SELECT DISTINCT transaction_type 
        FROM bank_statement_transactions_ing 
        ORDER BY transaction_type
      `).all() as Array<{ transaction_type: string }>;

            return {
                kpis: {
                    ...kpis,
                    current_balance: latestBalance?.running_balance ?? 0,
                },
                monthlyStats,
                byType,
                topCounterparties,
                dailyBalances,
                transactionTypes: transactionTypes.map(t => t.transaction_type),
            };
        }
    );

    // Upload and import transactions from Excel file
    server.post('/api/transactions/upload', async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const data = await req.file();
            if (!data) {
                return reply.code(400).send({ error: 'No file uploaded' });
            }

            const buffer = await data.toBuffer();
            const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
                return reply.code(400).send({ error: 'No sheets found in file' });
            }

            const sheet = workbook.Sheets[sheetName];
            if (!sheet) {
                return reply.code(400).send({ error: 'Sheet not found' });
            }
            const rows = XLSX.utils.sheet_to_json<RawExcelRow>(sheet, { defval: null });

            if (rows.length === 0) {
                return reply.code(400).send({ error: 'No data rows found' });
            }

            // Prepare upsert statement
            const stmt = db.prepare(`
        INSERT INTO bank_statement_transactions_ing (
          transaction_id, account_iban, processed_at, amount, currency,
          transaction_type, counterparty_name, counterparty_address,
          counterparty_account, counterparty_bank, transaction_details,
          running_balance, counterparty_tax_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(transaction_id) DO UPDATE SET
          account_iban = excluded.account_iban,
          processed_at = excluded.processed_at,
          amount = excluded.amount,
          currency = excluded.currency,
          transaction_type = excluded.transaction_type,
          counterparty_name = excluded.counterparty_name,
          counterparty_address = excluded.counterparty_address,
          counterparty_account = excluded.counterparty_account,
          counterparty_bank = excluded.counterparty_bank,
          transaction_details = excluded.transaction_details,
          running_balance = excluded.running_balance,
          counterparty_tax_id = excluded.counterparty_tax_id
      `);

            let inserted = 0;
            let updated = 0;
            let skipped = 0;

            const insertMany = db.transaction((transactions: NormalizedTransaction[]) => {
                for (const t of transactions) {
                    const result = stmt.run(
                        t.transaction_id,
                        t.account_iban,
                        t.processed_at,
                        t.amount,
                        t.currency,
                        t.transaction_type,
                        t.counterparty_name,
                        t.counterparty_address,
                        t.counterparty_account,
                        t.counterparty_bank,
                        t.transaction_details,
                        t.running_balance,
                        t.counterparty_tax_id
                    );
                    if (result.changes > 0) {
                        // Check if it was an insert or update
                        if (result.lastInsertRowid) {
                            inserted++;
                        } else {
                            updated++;
                        }
                    }
                }
            });

            const transactions: NormalizedTransaction[] = [];
            for (const row of rows) {
                const normalized = normalizeRow(row);
                if (normalized) {
                    transactions.push(normalized);
                } else {
                    skipped++;
                }
            }

            insertMany(transactions);

            return {
                ok: true,
                inserted,
                updated: transactions.length - inserted,
                skipped,
                total: rows.length,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            return reply.code(500).send({ error: `Failed to process file: ${message}` });
        }
    });

    // Delete all transactions (for cleanup)
    server.delete('/api/transactions', async () => {
        db.prepare('DELETE FROM bank_statement_transactions_ing').run();
        return { ok: true };
    });
}
