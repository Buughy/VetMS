export function registerSettings(server, db) {
    server.get('/api/settings', async () => {
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const settings = {};
        for (const row of rows) {
            settings[row.key] = row.value;
        }
        return settings;
    });
    server.put('/api/settings/:key', async (req, reply) => {
        const { key } = req.params;
        const body = req.body;
        if (!body || typeof body.value !== 'string') {
            return reply.code(400).send({ error: 'value required' });
        }
        db.prepare('INSERT OR REPLACE INTO settings(key, value) VALUES(?,?)').run(key, body.value);
        return { key, value: body.value };
    });
}
