import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db.js';

function isoDateOnly(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function registerDashboard(server: FastifyInstance, db: Db) {
  server.get('/api/dashboard', async () => {
    const today = isoDateOnly();

    const revenueRow = db
      .prepare('SELECT COALESCE(SUM(total_amount), 0) as revenue FROM invoices WHERE date=?')
      .get(today) as { revenue: number };

    const countRow = db
      .prepare('SELECT COUNT(*) as count FROM invoices WHERE date=?')
      .get(today) as { count: number };

    const topRow = db
      .prepare(
        `SELECT product_name_snapshot as name, SUM(quantity) as qty
         FROM invoice_items ii
         JOIN invoices i ON i.id = ii.invoice_id
         WHERE i.date=?
         GROUP BY product_name_snapshot
         ORDER BY qty DESC
         LIMIT 1`
      )
      .get(today) as { name?: string; qty?: number } | undefined;

    const recent = db
      .prepare(
        `SELECT i.id, i.friendly_id, i.date, i.status, i.total_amount,
        c.name as client_name,
        NULLIF(GROUP_CONCAT(DISTINCT p.name), '') as pet_names
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       LEFT JOIN pets p ON p.id = ii.pet_id
       GROUP BY i.id
       ORDER BY i.id DESC
       LIMIT 4`
      )
      .all();

    return {
      kpis: {
        totalRevenueToday: revenueRow.revenue ?? 0,
        invoicesCreatedToday: countRow.count ?? 0,
        topSellingService: topRow?.name ?? null,
      },
      recent,
    };
  });

  server.get(
    '/api/stats',
    async (
      req: FastifyRequest<{ Querystring: { from?: string; to?: string } }>,
      reply: FastifyReply
    ) => {
      const from = req.query.from?.trim();
      const to = req.query.to?.trim();

      if (!from || !to) {
        return reply.code(400).send({ error: 'Missing from/to (YYYY-MM-DD)' });
      }

      // Basic sanity check (SQLite stores dates as text YYYY-MM-DD in this app)
      if (from.length !== 10 || to.length !== 10) {
        return reply.code(400).send({ error: 'Invalid from/to format (YYYY-MM-DD)' });
      }

      const topRow = db
        .prepare(
          `SELECT product_name_snapshot as name, SUM(quantity) as qty
           FROM invoice_items ii
           JOIN invoices i ON i.id = ii.invoice_id
           WHERE i.date >= ? AND i.date <= ?
           GROUP BY product_name_snapshot
           ORDER BY qty DESC
           LIMIT 1`
        )
        .get(from, to) as { name?: string; qty?: number } | undefined;

      const kpis = db
        .prepare(
          `SELECT
             COALESCE(SUM(total_amount), 0) as totalRevenue,
             COUNT(*) as invoiceCount,
             COALESCE(AVG(total_amount), 0) as avgInvoice
           FROM invoices
           WHERE date >= ? AND date <= ?`
        )
        .get(from, to) as { totalRevenue: number; invoiceCount: number; avgInvoice: number };

      const dailyStats = db
        .prepare(
          `SELECT date,
                  COALESCE(SUM(total_amount), 0) as revenue,
                  COUNT(*) as count
           FROM invoices
           WHERE date >= ? AND date <= ?
           GROUP BY date
           ORDER BY date`
        )
        .all(from, to);

      const monthlyStats = db
        .prepare(
          `SELECT substr(date, 1, 7) as month,
                  COALESCE(SUM(total_amount), 0) as revenue,
                  COUNT(*) as count
           FROM invoices
           WHERE date >= ? AND date <= ?
           GROUP BY month
           ORDER BY month`
        )
        .all(from, to);

      const topItems = db
        .prepare(
          `SELECT ii.product_name_snapshot as name,
                  COALESCE(SUM(ii.quantity), 0) as qty,
                  COALESCE(SUM(ii.quantity * ii.price_snapshot), 0) as revenue
           FROM invoice_items ii
           JOIN invoices i ON i.id = ii.invoice_id
           WHERE i.date >= ? AND i.date <= ?
           GROUP BY ii.product_name_snapshot
           ORDER BY revenue DESC
           LIMIT 10`
        )
        .all(from, to);

      const topClients = db
        .prepare(
          `SELECT c.name as name,
                  COALESCE(SUM(i.total_amount), 0) as revenue,
                  COUNT(*) as invoices
           FROM invoices i
           JOIN clients c ON c.id = i.client_id
           WHERE i.date >= ? AND i.date <= ?
           GROUP BY c.id
           ORDER BY revenue DESC
           LIMIT 10`
        )
        .all(from, to);

      const topPets = db
        .prepare(
          `SELECT p.name as name,
                  p.species as species,
                  COALESCE(SUM(ii.quantity * ii.price_snapshot), 0) as revenue,
                  COUNT(DISTINCT ii.invoice_id) as invoices
           FROM invoice_items ii
           JOIN invoices i ON i.id = ii.invoice_id
           JOIN pets p ON p.id = ii.pet_id
           WHERE i.date >= ? AND i.date <= ?
           GROUP BY p.id
           ORDER BY revenue DESC
           LIMIT 10`
        )
        .all(from, to);

      return reply.send({
        range: { from, to },
        kpis: {
          ...kpis,
          topSellingItem: topRow?.name ?? null,
        },
        dailyStats,
        monthlyStats,
        topItems,
        topClients,
        topPets,
      });
    }
  );
}
