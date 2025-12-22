import { createInvoiceSchema } from '../validation.js';
function isoDateOnly(date = new Date()) {
    return date.toISOString().slice(0, 10);
}
function nextFriendlyId(db) {
    const row = db
        .prepare("SELECT friendly_id FROM invoices WHERE friendly_id LIKE 'MBV-%' ORDER BY id DESC LIMIT 1")
        .get();
    const last = row?.friendly_id;
    const lastSeq = last ? Number(last.split('-')[1]) : 0;
    const next = String(lastSeq + 1).padStart(4, '0');
    return `MBV-${next}`;
}
export function registerInvoices(server, db) {
    server.get('/api/invoices/recent', async () => {
        return db
            .prepare(`SELECT i.id, i.friendly_id, i.date, i.status, i.total_amount,
                c.name as client_name,
                NULLIF(GROUP_CONCAT(DISTINCT p.name), '') as pet_names
         FROM invoices i
         JOIN clients c ON c.id = i.client_id
         LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
         LEFT JOIN pets p ON p.id = ii.pet_id
         GROUP BY i.id
         ORDER BY i.id DESC
         LIMIT 10`)
            .all();
    });
    server.get('/api/invoices', async () => {
        return db
            .prepare(`SELECT i.id, i.friendly_id, i.date, i.status, i.total_amount,
                c.name as client_name,
                NULLIF(GROUP_CONCAT(DISTINCT p.name), '') as pet_names
         FROM invoices i
         JOIN clients c ON c.id = i.client_id
         LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
         LEFT JOIN pets p ON p.id = ii.pet_id
         GROUP BY i.id
         ORDER BY i.id DESC`)
            .all();
    });
    server.get('/api/invoices/:id', async (req, reply) => {
        const id = Number(req.params.id);
        if (!Number.isFinite(id))
            return reply.code(400).send({ error: 'Invalid id' });
        const invoice = db
            .prepare(`SELECT i.id, i.friendly_id, i.date, i.status, i.total_amount,
                c.id as client_id, c.name as client_name, c.contact_info
         FROM invoices i
         JOIN clients c ON c.id = i.client_id
         WHERE i.id=?`)
            .get(id);
        if (!invoice)
            return reply.code(404).send({ error: 'Not found' });
        const items = db
            .prepare(`SELECT ii.id, ii.pet_id, ii.product_id, ii.product_name_snapshot, ii.quantity, ii.price_snapshot,
                p.name as pet_name, p.species as pet_species
         FROM invoice_items ii
         LEFT JOIN pets p ON p.id = ii.pet_id
         WHERE ii.invoice_id=?
         ORDER BY ii.pet_id, ii.id`)
            .all(id);
        return { invoice, items };
    });
    server.put('/api/invoices/:id', async (req, reply) => {
        const id = Number(req.params.id);
        if (!Number.isFinite(id))
            return reply.code(400).send({ error: 'Invalid id' });
        const parsed = createInvoiceSchema.safeParse(req.body);
        if (!parsed.success)
            return reply.code(400).send(parsed.error);
        const data = parsed.data;
        const dateStr = data.date || isoDateOnly();
        const tx = db.transaction(() => {
            // Client upsert
            db.prepare('INSERT INTO clients(name, contact_info) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET contact_info=COALESCE(excluded.contact_info, clients.contact_info)').run(data.clientName.trim(), data.contactInfo?.trim() ?? null);
            const client = db
                .prepare('SELECT id FROM clients WHERE name=?')
                .get(data.clientName.trim());
            // Calculate total from all pets' items
            let total = 0;
            for (const pet of data.pets) {
                for (const item of pet.items) {
                    total += item.quantity * item.unitPrice;
                }
            }
            // Update invoice (remove pet_id from invoice table since we now have multiple pets)
            db.prepare('UPDATE invoices SET client_id=?, pet_id=NULL, date=?, status=?, total_amount=? WHERE id=?').run(client.id, dateStr, data.status, total, id);
            // Replace items
            db.prepare('DELETE FROM invoice_items WHERE invoice_id=?').run(id);
            const itemStmt = db.prepare('INSERT INTO invoice_items(invoice_id, pet_id, product_id, product_name_snapshot, quantity, price_snapshot) VALUES(?,?,?,?,?,?)');
            for (const petData of data.pets) {
                // Pet upsert
                db.prepare('INSERT INTO pets(name, species, client_id) VALUES(?,?,?) ON CONFLICT(name, client_id) DO UPDATE SET species=COALESCE(excluded.species, pets.species)').run(petData.petName.trim(), petData.petSpecies?.trim() ?? null, client.id);
                const pet = db
                    .prepare('SELECT id FROM pets WHERE name=? AND client_id=?')
                    .get(petData.petName.trim(), client.id);
                for (const item of petData.items) {
                    if (item.productId) {
                        const product = db
                            .prepare('SELECT id, name, price FROM products WHERE id=?')
                            .get(item.productId);
                        if (!product)
                            throw new Error('Product not found');
                        itemStmt.run(id, pet.id, product.id, product.name, item.quantity, item.unitPrice);
                    }
                    else {
                        const name = item.customName?.trim();
                        if (!name)
                            throw new Error('Custom item name required');
                        itemStmt.run(id, pet.id, null, name, item.quantity, item.unitPrice);
                    }
                }
            }
            const invoice = db
                .prepare('SELECT friendly_id FROM invoices WHERE id=?')
                .get(id);
            return { invoiceId: id, friendlyId: invoice.friendly_id, total };
        });
        try {
            const result = tx();
            return reply.send({ ...result, warnings: [] });
        }
        catch (err) {
            req.log.error(err);
            return reply.code(400).send({ error: err.message });
        }
    });
    server.post('/api/invoices', async (req, reply) => {
        const parsed = createInvoiceSchema.safeParse(req.body);
        if (!parsed.success)
            return reply.code(400).send(parsed.error);
        const data = parsed.data;
        const dateStr = data.date || isoDateOnly();
        const tx = db.transaction(() => {
            // Client upsert
            db.prepare('INSERT INTO clients(name, contact_info) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET contact_info=COALESCE(excluded.contact_info, clients.contact_info)').run(data.clientName.trim(), data.contactInfo?.trim() ?? null);
            const client = db
                .prepare('SELECT id FROM clients WHERE name=?')
                .get(data.clientName.trim());
            const friendlyId = nextFriendlyId(db);
            // Calculate total from all pets' items
            let total = 0;
            for (const pet of data.pets) {
                for (const item of pet.items) {
                    total += item.quantity * item.unitPrice;
                }
            }
            const invoiceRes = db
                .prepare('INSERT INTO invoices(friendly_id, client_id, pet_id, date, status, total_amount) VALUES(?,?,NULL,?,?,?)')
                .run(friendlyId, client.id, dateStr, data.status, total);
            const invoiceId = Number(invoiceRes.lastInsertRowid);
            const itemStmt = db.prepare('INSERT INTO invoice_items(invoice_id, pet_id, product_id, product_name_snapshot, quantity, price_snapshot) VALUES(?,?,?,?,?,?)');
            for (const petData of data.pets) {
                // Pet upsert
                db.prepare('INSERT INTO pets(name, species, client_id) VALUES(?,?,?) ON CONFLICT(name, client_id) DO UPDATE SET species=COALESCE(excluded.species, pets.species)').run(petData.petName.trim(), petData.petSpecies?.trim() ?? null, client.id);
                const pet = db
                    .prepare('SELECT id FROM pets WHERE name=? AND client_id=?')
                    .get(petData.petName.trim(), client.id);
                for (const item of petData.items) {
                    if (item.productId) {
                        const product = db
                            .prepare('SELECT id, name, price FROM products WHERE id=?')
                            .get(item.productId);
                        if (!product)
                            throw new Error('Product not found');
                        itemStmt.run(invoiceId, pet.id, product.id, product.name, item.quantity, item.unitPrice);
                    }
                    else {
                        const name = item.customName?.trim();
                        if (!name)
                            throw new Error('Custom item name required');
                        itemStmt.run(invoiceId, pet.id, null, name, item.quantity, item.unitPrice);
                    }
                }
            }
            return { invoiceId, friendlyId, total };
        });
        try {
            const result = tx();
            return reply.code(201).send({ ...result, warnings: [] });
        }
        catch (err) {
            req.log.error(err);
            return reply.code(400).send({ error: err.message });
        }
    });
}
