export function registerPets(server, db) {
    server.get('/api/pets', async (req, reply) => {
        const clientIdStr = req.query.clientId;
        const clientId = clientIdStr ? Number(clientIdStr) : undefined;
        if (!clientId || !Number.isFinite(clientId)) {
            return reply.code(400).send({ error: 'clientId required' });
        }
        return db
            .prepare('SELECT id, name, species, client_id FROM pets WHERE client_id=? ORDER BY name')
            .all(clientId);
    });
}
