import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.js';
import { registerProducts } from './products.js';
import { registerClients } from './clients.js';
import { registerPets } from './pets.js';
import { registerInvoices } from './invoices.js';
import { registerDashboard } from './dashboard.js';
import { registerSettings } from './settings.js';
import { registerTransactions } from './transactions.js';

export function registerRoutes(server: FastifyInstance, db: Db) {
  server.get('/api/health', async () => ({ ok: true }));

  registerProducts(server, db);
  registerClients(server, db);
  registerPets(server, db);
  registerInvoices(server, db);
  registerDashboard(server, db);
  registerSettings(server, db);
  registerTransactions(server, db);
}
