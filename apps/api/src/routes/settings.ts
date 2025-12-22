import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db.js';

export function registerSettings(server: FastifyInstance, db: Db) {
  server.get('/api/settings', async () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{
      key: string;
      value: string;
    }>;
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  });

  server.put(
    '/api/settings/:key',
    async (req: FastifyRequest<{ Params: { key: string }; Body: { value: string } }>, reply: FastifyReply) => {
      const { key } = req.params;
      const body = req.body as { value: string };
      if (!body || typeof body.value !== 'string') {
        return reply.code(400).send({ error: 'value required' });
      }

      db.prepare('INSERT OR REPLACE INTO settings(key, value) VALUES(?,?)').run(key, body.value);
      return { key, value: body.value };
    }
  );
}
