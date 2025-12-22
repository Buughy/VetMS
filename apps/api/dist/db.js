import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
const dataDir = process.env.VETMS_DATA_DIR ?? path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'vetms.sqlite');
function findUp(startDir, fileName) {
    let current = startDir;
    for (let i = 0; i < 8; i++) {
        const candidate = path.join(current, fileName);
        if (fs.existsSync(candidate))
            return candidate;
        const parent = path.dirname(current);
        if (parent === current)
            break;
        current = parent;
    }
    return null;
}
export function openDb() {
    fs.mkdirSync(dataDir, { recursive: true });
    const db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    return db;
}
export function ensureSchema(db) {
    // Apply schema if core tables are missing (idempotent thanks to IF NOT EXISTS)
    const hasSettings = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
        .get();
    const schemaPath = findUp(process.cwd(), 'schema.sql');
    if (!schemaPath) {
        throw new Error('schema.sql not found (looked up from current directory)');
    }
    const sql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(sql);
    // Migration: add pet_id to invoice_items for legacy databases
    const invoiceItemsTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invoice_items'")
        .get();
    if (invoiceItemsTable) {
        const hasPetIdColumn = db
            .prepare("SELECT 1 FROM pragma_table_info('invoice_items') WHERE name = 'pet_id'")
            .get();
        if (!hasPetIdColumn) {
            db.exec('ALTER TABLE invoice_items ADD COLUMN pet_id INTEGER');
        }
    }
}
