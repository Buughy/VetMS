import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Db } from '../db.js';
import { createOrUpdateClientSchema } from '../validation.js';

export function registerClients(server: FastifyInstance, db: Db) {
  server.get('/api/clients', async (req: FastifyRequest<{ Querystring: { query?: string } }>) => {
    const query = req.query.query?.trim();
    if (query) {
      return db
        .prepare(
          'SELECT id, name, contact_info FROM clients WHERE name LIKE ? ORDER BY name LIMIT 20'
        )
        .all(`%${query}%`);
    }
    return db
      .prepare('SELECT id, name, contact_info FROM clients ORDER BY name LIMIT 200')
      .all();
  });

  server.post(
    '/api/clients',
    async (req: FastifyRequest<{ Body: { name?: unknown; contactInfo?: unknown } }>, reply) => {
      const parsed = createOrUpdateClientSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send(parsed.error);

      const name = parsed.data.name.trim();
      const contactInfo = parsed.data.contactInfo?.trim() || null;

      try {
        const res = db
          .prepare('INSERT INTO clients(name, contact_info) VALUES(?, ?)')
          .run(name, contactInfo);
        return reply.code(201).send({ id: Number(res.lastInsertRowid), name, contact_info: contactInfo });
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
    }
  );

  server.put(
    '/api/clients/:id',
    async (
      req: FastifyRequest<{ Params: { id: string }; Body: { name?: unknown; contactInfo?: unknown } }>,
      reply
    ) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const parsed = createOrUpdateClientSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send(parsed.error);

      const name = parsed.data.name.trim();
      const contactInfo = parsed.data.contactInfo?.trim() || null;

      try {
        const res = db
          .prepare('UPDATE clients SET name=?, contact_info=? WHERE id=?')
          .run(name, contactInfo, id);
        if (res.changes === 0) return reply.code(404).send({ error: 'Not found' });
        return reply.send({ id, name, contact_info: contactInfo });
      } catch (e) {
        return reply.code(400).send({ error: (e as Error).message });
      }
    }
  );

  server.delete(
    '/api/clients/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Invalid id' });

      const invoiceCount = db
        .prepare('SELECT COUNT(*) as count FROM invoices WHERE client_id=?')
        .get(id) as { count: number };

      if ((invoiceCount.count ?? 0) > 0) {
        return reply.code(400).send({ error: 'Client cannot be deleted (has invoices).' });
      }

      const res = db.prepare('DELETE FROM clients WHERE id=?').run(id);
      if (res.changes === 0) return reply.code(404).send({ error: 'Not found' });
      return reply.send({ ok: true });
    }
  );
}
