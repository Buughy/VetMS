import { createOrUpdateProductSchema } from '../validation.js';
export function registerProducts(server, db) {
    server.get('/api/products', async (req) => {
        const query = req.query.query?.trim();
        if (query) {
            return db
                .prepare('SELECT id, name, price FROM products WHERE name LIKE ? ORDER BY name LIMIT 50')
                .all(`%${query}%`);
        }
        return db
            .prepare('SELECT id, name, price FROM products ORDER BY name LIMIT 500')
            .all();
    });
    server.post('/api/products', async (req, reply) => {
        const parsed = createOrUpdateProductSchema.safeParse(req.body);
        if (!parsed.success)
            return reply.code(400).send(parsed.error);
        const { name, price } = parsed.data;
        const result = db
            .prepare('INSERT INTO products(name, price) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET price=excluded.price')
            .run(name, price);
        const product = db
            .prepare('SELECT id, name, price FROM products WHERE name = ?')
            .get(name);
        return reply.code(result.changes ? 200 : 201).send(product);
    });
    server.put('/api/products/:id', async (req, reply) => {
        const id = Number(req.params.id);
        const parsed = createOrUpdateProductSchema.safeParse(req.body);
        if (!Number.isFinite(id))
            return reply.code(400).send({ error: 'Invalid id' });
        if (!parsed.success)
            return reply.code(400).send(parsed.error);
        const { name, price } = parsed.data;
        db.prepare('UPDATE products SET name=?, price=? WHERE id=?').run(name, price, id);
        const updated = db
            .prepare('SELECT id, name, price FROM products WHERE id=?')
            .get(id);
        return reply.send(updated);
    });
    server.delete('/api/products/:id', async (req, reply) => {
        const id = Number(req.params.id);
        if (!Number.isFinite(id))
            return reply.code(400).send({ error: 'Invalid id' });
        // Clear references to preserve historical invoice items while allowing product deletion
        db.prepare('UPDATE invoice_items SET product_id=NULL WHERE product_id=?').run(id);
        db.prepare('DELETE FROM products WHERE id=?').run(id);
        return reply.send({ ok: true });
    });
    server.post('/api/products/import-csv', async (req, reply) => {
        const csv = req.body.csv;
        if (!csv || typeof csv !== 'string')
            return reply.code(400).send({ error: 'csv required' });
        const rows = csv.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
        if (rows.length === 0)
            return reply.code(400).send({ error: 'No rows found' });
        let processed = 0;
        let skipped = 0;
        const stmt = db.prepare('INSERT INTO products(name, price) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET price=excluded.price');
        for (const row of rows) {
            // Try to be flexible with delimiters (comma, tab, semicolon)
            const delimiter = row.includes('\t') ? '\t' : row.includes(';') ? ';' : ',';
            const parts = row.split(delimiter).map((p) => p.trim());
            if (parts.length < 2) {
                skipped += 1;
                continue;
            }
            const [nameRaw, priceRaw] = parts;
            const name = nameRaw?.trim();
            const priceNum = Number(String(priceRaw).replace(',', '.'));
            // Skip header rows and invalid entries
            if (!name || /^(service|name)$/i.test(name) || /^(price)$/i.test(String(priceRaw))) {
                skipped += 1;
                continue;
            }
            if (!Number.isFinite(priceNum)) {
                skipped += 1;
                continue;
            }
            stmt.run(name, priceNum);
            processed += 1;
        }
        if (processed === 0)
            return reply.code(400).send({ error: 'No valid rows found' });
        return reply.send({ ok: true, processed, skipped });
    });
}
