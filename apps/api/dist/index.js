import Fastify from 'fastify'; // trigger reload
// touch
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { ensureSchema, openDb } from './db.js';
import { registerRoutes } from './routes/index.js';
function findUp(startDir, relativePath) {
    let current = startDir;
    for (let i = 0; i < 8; i++) {
        const candidate = path.join(current, relativePath);
        if (fs.existsSync(candidate))
            return candidate;
        const parent = path.dirname(current);
        if (parent === current)
            break;
        current = parent;
    }
    return null;
}
const server = Fastify({ logger: true });
// Dev convenience: allow Vite dev server
await server.register(cors, {
    origin: true,
});
const db = openDb();
ensureSchema(db);
registerRoutes(server, db);
// Serve built frontend in production
const webDist = findUp(process.cwd(), 'apps/web/dist') ?? path.resolve(process.cwd(), 'apps/web/dist');
if (fs.existsSync(webDist)) {
    await server.register(fastifyStatic, {
        root: webDist,
        prefix: '/',
    });
}
server.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
        reply.code(404).send({ error: 'Not Found' });
        return;
    }
    // SPA fallback
    if (fs.existsSync(path.join(webDist, 'index.html'))) {
        reply.sendFile('index.html');
        return;
    }
    reply.code(404).send({ error: 'Not Found' });
});
const port = Number(process.env.PORT ?? 3000);
await server.listen({ port, host: '0.0.0.0' });
